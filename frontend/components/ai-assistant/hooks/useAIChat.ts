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
import type {
  Message,
  Conversation,
  UserContext,
  Product,
  AIAction,
  UserIntent,
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

const MAX_USER_MESSAGE_CHARS = 1000;

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

  useEffect(() => {
    let cancelled = false;
    getAllProducts()
      .then((all) => {
        if (cancelled) return;
        const mapped = catalogProductsToAI(all);
        aiProductsRef.current = mapped;
        hallucinationGuard.current = createHallucinationGuard(mapped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

      // Build system prompt with context
      const catalogProducts = aiProductsRef.current;
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
        userIntent: intent.type,
        emotion: emotionDetection.confidence > 0.3 ? emotionDetection.emotion : undefined,
      });

      // Call Gemini API
      const response = await callBackendAIChat(updatedMessages, systemPrompt);

      // Validate response with hallucination guard
      const validationResult = hallucinationGuard.current.validateResponse(response.content);
      
      let finalContent = response.content;
      
      if (!validationResult.isValid && validationResult.correctedContent) {
        finalContent = validationResult.correctedContent;
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('Response corrected by hallucination guard:', validationResult.violations);
        }
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

      // Extract suggested products from response
      const extractedProducts = extractProductsFromResponse(finalContent, catalogProducts);
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
      // Only log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('AI Chat Error:', err);
        console.error('Error details:', JSON.stringify(err, null, 2));
      }
      
      // Handle rate limit errors specifically
      if (err && typeof err === 'object' && 'code' in err && err.code === 'RATE_LIMIT_EXCEEDED') {
        setError('Надвишили сте дневния лимит за съобщения. Моля, опитайте отново утре или се свържете с нас на телефон: 0888 58 58 16');
      } else {
        setError('Възникна грешка. Моля, опитайте отново или се свържете с нас на телефон: 0888 58 58 16');
      }
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  }, [conversation]);

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
function extractProductsFromResponse(response: string, products: Product[]): Product[] {
  const mentionedProducts: Product[] = [];
  
  products.forEach((product) => {
    if (
      response.toLowerCase().includes(product.name.toLowerCase()) ||
      response.toLowerCase().includes(product.model.toLowerCase())
    ) {
      mentionedProducts.push(product);
    }
  });
  
  return mentionedProducts;
}

export default useAIChat;

async function callBackendAIChat(messages: Message[], systemPrompt?: string): Promise<{ content: string }> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      systemPrompt,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error('AI request failed');
    err.code = res.status === 429 ? 'RATE_LIMIT_EXCEEDED' : `HTTP_${res.status}`;
    err.details = body;
    throw err;
  }

  const data = (await res.json()) as { content?: string };
  return { content: data.content ?? '' };
}
