/**
 * useAIChat Hook
 * Main hook for managing AI conversation state and logic
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { promptBuilder } from '../core/PromptBuilder';
import { skillRouter } from '../core/SkillRouter';
import { emotionalIntelligence } from '../core/EmotionalIntelligence';
import { createHallucinationGuard } from '../security/HallucinationGuard';
import { getAllProducts } from '../../../data/productService';
import { catalogProductsToAI } from '../data/catalogToAIProducts';
import {
  rankProductsForQuery,
  responseOffersProducts,
  shouldSuggestProductsForTurn,
} from '../data/catalogContextBuilder';
import type {
  Message,
  Conversation,
  UserContext,
  Product,
  AIAction,
  UserIntent,
  IntentType,
  ChatRemotePayload,
} from '../types';
import {
  loadPersistedChat,
  savePersistedChat,
  clearPersistedChat,
  validatePersistedBlob,
  chatStateDiffers,
  CHAT_STATE_STORAGE_KEY,
} from '../lib/chatPersistence';
import { callBackendAIChat } from '../lib/aiChatApi';

const MAX_USER_MESSAGE_CHARS = 1000;
const CATALOG_REFRESH_MS = 45_000;

const BROADCAST_CHANNEL_NAME = 'smolyan-klima-ai-chat';

function tabSessionId(): string {
  try {
    const k = 'smolyan-klima-ai-tab-id';
    let id = sessionStorage.getItem(k);
    if (!id || id.length < 8) {
      id = uuidv4();
      sessionStorage.setItem(k, id);
    }
    return id;
  } catch {
    return uuidv4();
  }
}

function readInitialChatState(): {
  messages: Message[];
  conversation: Conversation | null;
  lastSeenSavedAt: number;
} {
  if (typeof window === 'undefined') {
    return { messages: [], conversation: null, lastSeenSavedAt: 0 };
  }
  const blob = loadPersistedChat();
  if (!blob) return { messages: [], conversation: null, lastSeenSavedAt: 0 };
  const conversation = { ...blob.conversation, messages: blob.messages };
  return {
    messages: blob.messages,
    conversation,
    lastSeenSavedAt: blob.savedAt,
  };
}

export interface UseAIChatOptions {
  userContext?: Partial<UserContext>;
  /** Извиква се когато друг таб приложи по-ново състояние на чата. */
  onSyncedFromOtherTab?: () => void;
}

export interface UseAIChatReturn {
  messages: Message[];
  conversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  resetConversation: () => void;
  suggestedProducts: Product[];
  actions: AIAction[];
}

export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const initial = readInitialChatState();
  const [messages, setMessages] = useState<Message[]>(() => initial.messages);
  const [conversation, setConversation] = useState<Conversation | null>(() => initial.conversation);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [actions, setActions] = useState<AIAction[]>([]);

  const aiProductsRef = useRef<Product[]>([]);
  const catalogLoadedAtRef = useRef(0);
  const catalogLoadingRef = useRef<Promise<Product[]> | null>(null);
  const hallucinationGuard = useRef(createHallucinationGuard([]));
  const messagesRef = useRef<Message[]>(initial.messages);
  const conversationRef = useRef<Conversation | null>(initial.conversation);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const tabIdRef = useRef(tabSessionId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSendingRef = useRef(false);
  const lastSeenSavedAtRef = useRef(initial.lastSeenSavedAt);
  /** След apply от друг таб пропускаме един publish цикъл (иначе се получава ехо към BroadcastChannel). */
  const mutationSourceRef = useRef<'local' | 'remote'>('local');

  const loadCatalog = useCallback(async (): Promise<Product[]> => {
    if (catalogLoadingRef.current) return catalogLoadingRef.current;

    catalogLoadingRef.current = (async () => {
      try {
        const all = await getAllProducts();
        const mapped = catalogProductsToAI(all);
        aiProductsRef.current = mapped;
        catalogLoadedAtRef.current = Date.now();
        hallucinationGuard.current.updateProducts(mapped);
        return mapped;
      } catch (err) {
        return aiProductsRef.current;
      } finally {
        catalogLoadingRef.current = null;
      }
    })();

    return catalogLoadingRef.current;
  }, []);

  const ensureFreshCatalog = useCallback(async (): Promise<Product[]> => {
    const age = Date.now() - catalogLoadedAtRef.current;
    if (aiProductsRef.current.length > 0 && age < CATALOG_REFRESH_MS) {
      return aiProductsRef.current;
    }
    return loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - catalogLoadedAtRef.current >= CATALOG_REFRESH_MS) {
        void loadCatalog();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadCatalog]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const applyRemoteBlob = useCallback((blob: NonNullable<ReturnType<typeof validatePersistedBlob>>) => {
    if (blob.savedAt <= lastSeenSavedAtRef.current) return;
    lastSeenSavedAtRef.current = blob.savedAt;
    if (!chatStateDiffers(messagesRef.current, blob.messages)) return;

    const conv = { ...blob.conversation, messages: blob.messages };
    mutationSourceRef.current = 'remote';
    setMessages(blob.messages);
    setConversation(conv);
    savePersistedChat({
      messages: blob.messages,
      conversation: conv,
      savedAt: blob.savedAt,
      writerTabId: blob.writerTabId,
    });
    optionsRef.current.onSyncedFromOtherTab?.();
  }, []);

  // BroadcastChannel — жив синхрон между табове
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = ch;

    ch.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        conversationId?: string;
        payload?: ChatRemotePayload;
        tabId?: string;
      };
      if (!data || data.type !== 'FULL_STATE_SYNC') return;
      if (data.tabId === tabIdRef.current) return;
      const payload = data.payload;
      if (!payload || typeof payload.savedAt !== 'number') return;

      const blob = validatePersistedBlob({
        v: 1,
        messages: payload.messages,
        conversation: { ...payload.conversation, messages: payload.messages },
        savedAt: payload.savedAt,
        writerTabId: payload.writerTabId,
      });
      if (!blob) return;
      applyRemoteBlob(blob);
    };

    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [applyRemoteBlob]);

  // storage — друг таб е записал в localStorage
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CHAT_STATE_STORAGE_KEY || !e.newValue) return;
      try {
        const parsed: unknown = JSON.parse(e.newValue);
        const blob = validatePersistedBlob(parsed);
        if (!blob) return;
        if (blob.writerTabId === tabIdRef.current) return;
        applyRemoteBlob(blob);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applyRemoteBlob]);

  // Публикувай локални промени към други табове + отложен запис в localStorage
  useEffect(() => {
    if (!conversation) return;
    if (mutationSourceRef.current === 'remote') {
      mutationSourceRef.current = 'local';
      return;
    }

    const savedAt = Date.now();
    lastSeenSavedAtRef.current = savedAt;
    const writerTabId = tabIdRef.current;
    const payload: ChatRemotePayload = {
      messages,
      conversation: { ...conversation, messages },
      savedAt,
      writerTabId,
    };

    try {
      channelRef.current?.postMessage({
        type: 'FULL_STATE_SYNC',
        conversationId: conversation.id,
        payload,
        timestamp: savedAt,
        tabId: writerTabId,
      });
    } catch {
      // ignore
    }

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      savePersistedChat({
        messages,
        conversation: { ...conversation, messages },
        savedAt,
        writerTabId,
      });
    }, 150);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [messages, conversation]);

  // Initialize conversation on first load (ако няма персистирано състояние)
  useEffect(() => {
    if (!conversation) {
      const newConversation: Conversation = {
        id: uuidv4(),
        messages: [],
        context: {
          conversationStage: 'greeting',
          userPreferences: {},
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          messageCount: 0,
          convertedToQuote: false,
          convertedToPurchase: false,
        },
      };
      setConversation(newConversation);
    }
  }, [conversation]);

  // Send message and get AI response
  const sendMessage = useCallback(async (content: string) => {
    if (!conversation) return;
    if (isSendingRef.current) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_USER_MESSAGE_CHARS) {
      setError(`Съобщението е твърде дълго (макс. ${MAX_USER_MESSAGE_CHARS} символа).`);
      return;
    }

    isSendingRef.current = true;
    setIsLoading(true);
    setError(null);
    setSuggestedProducts([]);
    setActions([]);

    try {
      // Create user message
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };

      // Analyze intent
      const intent = skillRouter.analyzeIntent(trimmed);
      
      // Detect emotion
      const emotionDetection = emotionalIntelligence.detectEmotion(trimmed);
      
      // Update messages and conversation deterministically (avoid stale closures)
      const baseMessages = messagesRef.current;
      const updatedMessages = [...baseMessages, userMessage];
      setMessages(updatedMessages);

      const baseConversation = conversationRef.current || conversation;
      const updatedConversation: Conversation = {
        ...baseConversation,
        messages: updatedMessages,
        context: {
          ...baseConversation.context,
          userIntent: intent,
          emotionalState:
            emotionDetection.confidence > 0.3 ? emotionDetection.emotion : baseConversation.context.emotionalState,
          conversationStage: determineConversationStage(intent, baseConversation.context.conversationStage),
        },
        updatedAt: Date.now(),
        metadata: {
          ...baseConversation.metadata,
          messageCount: updatedMessages.length,
        },
      };

      setConversation(updatedConversation);

      // Build system prompt with live catalog context
      const catalogProducts = await ensureFreshCatalog();
      const historyQueries = updatedMessages
        .filter((m) => m.role === 'user')
        .slice(-4)
        .map((m) => m.content);

      const systemPrompt = promptBuilder.buildPrompt({
        conversation: updatedConversation,
        userContext: optionsRef.current.userContext as UserContext || {
          sessionId: uuidv4(),
          visitCount: 1,
          firstVisit: Date.now(),
          lastVisit: Date.now(),
          viewedProducts: [],
          searchHistory: [],
          preferences: {},
          consent: { given: false, timestamp: 0, version: '1.0', dataTypes: [] },
          device: { type: 'desktop', viewport: { width: 1920, height: 1080 }, touch: false, language: 'bg' },
        },
        relevantProducts: catalogProducts,
        userQuery: trimmed,
        catalogLoadedAt: catalogLoadedAtRef.current,
        userIntent: intent.type as IntentType,
        emotion: emotionDetection.confidence > 0.3 ? emotionDetection.emotion : undefined,
      });

      const response = await callBackendAIChat(
        updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        systemPrompt,
      );

      // Validate response with hallucination guard
      const validationResult = hallucinationGuard.current.validateResponse(response.content);
      
      let finalContent = response.content;
      
      if (!validationResult.isValid && validationResult.correctedContent) {
        finalContent = validationResult.correctedContent;
      }

      // Apply emotional intelligence
      finalContent = emotionalIntelligence.applyMirroring(updatedMessages, finalContent);
      
      // Add empathy modifier only when:
      //  - emotion is strongly detected (>= 0.6), and
      //  - the response doesn't already start with a greeting/empathy phrase.
      //  - this is NOT the first message (to avoid adding greetings after the first)
      // This prevents stacking "Здравейте... Разбирам..." over Gemini's own greeting.
      const isFirstMessage = updatedMessages.length <= 2; // User + AI welcome
      if (emotionDetection.confidence >= 0.6 && !isFirstMessage) {
        const startsWithGreeting = /^\s*(здравейте|здрасти|добро утро|добър ден|добър вечер|разбирам|чувам ви|радвам се)/i.test(finalContent);
        if (!startsWithGreeting) {
          const empathyModifier = emotionalIntelligence.getEmpathyModifier(
            emotionDetection.emotion,
            emotionDetection.confidence
          );
          if (empathyModifier && !finalContent.toLowerCase().includes(empathyModifier.toLowerCase())) {
            finalContent = `${empathyModifier}\n\n${finalContent}`;
          }
        }
      }

      // Create AI message
      const aiMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: finalContent,
        timestamp: Date.now(),
        metadata: {
          confidence: validationResult.confidence,
          processingTime: Date.now() - userMessage.timestamp,
        },
      };

      // Extract suggested products from response (prefer query-ranked matches)
      const wantsProducts = shouldSuggestProductsForTurn(intent.type, trimmed);
      const ranked = wantsProducts
        ? rankProductsForQuery(catalogProducts, trimmed, historyQueries, 8)
        : [];
      const extractedProducts = extractProductsFromResponse(
        finalContent,
        catalogProducts,
        ranked,
        wantsProducts && responseOffersProducts(finalContent),
      );
      if (extractedProducts.length > 0) {
        setSuggestedProducts(extractedProducts);
      }

      // Update conversation with AI response
      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);
      
      setConversation({
        ...updatedConversation,
        messages: finalMessages,
        updatedAt: Date.now(),
      });

      // Update emotional warmth
      emotionalIntelligence.updateWarmth(updatedConversation.id, aiMessage);

    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'RATE_LIMIT_EXCEEDED') {
        setError('Надвишили сте дневния лимит за съобщения. Моля, опитайте отново утре или се свържете с нас на телефон: 0878 58 16 16');
      } else {
        setError('Възникна грешка. Моля, опитайте отново или се свържете с нас на телефон: 0878 58 16 16');
      }
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  }, [conversation, ensureFreshCatalog]);

  // Reset conversation
  const resetConversation = useCallback(() => {
    clearPersistedChat();
    const savedAt = Date.now();
    lastSeenSavedAtRef.current = savedAt;
    const newConversation: Conversation = {
      id: uuidv4(),
      messages: [],
      context: {
        conversationStage: 'greeting',
        userPreferences: {},
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        messageCount: 0,
        convertedToQuote: false,
        convertedToPurchase: false,
      },
    };

    setConversation(newConversation);
    setMessages([]);
    setSuggestedProducts([]);
    setActions([]);
    setError(null);

    const writerTabId = tabIdRef.current;
    savePersistedChat({
      messages: [],
      conversation: newConversation,
      savedAt,
      writerTabId,
    });
    try {
      channelRef.current?.postMessage({
        type: 'FULL_STATE_SYNC',
        conversationId: newConversation.id,
        payload: {
          messages: [],
          conversation: newConversation,
          savedAt,
          writerTabId,
        },
        timestamp: savedAt,
        tabId: writerTabId,
      });
    } catch {
      // ignore
    }
  }, []);

  return {
    messages,
    conversation,
    isLoading,
    error,
    sendMessage,
    resetConversation,
    suggestedProducts,
    actions,
  };
}

// Helper function to determine conversation stage
function determineConversationStage(
  intent: UserIntent,
  currentStage: string
): 'greeting' | 'discovery' | 'recommendation' | 'comparison' | 'objection_handling' | 'quote_generation' | 'closing' | 'follow_up' {
  switch (intent.type) {
    case 'product_search':
      return currentStage === 'greeting' ? 'discovery' : 'recommendation';
    case 'product_comparison':
      return 'comparison';
    case 'price_inquiry':
      return 'recommendation';
    case 'quote_request':
      return 'quote_generation';
    case 'objection_price':
    case 'objection_timing':
    case 'objection_competitor':
      return 'objection_handling';
    case 'technical_support':
      return 'discovery';
    case 'gratitude':
      return 'closing';
    default:
      return currentStage as any || 'discovery';
  }
}

// Helper function to extract products from response
function extractProductsFromResponse(
  response: string,
  products: Product[],
  rankedHint: Product[] = [],
  allowRankedFallback = false,
): Product[] {
  const mentionedProducts: Product[] = [];
  const responseLower = response.toLowerCase();
  const seen = new Set<string>();

  const tryAdd = (product: Product) => {
    if (seen.has(product.id)) return;
    seen.add(product.id);
    mentionedProducts.push(product);
  };

  for (const product of products) {
    const nameLower = product.name.toLowerCase();
    const slugLower = (product.slug ?? product.id).toLowerCase();
    const brandLower = product.brand.toLowerCase();

    if (
      responseLower.includes(nameLower) ||
      responseLower.includes(slugLower) ||
      (nameLower.length > 12 && responseLower.includes(nameLower.slice(0, Math.min(nameLower.length, 24))))
    ) {
      tryAdd(product);
    } else if (responseLower.includes(brandLower)) {
      const modelPart = nameLower.replace(brandLower, '').trim();
      if (modelPart.length >= 4 && responseLower.includes(modelPart.slice(0, 12))) {
        tryAdd(product);
      }
    }
  }

  if (mentionedProducts.length === 0 && allowRankedFallback && rankedHint.length > 0) {
    for (const p of rankedHint.slice(0, 3)) tryAdd(p);
  }

  return mentionedProducts.slice(0, 4);
}

export default useAIChat;

