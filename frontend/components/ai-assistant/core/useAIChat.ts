/**
 * useAIChat.ts
 * Main hook с всички функции за AI Chat
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { bg } from 'date-fns/locale';
import { getGeminiClient } from './GeminiClient';
import { promptBuilder } from './PromptBuilder';
import { skillRouter } from './SkillRouter';
import { emotionalIntelligence } from './EmotionalIntelligence';
import { createHallucinationGuard } from '../security/HallucinationGuard';
import { getVectorSearchService } from '../services/vectorSearch';
import { aiAnalytics } from '../analytics';
import type { 
  Message, 
  Conversation, 
  UserContext, 
  Product, 
  AIAction,
  UseAIChatOptions,
  UseAIChatReturn 
} from '../types';

export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const { apiKey, userContext: initialUserContext } = options;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [actions, setActions] = useState<AIAction[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const geminiClient = getGeminiClient(apiKey);
  const hallucinationGuard = createHallucinationGuard([], { strictMode: true });
  const vectorSearch = getVectorSearchService();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const detectLanguage = useCallback((text: string): 'bg' | 'en' => {
    const bulgarianPattern = /[а-яА-Я]/;
    return bulgarianPattern.test(text) ? 'bg' : 'en';
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Add user message
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      aiAnalytics.trackMessageSent(content);

      // Analyze intent
      const intent = skillRouter.analyzeIntent(content);
      
      // Get emotional context
      const emotion = emotionalIntelligence.detectEmotion(content);
      const empathyModifier = emotionalIntelligence.getEmpathyModifier(emotion.emotion, 0.8);

      // Search relevant products
      const searchResults = vectorSearch.search(content);
      const relevantProducts = searchResults.map(r => r.product);
      setSuggestedProducts(relevantProducts);

      // Build prompt
      const prompt = promptBuilder.buildPrompt({
        conversation: { 
          id: uuidv4(), 
          messages: [...messages, userMessage], 
          context: { userIntent: intent, conversationStage: 'discovery' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {
            messageCount: messages.length + 2,
            convertedToQuote: false,
            convertedToPurchase: false,
          },
        },
        userContext: initialUserContext || { sessionId: '', visitCount: 1, firstVisit: Date.now(), lastVisit: Date.now(), viewedProducts: [], searchHistory: [], preferences: { priority: 'price', timeline: 'planning' }, consent: { given: false, timestamp: Date.now(), version: '1.0', dataTypes: [] }, device: { type: 'desktop', viewport: { width: 1920, height: 1080 }, touch: false, language: 'bg' } },
        relevantProducts,
        emotion: emotion.emotion,
      });

      // Get AI response
      const userPrompt: Message = { id: uuidv4(), role: 'user', content: prompt, timestamp: Date.now() };
      const response = await geminiClient.sendMessage([userPrompt]);

      // Validate response
      const validation = hallucinationGuard.validateResponse(response.content);
      
      let finalContent = response.content;
      if (!validation.isValid) {
        finalContent = response.content + '\n\n[Внимание: Този отговор може да съдържа неточности.]';
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: finalContent,
        timestamp: Date.now(),
        metadata: {
          products: relevantProducts,
          emotion: emotion.emotion,
          intent: intent.type,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
      aiAnalytics.trackMessageReceived(finalContent, response.usage?.totalTokens || 0);

      // Generate actions
      const newActions: AIAction[] = [];
      if (relevantProducts.length > 0) {
        newActions.push({
          type: 'view_product',
          payload: { productId: relevantProducts[0].id },
          label: `Виж ${relevantProducts[0].name}`,
        });
      }
      setActions(newActions);

      // Update conversation
      setConversation({
        id: conversation?.id || uuidv4(),
        messages: [...messages, userMessage, assistantMessage],
        userContext: initialUserContext || { visitCount: 1 },
        stage: intent.type === 'quote_request' ? 'quote_generation' : 'discovery',
        lastMessageAt: Date.now(),
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Грешка при изпращане';
      setError(errorMessage);
      aiAnalytics.trackError(errorMessage);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [apiKey, messages, conversation, initialUserContext, scrollToBottom, detectLanguage]);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setConversation(null);
    setSuggestedProducts([]);
    setActions([]);
    setError(null);
    aiAnalytics.clearEvents();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

export default useAIChat;
