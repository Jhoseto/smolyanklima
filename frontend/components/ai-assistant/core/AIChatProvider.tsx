/**
 * AIChatProvider.tsx
 * Context provider + global state for AI Assistant
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Message, Conversation, UserContext, Product } from '../types';

interface AIChatContextType {
  // State
  messages: Message[];
  conversation: Conversation | null;
  userContext: UserContext | null;
  isLoading: boolean;
  error: string | null;
  suggestedProducts: Product[];
  
  // Actions
  addMessage: (message: Message) => void;
  updateConversation: (conversation: Conversation) => void;
  setUserContext: (context: UserContext) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuggestedProducts: (products: Product[]) => void;
  clearConversation: () => void;
  resetError: () => void;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

interface AIChatProviderProps {
  children: React.ReactNode;
  initialUserContext?: Partial<UserContext>;
}

export const AIChatProvider: React.FC<AIChatProviderProps> = ({ 
  children, 
  initialUserContext 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [userContext, setUserContextState] = useState<UserContext | null>(
    initialUserContext ? { ...initialUserContext } as UserContext : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ai_chat_messages');
      const existing = stored ? JSON.parse(stored) : [];
      localStorage.setItem('ai_chat_messages', JSON.stringify([...existing, message]));
    }
  }, []);

  const updateConversation = useCallback((conv: Conversation) => {
    setConversation(conv);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_chat_conversation', JSON.stringify(conv));
    }
  }, []);

  const setUserContext = useCallback((context: UserContext) => {
    setUserContextState(context);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_chat_user_context', JSON.stringify(context));
    }
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const setSuggestedProductsCallback = useCallback((products: Product[]) => {
    setSuggestedProducts(products);
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversation(null);
    setSuggestedProducts([]);
    setError(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ai_chat_messages');
      localStorage.removeItem('ai_chat_conversation');
    }
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Load persisted state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedMessages = localStorage.getItem('ai_chat_messages');
      const storedConversation = localStorage.getItem('ai_chat_conversation');
      const storedUserContext = localStorage.getItem('ai_chat_user_context');
      
      if (storedMessages) {
        try {
          setMessages(JSON.parse(storedMessages));
        } catch (e) {
          console.error('Failed to parse stored messages', e);
        }
      }
      
      if (storedConversation) {
        try {
          setConversation(JSON.parse(storedConversation));
        } catch (e) {
          console.error('Failed to parse stored conversation', e);
        }
      }
      
      if (storedUserContext && !initialUserContext) {
        try {
          setUserContextState(JSON.parse(storedUserContext));
        } catch (e) {
          console.error('Failed to parse stored user context', e);
        }
      }
    }
  }, [initialUserContext]);

  const value: AIChatContextType = {
    messages,
    conversation,
    userContext,
    isLoading,
    error,
    suggestedProducts,
    addMessage,
    updateConversation,
    setUserContext,
    setLoading,
    setError,
    setSuggestedProducts: setSuggestedProductsCallback,
    clearConversation,
    resetError,
  };

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
};

export const useAIChatContext = (): AIChatContextType => {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error('useAIChatContext must be used within an AIChatProvider');
  }
  return context;
};

export default AIChatProvider;
