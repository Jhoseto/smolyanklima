/**
 * AI Assistant Core
 * Core functionality for AI operations
 */

export { GeminiClient, getGeminiClient, resetGeminiClient } from './GeminiClient';
export { PromptBuilder, promptBuilder } from './PromptBuilder';
export { SkillRouter, skillRouter } from './SkillRouter';
export { EmotionalIntelligence, emotionalIntelligence } from './EmotionalIntelligence';

export type { GeminiConfig } from './GeminiClient';
