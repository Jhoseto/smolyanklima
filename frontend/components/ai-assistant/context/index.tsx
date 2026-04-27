/**
 * AI Assistant Context
 * React context providers for AI state management
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Conversation, UserContext, Message } from '../types';

interface AIContextType {
  conversation: Conversation | null;
  userContext: UserContext | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  setConversation: (conversation: Conversation) => void;
  setUserContext: (context: UserContext) => void;
  addMessage: (message: Message) => void;
  clearConversation: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearConversation = useCallback(() => {
    setConversation(null);
    setMessages([]);
    setError(null);
  }, []);

  const value: AIContextType = {
    conversation,
    userContext,
    messages,
    isLoading,
    error,
    setConversation,
    setUserContext,
    addMessage,
    clearConversation,
    setLoading: setIsLoading,
    setError,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export const useAIContext = (): AIContextType => {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAIContext must be used within an AIProvider');
  }
  return context;
};

export default AIContext;
