/**
 * useCrossTabSync Hook
 * Synchronize chat state across browser tabs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message, Conversation, CrossTabMessage } from '../types';

export interface UseCrossTabSyncOptions {
  conversationId: string | null;
  onExternalMessage?: (message: Message) => void;
}

export interface UseCrossTabSyncReturn {
  syncState: (state: Partial<Conversation>) => void;
  lastSyncMessage: CrossTabMessage | null;
  isSynced: boolean;
}

const BROADCAST_CHANNEL_NAME = 'smolyan-klima-ai-chat';

export function useCrossTabSync(options: UseCrossTabSyncOptions): UseCrossTabSyncReturn {
  const { conversationId, onExternalMessage } = options;
  const [lastSyncMessage, setLastSyncMessage] = useState<CrossTabMessage | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>(generateTabId());

  // Initialize BroadcastChannel
  useEffect(() => {
    if (!conversationId) return;

    // Check if BroadcastChannel is supported
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('BroadcastChannel not supported in this browser');
      return;
    }

    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannelRef.current = channel;

      // Listen for messages
      channel.onmessage = (event: MessageEvent) => {
        const message: CrossTabMessage = event.data;
        
        // Ignore messages from self
        if (message.tabId === tabIdRef.current) return;

        setLastSyncMessage(message);

        // Handle different message types
        switch (message.type) {
          case 'CHAT_STATE_UPDATE':
            // Chat state was updated in another tab
            setIsSynced(true);
            break;

          case 'CONVERSATION_SYNC':
            // New conversation message
            if (message.payload && typeof message.payload === 'object') {
              const msg = message.payload as Message;
              onExternalMessage?.(msg);
            }
            break;

          case 'USER_CONTEXT_UPDATE':
            // User context updated
            setIsSynced(true);
            break;
        }
      };

      // Cleanup
      return () => {
        channel.close();
        broadcastChannelRef.current = null;
      };
    } catch (error) {
      console.error('BroadcastChannel initialization error:', error);
    }
  }, [conversationId, onExternalMessage]);

  // Sync state to other tabs
  const syncState = useCallback((state: Partial<Conversation>) => {
    if (!broadcastChannelRef.current || !conversationId) return;

    const message: CrossTabMessage = {
      type: 'CHAT_STATE_UPDATE',
      payload: state,
      timestamp: Date.now(),
      tabId: tabIdRef.current,
    };

    try {
      broadcastChannelRef.current.postMessage(message);
    } catch (error) {
      console.error('Failed to sync state:', error);
    }
  }, [conversationId]);

  // Sync a new message to other tabs
  const syncMessage = useCallback((message: Message) => {
    if (!broadcastChannelRef.current || !conversationId) return;

    const syncMsg: CrossTabMessage = {
      type: 'CONVERSATION_SYNC',
      payload: message,
      timestamp: Date.now(),
      tabId: tabIdRef.current,
    };

    try {
      broadcastChannelRef.current.postMessage(syncMsg);
    } catch (error) {
      console.error('Failed to sync message:', error);
    }
  }, [conversationId]);

  return {
    syncState,
    lastSyncMessage,
    isSynced,
  };
}

// Generate unique tab ID
function generateTabId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Fallback storage mechanism for browsers without BroadcastChannel
export function useStorageSync(conversationId: string | null): {
  syncToStorage: (data: unknown) => void;
  getFromStorage: () => unknown;
} {
  const storageKey = `smolyan-klima-chat-${conversationId}`;

  const syncToStorage = useCallback((data: unknown) => {
    if (!conversationId) return;
    
    try {
      const serialized = JSON.stringify({
        data,
        timestamp: Date.now(),
        tabId: generateTabId(),
      });
      localStorage.setItem(storageKey, serialized);
    } catch (error) {
      console.error('Failed to sync to storage:', error);
    }
  }, [conversationId, storageKey]);

  const getFromStorage = useCallback(() => {
    if (!conversationId) return null;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      return parsed.data;
    } catch (error) {
      console.error('Failed to get from storage:', error);
      return null;
    }
  }, [conversationId, storageKey]);

  return { syncToStorage, getFromStorage };
}

export default useCrossTabSync;
