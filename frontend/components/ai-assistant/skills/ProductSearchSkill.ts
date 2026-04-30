/**
 * ProductSearchSkill.ts
 * Семантично търсене на продукти
 */

import type { IntentType, Product, UserContext, SkillResult, SkillContext } from '../types';
import { getVectorSearchService } from '../services/vectorSearch';
import { aiAnalytics } from '../analytics';
import { getAllProducts } from '../../../data/productService';
import { catalogProductsToAI } from '../data/catalogToAIProducts';

export class ProductSearchSkill {
  public name = 'ProductSearchSkill';
  public description = 'Търси продукти по семантична близост';
  public triggers: IntentType[] = ['product_search', 'price_inquiry', 'general_chat'];
  public priority = 8;

  /**
   * Execute product search
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const { query, userContext, products: contextProducts } = context;

    try {
      let products: Product[] = contextProducts ?? [];
      if (!products.length) {
        products = catalogProductsToAI(await getAllProducts());
      }
      const vectorSearch = getVectorSearchService(products);

      // Search for products
      const results = vectorSearch.search(query);

      // Track search
      aiAnalytics.track('product_search', {
        query,
        resultsCount: results.length,
        topResult: results.length > 0 ? results[0].product.id : null,
      });

      if (results.length === 0) {
        return {
          success: false,
          response: 'Не намерих продукти, които да отговарят на вашето търсене. Можете ли да ми кажете повече детайли? Например за каква стая търсите климатик и колко квадратни метра е?',
          confidence: 0.3,
        };
      }

      const topProducts = results.map((r) => r.product);

      let response = this.buildResponse(topProducts, query, userContext);

      return {
        success: true,
        response,
        products: topProducts,
        confidence: results[0].score,
      };
    } catch (error) {
      console.error('ProductSearchSkill error:', error);
      return {
        success: false,
        response: 'Съжалявам, имаше технически проблем при търсенето. Опитайте отново или се свържете с нас на 0876 123 456.',
        confidence: 0,
      };
    }
  }

  /**
   * Build response for found products
   */
  private buildResponse(products: Product[], query: string, userContext?: UserContext): string {
    if (products.length === 1) {
      const p = products[0];
      return `Намерих точно това, което търсите! ${p.name} е идеален за ${p.suitableFor.join(', ')} с покритие до ${p.specs.coverage}м². Цената е ${p.price} €. Искате ли повече информация за този модел?`;
    }

    if (products.length === 2) {
      return `Намерих 2 отлични опции за вас:\n\n1️⃣ ${products[0].name} - ${products[0].price} €\n2️⃣ ${products[1].name} - ${products[1].price} €\n\nИскате ли да Ви помогна да изберете между тях?`;
    }

    return `Намерих ${products.length} модела, които отговарят на търсенето Ви:\n\n` +
      products.map((p, i) => `${i + 1}. ${p.name} (${p.brand}) - ${p.price} € - подходящ за ${p.suitableFor[0]}`).join('\n') +
      `\n\nИскате ли подробности за някой от тях?`;
  }

  /**
   * Check if this skill can handle the intent
   */
  canHandle(intent: string): boolean {
    return this.triggers.includes(intent as IntentType);
  }

}

// Export singleton
export const productSearchSkill = new ProductSearchSkill();
export default productSearchSkill;
