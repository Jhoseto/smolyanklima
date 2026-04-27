/**
 * useUserContext.ts
 * User profiling hook за AI Assistant
 */

import { useState, useEffect, useCallback } from 'react';
import type { UserContext, UserPreferences, RoomType } from '../types';

interface UseUserContextReturn {
  userContext: UserContext | null;
  isLoading: boolean;
  error: string | null;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  addViewedProduct: (productId: string) => void;
  addSearchQuery: (query: string) => void;
  clearContext: () => void;
}

/**
 * Hook for managing user context
 */
export function useUserContext(): UseUserContextReturn {
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const loadContext = () => {
      try {
        if (typeof window === 'undefined') {
          setIsLoading(false);
          return;
        }

        const stored = localStorage.getItem('ai_user_context');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUserContext(parsed);
        } else {
          // Create default context
          const defaultContext: UserContext = {
            sessionId: generateSessionId(),
            visitCount: 1,
            firstVisit: Date.now(),
            lastVisit: Date.now(),
            viewedProducts: [],
            searchHistory: [],
            preferences: {
              priority: 'price',
              timeline: 'planning',
            },
            consent: {
              given: false,
              timestamp: Date.now(),
              version: '1.0',
              dataTypes: [],
            },
            device: detectDevice(),
          };
          setUserContext(defaultContext);
          saveContext(defaultContext);
        }
      } catch (err) {
        setError('Failed to load user context');
        console.error('Error loading user context:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadContext();
  }, []);

  // Save context to localStorage
  const saveContext = useCallback((context: UserContext) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_user_context', JSON.stringify(context));
    }
  }, []);

  // Update user preferences
  const updatePreferences = useCallback(
    (preferences: Partial<UserPreferences>) => {
      setUserContext((prev) => {
        if (!prev) return null;

        const updated: UserContext = {
          ...prev,
          preferences: {
            ...prev.preferences,
            ...preferences,
          },
          lastVisit: Date.now(),
        };

        saveContext(updated);
        return updated;
      });
    },
    [saveContext]
  );

  // Add viewed product
  const addViewedProduct = useCallback(
    (productId: string) => {
      setUserContext((prev) => {
        if (!prev) return null;

        const viewedProducts = [...prev.viewedProducts];
        if (!viewedProducts.includes(productId)) {
          viewedProducts.push(productId);
        }

        const updated: UserContext = {
          ...prev,
          viewedProducts,
          lastVisit: Date.now(),
        };

        saveContext(updated);
        return updated;
      });
    },
    [saveContext]
  );

  // Add search query
  const addSearchQuery = useCallback(
    (query: string) => {
      setUserContext((prev) => {
        if (!prev) return null;

        const searchHistory = [...prev.searchHistory];
        searchHistory.push(query);

        // Keep only last 20 searches
        if (searchHistory.length > 20) {
          searchHistory.shift();
        }

        const updated: UserContext = {
          ...prev,
          searchHistory,
          lastVisit: Date.now(),
        };

        saveContext(updated);
        return updated;
      });
    },
    [saveContext]
  );

  // Clear context
  const clearContext = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ai_user_context');
    }
    setUserContext(null);
  }, []);

  return {
    userContext,
    isLoading,
    error,
    updatePreferences,
    addViewedProduct,
    addSearchQuery,
    clearContext,
  };
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Detect user device info
 */
function detectDevice() {
  const isClient = typeof window !== 'undefined';

  if (!isClient) {
    return {
      type: 'desktop' as const,
      viewport: { width: 1920, height: 1080 },
      touch: false,
      language: 'bg',
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  let type: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (width < 768) {
    type = 'mobile';
  } else if (width < 1024) {
    type = 'tablet';
  }

  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const language = navigator.language.split('-')[0] || 'bg';

  return {
    type,
    viewport: { width, height },
    touch,
    language,
  };
}

export default useUserContext;
