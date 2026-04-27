/**
 * useAIIntegration Hook
 * Integration with existing Smolyan Klima components
 */

import { useEffect, useCallback } from 'react';
import type { Product } from '../types';

export interface UseAIIntegrationOptions {
  onProductView?: (product: Product) => void;
  onAddToCompare?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onSocialProofTrigger?: () => void;
}

export interface UseAIIntegrationReturn {
  triggerSocialProof: (message: string) => void;
  suggestChatOnCompare: (productCount: number) => void;
  suggestChatOnProductView: (product: Product, duration: number) => void;
  suggestChatOnCart: (items: Product[]) => void;
  suggestChatOnBlogRead: (articleTitle: string) => void;
}

export function useAIIntegration(options: UseAIIntegrationOptions): UseAIIntegrationReturn {
  const { onProductView, onAddToCompare, onAddToCart, onSocialProofTrigger } = options;

  /**
   * Trigger social proof toast with chat link
   */
  const triggerSocialProof = useCallback((message: string) => {
    // This would integrate with SocialProofToast component
    const event = new CustomEvent('ai:socialProof', {
      detail: {
        message,
        showChatLink: true,
        chatMessage: 'Имате ли въпроси за този модел? Попитайте ме! 💬',
      },
    });
    window.dispatchEvent(event);
    
    onSocialProofTrigger?.();
  }, [onSocialProofTrigger]);

  /**
   * Suggest chat when user adds products to compare
   */
  const suggestChatOnCompare = useCallback((productCount: number) => {
    if (productCount >= 2) {
      const event = new CustomEvent('ai:suggestChat', {
        detail: {
          trigger: 'compare',
          message: 'Имате колебания между модели? Мога да Ви помогна да изберете! 🤔',
          delay: 2000,
        },
      });
      window.dispatchEvent(event);
    }
  }, []);

  /**
   * Suggest chat when user views product for a while
   */
  const suggestChatOnProductView = useCallback((product: Product, duration: number) => {
    if (duration > 30) { // After 30 seconds
      const event = new CustomEvent('ai:suggestChat', {
        detail: {
          trigger: 'productView',
          product,
          message: `Виждам, че разглеждате ${product.name}. Имате ли въпроси?`,
          delay: 0,
        },
      });
      window.dispatchEvent(event);
      
      onProductView?.(product);
    }
  }, [onProductView]);

  /**
   * Suggest chat on cart page
   */
  const suggestChatOnCart = useCallback((items: Product[]) => {
    if (items.length > 0) {
      const event = new CustomEvent('ai:suggestChat', {
        detail: {
          trigger: 'cart',
          message: 'Виждам, че сте избрали! Нуждаете ли се от помощ с монтажа? 🛠️',
          delay: 1000,
        },
      });
      window.dispatchEvent(event);
    }
  }, []);

  /**
   * Suggest chat on blog read
   */
  const suggestChatOnBlogRead = useCallback((articleTitle: string) => {
    const event = new CustomEvent('ai:suggestChat', {
      detail: {
        trigger: 'blog',
        message: `Имате ли въпроси след статията "${articleTitle}"?`,
        delay: 5000,
      },
    });
    window.dispatchEvent(event);
  }, []);

  return {
    triggerSocialProof,
    suggestChatOnCompare,
    suggestChatOnProductView,
    suggestChatOnCart,
    suggestChatOnBlogRead,
  };
}

// Utility functions for direct integration

/**
 * Track product view for AI context
 */
export function trackProductView(product: Product): void {
  const event = new CustomEvent('ai:trackProductView', {
    detail: { product },
  });
  window.dispatchEvent(event);
}

/**
 * Track add to cart for AI context
 */
export function trackAddToCart(product: Product): void {
  const event = new CustomEvent('ai:trackAddToCart', {
    detail: { product },
  });
  window.dispatchEvent(event);
}

/**
 * Track search query for AI context
 */
export function trackSearchQuery(query: string): void {
  const event = new CustomEvent('ai:trackSearch', {
    detail: { query },
  });
  window.dispatchEvent(event);
}

/**
 * Track page context for AI
 */
export function trackPageContext(page: string, context?: Record<string, unknown>): void {
  const event = new CustomEvent('ai:trackPageContext', {
    detail: { page, context },
  });
  window.dispatchEvent(event);
}

export default useAIIntegration;
