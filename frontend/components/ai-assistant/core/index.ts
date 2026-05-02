/**
 * AI Assistant Core
 * Core functionality for AI operations
 */

// GeminiClient NOT re-exported — browser key exposure risk; use /api/ai/chat server proxy only
export { PromptBuilder, promptBuilder } from './PromptBuilder';
export { SkillRouter, skillRouter } from './SkillRouter';
export { EmotionalIntelligence, emotionalIntelligence } from './EmotionalIntelligence';
