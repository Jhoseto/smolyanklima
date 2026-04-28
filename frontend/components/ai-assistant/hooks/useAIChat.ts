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
import { products as dbProducts } from '../../../data/db';
import type {
  Message,
  Conversation,
  ConversationContext,
  UserContext,
  Product,
  AIAction,
  UserIntent,
} from '../types';

// Transform data/db.ts products to AI assistant Product format
function transformDbProducts(): Product[] {
  return dbProducts.map((p) => {
    // Parse cooling power to extract numeric value
    const coolingMatch = p.coolingPower?.match(/([\d.]+)/);
    const coolingCapacity = coolingMatch ? parseFloat(coolingMatch[1]) : 2.5;
    
    // Parse heating power
    const heatingMatch = p.heatingPower?.match(/([\d.]+)/);
    const heatingCapacity = heatingMatch ? parseFloat(heatingMatch[1]) : 3.2;
    
    // Parse noise level
    const noiseMatch = p.noise?.match(/([\d]+)/);
    const noiseLevel = noiseMatch ? parseInt(noiseMatch[1]) : 25;
    
    // Parse area for coverage
    const areaMatch = p.area?.match(/([\d]+)/);
    const coverage = areaMatch ? parseInt(areaMatch[1]) : 25;
    
    // Map energy class to numeric efficiency
    const energyEfficiencyMap: Record<string, number> = {
      'A+++': 8.5,
      'A++': 7.5,
      'A+': 6.5,
      'A': 5.5,
      'B': 4.5,
    };
    const energyEfficiency = energyEfficiencyMap[p.energyCool || 'A'] || 6.5;
    
    // Map category to suitableFor
    const categoryToRoom: Record<string, ('bedroom' | 'living' | 'kids' | 'office' | 'kitchen' | 'other')[]> = {
      'Апартамент': ['bedroom', 'living'],
      'Къща': ['living', 'bedroom'],
      'Офис': ['office'],
      'Търговски': ['office'],
      'Аксесоари': ['other'],
      'Части': ['other'],
    };
    
    // Parse warranty
    const warrantyMatch = p.warranty?.match(/([\d]+)/);
    const warrantyYears = warrantyMatch ? parseInt(warrantyMatch[1]) : 2;
    
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      model: p.type || p.id,
      price: p.price,
      oldPrice: undefined,
      image: `/images/${p.id}.jpg`,
      description: p.description || '',
      specs: {
        power: p.coolingPower || '2.5 kW',
        coolingCapacity,
        heatingCapacity,
        noiseLevel,
        energyEfficiency,
        seer: energyEfficiency, // Use same value as placeholder
        coverage,
      },
      features: p.features || [],
      inStock: true,
      stockCount: 5,
      rating: 4.5,
      reviewCount: 10,
      energyClass: p.energyCool || 'A',
      warranty: {
        years: warrantyYears,
        compressor: warrantyYears + 2,
        parts: warrantyYears,
        labor: warrantyYears - 1,
      },
      suitableFor: categoryToRoom[p.category] || ['other'],
      popularityScore: 80,
    };
  });
}

const PRODUCTS: Product[] = transformDbProducts();
const MAX_USER_MESSAGE_CHARS = 1000;

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
  const hallucinationGuard = useRef(createHallucinationGuard(PRODUCTS));
  const messagesRef = useRef<Message[]>([]);
  const conversationRef = useRef<Conversation | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);
  
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
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_USER_MESSAGE_CHARS) {
      setError(`Съобщението е твърде дълго (макс. ${MAX_USER_MESSAGE_CHARS} символа).`);
      return;
    }

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
        relevantProducts: PRODUCTS,
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
      const extractedProducts = extractProductsFromResponse(finalContent, PRODUCTS);
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
