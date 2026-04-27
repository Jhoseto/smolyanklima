/**
 * useAIChat Hook
 * Main hook for managing AI conversation state and logic
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getGeminiClient } from '../core/GeminiClient';
import { promptBuilder } from '../core/PromptBuilder';
import { skillRouter } from '../core/SkillRouter';
import { emotionalIntelligence } from '../core/EmotionalIntelligence';
import { createHallucinationGuard } from '../security/HallucinationGuard';
import type {
  Message,
  Conversation,
  ConversationContext,
  UserContext,
  Product,
  AIAction,
  UserIntent,
} from '../types';

// Mock product database - should be replaced with real data from data/db.ts
const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Daikin Perfera FTXM25R/RXM25R',
    brand: 'Daikin',
    model: 'FTXM25R',
    price: 1299,
    oldPrice: 1499,
    image: '/products/daikin-perfera.jpg',
    specs: {
      power: '9000 BTU',
      coolingCapacity: 2.5,
      heatingCapacity: 3.2,
      noiseLevel: 19,
      energyEfficiency: 6.5,
      coverage: 20,
    },
    features: ['Wi-Fi control', 'Quiet operation', 'Energy efficient'],
    inStock: true,
    stockCount: 5,
    rating: 4.8,
    reviewCount: 127,
    energyClass: 'A+++',
    warranty: { years: 3, compressor: 5, parts: 3, labor: 2 },
    suitableFor: ['bedroom', 'living'],
    popularityScore: 95,
  },
  {
    id: '2',
    name: 'Mitsubishi MSZ-LN25VG',
    brand: 'Mitsubishi',
    model: 'MSZ-LN25VG',
    price: 1599,
    image: '/products/mitsubishi-ln.jpg',
    specs: {
      power: '9000 BTU',
      coolingCapacity: 2.5,
      heatingCapacity: 3.4,
      noiseLevel: 18,
      energyEfficiency: 7.2,
      coverage: 20,
    },
    features: ['Plasma filter', '3D auto airflow', 'Silent mode'],
    inStock: true,
    stockCount: 3,
    rating: 4.9,
    reviewCount: 89,
    energyClass: 'A+++',
    warranty: { years: 3, compressor: 5, parts: 3, labor: 2 },
    suitableFor: ['bedroom', 'living', 'kids'],
    popularityScore: 92,
  },
];

export interface UseAIChatOptions {
  apiKey: string;
  userContext?: Partial<UserContext>;
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
  const { apiKey } = options;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [actions, setActions] = useState<AIAction[]>([]);
  
  const geminiClient = useRef(getGeminiClient(apiKey));
  const hallucinationGuard = useRef(createHallucinationGuard(MOCK_PRODUCTS));
  
  // Initialize conversation on first load
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

    setIsLoading(true);
    setError(null);
    setSuggestedProducts([]);
    setActions([]);

    try {
      // Create user message
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // Update messages immediately
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // Analyze intent
      const intent = skillRouter.analyzeIntent(content);
      
      // Detect emotion
      const emotionDetection = emotionalIntelligence.detectEmotion(content);
      
      // Update conversation context
      const updatedConversation: Conversation = {
        ...conversation,
        messages: updatedMessages,
        context: {
          ...conversation.context,
          userIntent: intent.type,
          emotionalState: emotionDetection.confidence > 0.3 ? emotionDetection.emotion : conversation.context.emotionalState,
          conversationStage: determineConversationStage(intent, conversation.context.conversationStage),
        },
        updatedAt: Date.now(),
        metadata: {
          ...conversation.metadata,
          messageCount: updatedMessages.length,
        },
      };
      
      setConversation(updatedConversation);

      // Build system prompt with context
      const systemPrompt = promptBuilder.buildPrompt({
        conversation: updatedConversation,
        userContext: options.userContext as UserContext || {
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
        relevantProducts: MOCK_PRODUCTS.slice(0, 3),
        userIntent: intent.type,
        emotion: emotionDetection.confidence > 0.3 ? emotionDetection.emotion : undefined,
      });

      // Call Gemini API
      const response = await geminiClient.current.sendMessage(
        updatedMessages,
        systemPrompt
      );

      // Validate response with hallucination guard
      const validationResult = hallucinationGuard.current.validateResponse(response.content);
      
      let finalContent = response.content;
      
      if (!validationResult.isValid && validationResult.correctedContent) {
        finalContent = validationResult.correctedContent;
        console.warn('Response corrected by hallucination guard:', validationResult.violations);
      }

      // Apply emotional intelligence
      finalContent = emotionalIntelligence.applyMirroring(updatedMessages, finalContent);
      
      // Add empathy modifier if emotion detected
      if (emotionDetection.confidence > 0.3) {
        const empathyModifier = emotionalIntelligence.getEmpathyModifier(
          emotionDetection.emotion,
          emotionDetection.confidence
        );
        if (empathyModifier && !finalContent.toLowerCase().includes(empathyModifier.toLowerCase())) {
          finalContent = `${empathyModifier}\n\n${finalContent}`;
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
      const extractedProducts = extractProductsFromResponse(finalContent, MOCK_PRODUCTS);
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
      emotionalIntelligence.updateWarmth(conversation.id, aiMessage);

    } catch (err) {
      console.error('AI Chat Error:', err);
      setError('Възникна грешка. Моля, опитайте отново или се свържете с нас на телефон.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, conversation, options.userContext]);

  // Reset conversation
  const resetConversation = useCallback(() => {
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
