/**
 * ComparisonSkill.ts
 * Сравнение на продукти
 */

import type { IntentType, Product, SkillResult, SkillContext } from '../types';
import { aiAnalytics } from '../analytics';

export class ComparisonSkill {
  public name = 'ComparisonSkill';
  public description = 'Сравнява продукти и показва разлики';
  public triggers: IntentType[] = ['product_comparison', 'compare'];
  public priority = 7;

  /**
   * Execute product comparison
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const { products, userContext } = context;

    if (products.length < 2) {
      return {
        success: false,
        response: 'За сравнение ми трябват поне 2 продукта. Искате ли да изберете друг модел за сравнение?',
        confidence: 0.3,
      };
    }

    try {
      // Track comparison
      aiAnalytics.track('product_comparison', {
        productIds: products.map(p => p.id),
        productCount: products.length,
      });

      // Build comparison response
      const response = this.buildComparison(products.slice(0, 3));

      return {
        success: true,
        response,
        products,
        confidence: 0.9,
      };
    } catch (error) {
      console.error('ComparisonSkill error:', error);
      return {
        success: false,
        response: 'Съжалявам, имаше проблем при сравнението. Опитайте отново или се свържете с нас.',
        confidence: 0,
      };
    }
  }

  /**
   * Build comparison table
   */
  private buildComparison(products: Product[]): string {
    if (products.length === 2) {
      const [p1, p2] = products;
      
      return `📊 **Сравнение: ${p1.name} vs ${p2.name}**\n\n` +
        `**Цена:**\n` +
        `• ${p1.name}: ${p1.price} лв ${p1.oldPrice ? `(от ${p1.oldPrice} лв)` : ''}\n` +
        `• ${p2.name}: ${p2.price} лв ${p2.oldPrice ? `(от ${p2.oldPrice} лв)` : ''}\n\n` +
        `**Покритие:**\n` +
        `• ${p1.name}: до ${p1.specs.coverage}м²\n` +
        `• ${p2.name}: до ${p2.specs.coverage}м²\n\n` +
        `**Енергийна ефективност:**\n` +
        `• ${p1.name}: ${p1.energyClass} (SEER: ${p1.specs.seer})\n` +
        `• ${p2.name}: ${p2.energyClass} (SEER: ${p2.specs.seer})\n\n` +
        `**Шум:**\n` +
        `• ${p1.name}: ${p1.specs.noiseLevel} dB\n` +
        `• ${p2.name}: ${p2.specs.noiseLevel} dB\n\n` +
        `**Особености:**\n` +
        `• ${p1.name}: ${p1.features.slice(0, 3).join(', ')}\n` +
        `• ${p2.name}: ${p2.features.slice(0, 3).join(', ')}\n\n` +
        `**Препоръка:** ${this.getRecommendation(p1, p2)}`;
    }

    // For 3+ products, create summary
    return `📊 **Сравнение на ${products.length} модела**\n\n` +
      products.map((p, i) => 
        `${i + 1}. **${p.name}** - ${p.price} лв\n` +
        `   • ${p.energyClass} клас, ${p.specs.coverage}м², ${p.specs.noiseLevel}dB\n` +
        `   • ${p.features.slice(0, 2).join(', ')}`
      ).join('\n\n') +
      `\n\nИскате ли детайлно сравнение между два от тях?`;
  }

  /**
   * Get recommendation based on comparison
   */
  private getRecommendation(p1: Product, p2: Product): string {
    const p1Value = p1.specs.seer / p1.price;
    const p2Value = p2.specs.seer / p2.price;
    
    if (p1Value > p2Value * 1.2) {
      return `${p1.name} дава по-добро съотношение цена/качество с ${p1.energyClass} клас и по-нисък шум.`;
    } else if (p2Value > p1Value * 1.2) {
      return `${p2.name} дава по-добро съотношение цена/качество с ${p2.energyClass} клас и по-нисък шум.`;
    } else {
      return `И двата модела са отлични. Изборът зависи от приоритетите Ви - ${p1.specs.noiseLevel < p2.specs.noiseLevel ? p1.name + ' е по-тих' : p2.name + ' е по-тих'}.`;
    }
  }

  /**
   * Check if this skill can handle the intent
   */
  canHandle(intent: string): boolean {
    return this.triggers.includes(intent as IntentType);
  }

}

// Export singleton
export const comparisonSkill = new ComparisonSkill();
export default comparisonSkill;
