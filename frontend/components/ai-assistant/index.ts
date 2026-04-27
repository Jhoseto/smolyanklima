/**
 * AI Assistant Components
 * Smart HVAC sales assistant with psychological triggers
 */

// Main Component
export { AIChatWidget } from './ui/AIChatWidget';
export type { AIChatWidgetProps } from './ui/AIChatWidget';

// UI Components
export { ChatMessage } from './ui/ChatMessage';
export { QuickReplyButtons } from './ui/QuickReplyButtons';
export { TypingIndicator } from './ui/TypingIndicator';
export { ProductCard } from './ui/ProductCard';
export { PrivacyConsent } from './ui/PrivacyConsent';
export { AIErrorBoundary } from './ui/ErrorBoundary';

// Hooks
export { useCrossTabSync } from './hooks/useCrossTabSync';
export { useAIIntegration, trackProductView, trackAddToCart, trackSearchQuery, trackPageContext } from './hooks/useAIIntegration';
export { useProducts } from './hooks/useProducts';
export { useUserContext } from './hooks/useUserContext';
export { useConversation } from './hooks/useConversation';

// Services
export { VectorSearchService, getVectorSearchService, resetVectorSearchService } from './services/vectorSearch';

// Security
export { HallucinationGuard, createHallucinationGuard } from './security/HallucinationGuard';

// Analytics
export { AIAnalytics, aiAnalytics } from './analytics';

// Skills
export {
  ProductSearchSkill,
  productSearchSkill,
  ComparisonSkill,
  comparisonSkill,
  QuoteGenerationSkill,
  quoteGenerationSkill,
  ObjectionHandlingSkill,
  objectionHandlingSkill,
  HandoffSkill,
  handoffSkill,
} from './skills';

// Knowledge Base
export { default as HVAC_EXPERTISE } from './knowledge-base/hvac-expertise';
export { default as SALES_PLAYBOOK } from './knowledge-base/sales-playbook';
export {
  PRODUCT_EMBEDDINGS,
  cosineSimilarity,
  generateEmbedding,
  findSimilarProducts,
  precomputeProductEmbeddings,
} from './knowledge-base/product-embeddings';
export {
  getAllProducts,
  getProductById,
  getProductsByBrand,
  getProductsByRoomType,
  getProductsByCoverage,
  getProductsByBudget,
  searchProducts,
  getPopularProducts,
  getProductsOnSale,
} from './knowledge-base/product-database';

// Context
export { AIProvider, useAIContext } from './context';

// Utilities
export { sanitizeInput, escapeHtml, formatPrice, generateId, debounce, throttle, isClient, now, formatDate, truncateText } from './utils';

// Core
export { GeminiClient, getGeminiClient, resetGeminiClient } from './core/GeminiClient';
export { PromptBuilder, promptBuilder } from './core/PromptBuilder';
export { SkillRouter, skillRouter } from './core/SkillRouter';
export { EmotionalIntelligence, emotionalIntelligence } from './core/EmotionalIntelligence';
export { AIChatProvider, useAIChatContext } from './core/AIChatProvider';
export { useAIChat } from './core/useAIChat';
export * from './core/user-context';

// Types
export type {
  Message,
  Conversation,
  UserIntent,
  Skill,
  Product,
  EmotionType,
  QuickReply,
  ChatWidgetConfig,
  ConversationContext,
  UserContext,
  AIAction,
  UseAIChatOptions,
  UseAIChatReturn,
  SkillContext,
  SkillResult,
} from './types';

// Default export
export { default } from './ui/AIChatWidget';
