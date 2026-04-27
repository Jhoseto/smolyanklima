/**
 * AI Assistant Hooks
 * React hooks for AI functionality
 */

export { useCrossTabSync } from './useCrossTabSync';
export { useAIIntegration, trackProductView, trackAddToCart, trackSearchQuery, trackPageContext } from './useAIIntegration';
export { useProducts } from './useProducts';
export { useUserContext } from './useUserContext';
export { useConversation } from './useConversation';

export type { UseCrossTabSyncOptions, UseCrossTabSyncReturn } from './useCrossTabSync';
export type { UseAIIntegrationOptions, UseAIIntegrationReturn } from './useAIIntegration';
