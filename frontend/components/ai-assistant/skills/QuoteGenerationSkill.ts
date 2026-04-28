/**
 * QuoteGenerationSkill.ts
 * Генериране на оферти
 */

import type { IntentType, Product, UserContext, SkillResult, SkillContext } from '../types';
import { aiAnalytics } from '../analytics';

export class QuoteGenerationSkill {
  public name = 'QuoteGenerationSkill';
  public description = 'Генерира оферти за климатици';
  public triggers: IntentType[] = ['quote_request', 'price_inquiry'];
  public priority = 9;

  /**
   * Execute quote generation
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const { products, userContext } = context;

    if (products.length === 0) {
      return {
        success: false,
        response: 'За да генерирам оферта, моля първо кажете ми за кой модел се интересувате или какви са Вашите нужди (площ, стая, бюджет).',
        confidence: 0.3,
      };
    }

    try {
      // Track quote generation
      aiAnalytics.track('conversion_quote', {
        productIds: products.map(p => p.id),
        totalValue: this.calculateTotal(products),
      });

      // Build quote
      const quote = this.buildQuote(products, userContext);

      return {
        success: true,
        response: quote,
        products,
        confidence: 0.9,
      };
    } catch (error) {
      console.error('QuoteGenerationSkill error:', error);
      return {
        success: false,
        response: 'Съжалявам, имаше проблем при генерирането на офертата. Моля, свържете се с нас на 0876 123 456 за персонална оферта.',
        confidence: 0,
      };
    }
  }

  /**
   * Build quote response
   */
  private buildQuote(products: Product[], userContext?: UserContext): string {
    const totalPrice = this.calculateTotal(products);
    const installationCost = this.calculateInstallation(products);
    const totalWithInstallation = totalPrice + installationCost;

    let quote = `📋 **ОФЕРТА**\n\n`;

    // Product details
    products.forEach((p, i) => {
      quote += `**${i + 1}. ${p.name}**\n`;
      quote += `   Модел: ${p.model}\n`;
      quote += `   Марка: ${p.brand}\n`;
      quote += `   Покритие: до ${p.specs.coverage}м²\n`;
      quote += `   Цена: **${p.price} €**${p.oldPrice ? ` (стара цена: ${p.oldPrice} €)` : ''}\n\n`;
    });

    // Installation
    quote += `**🛠️ Монтаж:** ${installationCost} €\n`;
    quote += `   (Включва: тръби, кабели, изолация, професионален монтаж)\n\n`;

    // Total
    quote += `**💰 ОБЩО:** ${totalWithInstallation} €\n\n`;

    // Warranty
    quote += `**📜 Гаранция:**\n`;
    quote += `   • Продукт: 24-36 месеца\n`;
    quote += `   • Компресор: 3-5 години\n`;
    quote += `   • Монтаж: 12 месеца\n\n`;

    // Payment options
    quote += `**💳 Начини на плащане:**\n`;
    quote += `   • На изплащане (до 12 месеца без оскъпяване)\n`;
    quote += `   • Кредит (бърз одобрение)\n`;
    quote += `   • Банков превод\n`;
    quote += `   • Наложен платеж\n\n`;

    // Validity
    quote += `**⏰ Валидност на офертата:** 7 дни\n\n`;

    // CTA
    quote += `**Следваща стъпка:**\n`;
    quote += `Искате ли да запазим този модел за Вас или имате въпроси? Можем и да дойдем на оглед безплатно! 🏠`;

    return quote;
  }

  /**
   * Calculate total product price
   */
  private calculateTotal(products: Product[]): number {
    return products.reduce((sum, p) => sum + p.price, 0);
  }

  /**
   * Calculate installation cost
   */
  private calculateInstallation(products: Product[]): number {
    // Base installation cost per unit
    const baseCost = 450;
    return products.length * baseCost;
  }

  /**
   * Check if this skill can handle the intent
   */
  canHandle(intent: string): boolean {
    return this.triggers.includes(intent as IntentType);
  }

}

// Export singleton
export const quoteGenerationSkill = new QuoteGenerationSkill();
export default quoteGenerationSkill;
