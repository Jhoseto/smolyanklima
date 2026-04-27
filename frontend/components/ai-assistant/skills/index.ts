/**
 * AI Assistant Skills - Index
 * Re-exports all skills from individual files
 */

// Re-export from individual skill files
export { ProductSearchSkill, productSearchSkill } from './ProductSearchSkill';
export { ComparisonSkill, comparisonSkill } from './ComparisonSkill';
export { QuoteGenerationSkill, quoteGenerationSkill } from './QuoteGenerationSkill';
export { ObjectionHandlingSkill, objectionHandlingSkill } from './ObjectionHandlingSkill';
export { HandoffSkill, handoffSkill } from './HandoffSkill';

// Export skill registry
import type { Skill } from '../types';
import { productSearchSkill } from './ProductSearchSkill';
import { comparisonSkill } from './ComparisonSkill';
import { quoteGenerationSkill } from './QuoteGenerationSkill';
import { objectionHandlingSkill } from './ObjectionHandlingSkill';
import { handoffSkill } from './HandoffSkill';

export const skills: Skill[] = [
  productSearchSkill as Skill,
  comparisonSkill as Skill,
  quoteGenerationSkill as Skill,
  objectionHandlingSkill as Skill,
  handoffSkill as Skill,
];

export default skills;
