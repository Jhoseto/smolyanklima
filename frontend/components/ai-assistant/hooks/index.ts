/**
 * AI Assistant Hooks
 * React hooks for AI functionality
 */

export { useCrossTabSync } from './useCrossTabSync';
export { useAIIntegration, trackProductView, trackAddToCart, trackSearchQuery, trackPageContext } from './useAIIntegration';
export { useUserContext } from './useUserContext';
export { useConversation } from './useConversation';
export { useAIChat } from './useAIChat';

export type { UseCrossTabSyncOptions, UseCrossTabSyncReturn } from './useCrossTabSync';
export type { UseAIIntegrationOptions, UseAIIntegrationReturn } from './useAIIntegration';
export type { UseAIChatOptions, UseAIChatReturn } from './useAIChat';
