/**
 * useConversation.ts
 * Conversation memory hook за AI Assistant
 */

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Message, Conversation, ConversationContext, UserContext } from '../types';

interface UseConversationOptions {
  userContext?: UserContext;
  maxMessages?: number;
}

interface UseConversationReturn {
  conversation: Conversation | null;
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateContext: (context: Partial<ConversationContext>) => void;
  clearConversation: () => void;
  getRecentMessages: (count?: number) => Message[];
  getConversationStage: () => string;
}

const STORAGE_KEY = 'ai_conversation';

/**
 * Hook for managing conversation state
 */
export function useConversation(options: UseConversationOptions = {}): UseConversationReturn {
  const { userContext, maxMessages = 50 } = options;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const loadConversation = () => {
      try {
        if (typeof window === 'undefined') return;

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setConversation(parsed.conversation);
          setMessages(parsed.messages || []);
        } else {
          // Create new conversation
          const newConversation = createNewConversation(userContext);
          setConversation(newConversation);
          saveConversation(newConversation, []);
        }
      } catch (err) {
        console.error('Error loading conversation:', err);
        // Create fresh conversation on error
        const newConversation = createNewConversation(userContext);
        setConversation(newConversation);
      }
    };

    loadConversation();
  }, [userContext]);

  // Save conversation to localStorage
  const saveConversation = useCallback(
    (conv: Conversation, msgs: Message[]) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          conversation: conv,
          messages: msgs,
          savedAt: Date.now(),
        }));
      }
    },
    []
  );

  // Add message to conversation
  const addMessage = useCallback(
    (message: Omit<Message, 'id' | 'timestamp'>) => {
      const newMessage: Message = {
        ...message,
        id: uuidv4(),
        timestamp: Date.now(),
      };

      setMessages((prev) => {
        const updated = [...prev, newMessage];

        // Keep only last maxMessages
        if (updated.length > maxMessages) {
          updated.shift();
        }

        // Update conversation with new message
        setConversation((conv) => {
          if (!conv) return null;

          const updatedConv: Conversation = {
            ...conv,
            messages: updated,
            lastMessageAt: Date.now(),
            updatedAt: Date.now(),
            metadata: {
              ...conv.metadata,
              messageCount: updated.length,
            },
          };

          saveConversation(updatedConv, updated);
          return updatedConv;
        });

        return updated;
      });
    },
    [maxMessages, saveConversation]
  );

  // Update conversation context
  const updateContext = useCallback(
    (contextUpdate: Partial<ConversationContext>) => {
      setConversation((prev) => {
        if (!prev) return null;

        const updated: Conversation = {
          ...prev,
          context: {
            ...prev.context,
            ...contextUpdate,
          },
          updatedAt: Date.now(),
        };

        saveConversation(updated, messages);
        return updated;
      });
    },
    [messages, saveConversation]
  );

  // Clear conversation
  const clearConversation = useCallback(() => {
    const newConversation = createNewConversation(userContext);
    setConversation(newConversation);
    setMessages([]);
    saveConversation(newConversation, []);
  }, [userContext, saveConversation]);

  // Get recent messages
  const getRecentMessages = useCallback(
    (count: number = 10) => {
      return messages.slice(-count);
    },
    [messages]
  );

  // Get current conversation stage
  const getConversationStage = useCallback(() => {
    if (!conversation) return 'greeting';
    return conversation.context?.conversationStage || 'greeting';
  }, [conversation]);

  return {
    conversation,
    messages,
    addMessage,
    updateContext,
    clearConversation,
    getRecentMessages,
    getConversationStage,
  };
}

/**
 * Create new conversation
 */
function createNewConversation(userContext?: UserContext): Conversation {
  const now = Date.now();

  return {
    id: uuidv4(),
    messages: [],
    context: {
      conversationStage: 'greeting',
    },
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    metadata: {
      messageCount: 0,
      convertedToQuote: false,
      convertedToPurchase: false,
    },
  };
}

export default useConversation;
