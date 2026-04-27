/**
 * AIChatProvider.tsx
 * Context provider + global state for AI Assistant
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Message, Conversation, UserContext, Product } from '../types';

const STORAGE_KEYS = {
  messages: 'ai_chat_messages_v2',
  conversation: 'ai_chat_conversation_v2',
  userContext: 'ai_chat_user_context_v2',
  consent: 'ai_chat_privacy_consent_v1',
} as const;

const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_STORED_MESSAGES = 50;

function hasStorageConsent(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const raw = localStorage.getItem(STORAGE_KEYS.consent);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { given?: boolean; timestamp?: number };
    if (parsed?.given !== true) return false;
    if (typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp > STORAGE_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

function purgeIfExpired<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { data?: T; savedAt?: number };
    if (!parsed || typeof parsed !== 'object') return null;
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0;
    if (!savedAt || Date.now() - savedAt > STORAGE_TTL_MS) return null;
    return (parsed.data ?? null) as T | null;
  } catch {
    return null;
  }
}

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
    if (typeof window !== 'undefined' && hasStorageConsent()) {
      const existing = purgeIfExpired<Message[]>(localStorage.getItem(STORAGE_KEYS.messages)) || [];
      const next = [...existing, message].slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify({ data: next, savedAt: Date.now() }));
    }
  }, []);

  const updateConversation = useCallback((conv: Conversation) => {
    setConversation(conv);
    
    if (typeof window !== 'undefined' && hasStorageConsent()) {
      localStorage.setItem(STORAGE_KEYS.conversation, JSON.stringify({ data: conv, savedAt: Date.now() }));
    }
  }, []);

  const setUserContext = useCallback((context: UserContext) => {
    setUserContextState(context);
    
    if (typeof window !== 'undefined' && hasStorageConsent()) {
      localStorage.setItem(STORAGE_KEYS.userContext, JSON.stringify({ data: context, savedAt: Date.now() }));
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
      localStorage.removeItem(STORAGE_KEYS.messages);
      localStorage.removeItem(STORAGE_KEYS.conversation);
    }
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Load persisted state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedMessages = localStorage.getItem(STORAGE_KEYS.messages);
      const storedConversation = localStorage.getItem(STORAGE_KEYS.conversation);
      const storedUserContext = localStorage.getItem(STORAGE_KEYS.userContext);
      
      if (storedMessages) {
        try {
          const msgs = purgeIfExpired<Message[]>(storedMessages);
          if (msgs) setMessages(msgs);
          else localStorage.removeItem(STORAGE_KEYS.messages);
        } catch (e) {
          console.error('Failed to parse stored messages', e);
        }
      }
      
      if (storedConversation) {
        try {
          const conv = purgeIfExpired<Conversation>(storedConversation);
          if (conv) setConversation(conv);
          else localStorage.removeItem(STORAGE_KEYS.conversation);
        } catch (e) {
          console.error('Failed to parse stored conversation', e);
        }
      }
      
      if (storedUserContext && !initialUserContext) {
        try {
          const ctx = purgeIfExpired<UserContext>(storedUserContext);
          if (ctx) setUserContextState(ctx);
          else localStorage.removeItem(STORAGE_KEYS.userContext);
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
