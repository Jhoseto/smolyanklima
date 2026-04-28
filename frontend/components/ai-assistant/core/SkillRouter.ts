/**
 * Skill Router
 * Modular intent recognition and skill dispatch
 */

import type {
  UserIntent,
  IntentType,
  IntentEntity,
  Skill,
  SkillContext,
  SkillResult,
  Message,
} from '../types';

interface IntentPattern {
  type: IntentType;
  keywords: string[];
  entities: string[];
  confidence: number;
}

class SkillRouter {
  private skills: Map<IntentType, Skill>;
  private intentPatterns: IntentPattern[];

  constructor() {
    this.skills = new Map();
    this.intentPatterns = this.buildIntentPatterns();
  }

  /**
   * Register a skill for specific intents
   */
  registerSkill(skill: Skill): void {
    skill.triggers.forEach((intentType) => {
      this.skills.set(intentType, skill);
    });
  }

  /**
   * Analyze message and determine intent
   */
  analyzeIntent(message: string): UserIntent {
    const lowerMessage = message.toLowerCase();
    const scores: Map<IntentType, number> = new Map();

    // Score each intent pattern
    this.intentPatterns.forEach((pattern) => {
      let score = 0;

      // Check keywords
      pattern.keywords.forEach((keyword) => {
        if (lowerMessage.includes(keyword)) {
          score += pattern.confidence;
        }
      });

      // Check for entities
      const foundEntities = pattern.entities.filter((entity) =>
        this.extractEntity(lowerMessage, entity)
      );
      score += foundEntities.length * 0.15;

      if (score > 0) {
        const currentScore = scores.get(pattern.type) || 0;
        scores.set(pattern.type, currentScore + score);
      }
    });

    // Find best matching intent
    let bestIntent: IntentType = 'general_chat';
    let bestScore = 0;

    scores.forEach((score, intentType) => {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intentType;
      }
    });

    // Normalize confidence
    const normalizedConfidence = Math.min(bestScore / 2, 1);

    // Extract entities
    const entities = this.extractEntities(message);

    return {
      type: bestIntent,
      confidence: normalizedConfidence,
      entities,
      rawQuery: message,
    };
  }

  /**
   * Route intent to appropriate skill
   */
  async routeIntent(intent: UserIntent, context: SkillContext): Promise<SkillResult> {
    const skill = this.skills.get(intent.type);

    if (!skill) {
      // Fallback to general chat
      return this.handleGeneralChat(intent, context);
    }

    try {
      return await skill.execute(context);
    } catch (error) {
      console.error(`Skill ${skill.name} failed:`, error);
      return this.handleSkillError(intent, context);
    }
  }

  /**
   * Build intent recognition patterns
   */
  private buildIntentPatterns(): IntentPattern[] {
    return [
      // Product Search
      {
        type: 'product_search',
        keywords: [
          'търся', 'климатик', 'инвертор', 'купя', 'препоръчай', 'какво да избера',
          'нуждая се', 'трябва ми', 'спалня', 'всекидневна', 'хол', 'детска',
          'офис', 'магазин', 'таван', 'мазе', '20 кв', '30 кв', '40 кв',
          'тих', 'икономичен', 'евтин', 'качествен', 'прохладен',
        ],
        entities: ['room_type', 'square_meters', 'brand', 'budget'],
        confidence: 0.3,
      },

      // Product Comparison
      {
        type: 'product_comparison',
        keywords: [
          'сравни', 'разлика', 'коя е разликата', 'кое е по-добре',
          'daikin или mitsubishi', 'кой модел', 'срещу', 'vs', 'по-добър',
          'кажи ми разликите', 'сходства', 'предимства', 'недостатъци',
        ],
        entities: ['product_a', 'product_b', 'brand_a', 'brand_b'],
        confidence: 0.4,
      },

      // Price Inquiry
      {
        type: 'price_inquiry',
        keywords: [
          'цена', 'колко струва', 'скъпо', 'евтино', 'ценообразуване',
          'плащане', 'на изплащане', 'лизинг', 'отстъпка', 'промоция',
          'с колко е по-евтин', 'с колко по-скъп', 'бюджет',
        ],
        entities: ['product_name', 'price_range'],
        confidence: 0.35,
      },

      // Quote Request
      {
        type: 'quote_request',
        keywords: [
          'оферта', 'предложение', 'колко ще излезе', 'изготви оферта',
          'изпрати цена', 'имейл', 'телефон', 'контакти', 'обадете се',
          'посетете', 'майстор', 'оглед', 'безплатен оглед',
        ],
        entities: ['contact_info', 'address', 'products'],
        confidence: 0.4,
      },

      // Technical Support
      {
        type: 'technical_support',
        keywords: [
          'не работи', 'грешка', 'проблем', 'шум', 'не охлажда',
          'не пече', 'тека', 'води', 'конденз', 'мирише',
          'филтър', 'чистене', 'сервиз', 'ремонт', 'счупи се',
        ],
        entities: ['error_code', 'symptom', 'product_model'],
        confidence: 0.35,
      },

      // Installation Info
      {
        type: 'installation_info',
        keywords: [
          'монтаж', 'инсталация', 'слагане', 'поставяне', 'къде се слага',
          'външно тяло', 'вътрешно тяло', 'тръби', 'кабели',
          'колко време', 'как става', 'нужни материали', 'дупчене',
        ],
        entities: ['room_type', 'wall_type', 'installation_type'],
        confidence: 0.35,
      },

      // Warranty Info
      {
        type: 'warranty_info',
        keywords: [
          'гаранция', 'покрива ли се', 'фабричен дефект', 'сервиз',
          'поддръжка', 'профилактика', 'почистване', 'застраховка',
          'колко години', 'какво покрива', 'какво не покрива',
        ],
        entities: ['warranty_type', 'product_brand'],
        confidence: 0.35,
      },

      // Price Objection
      {
        type: 'objection_price',
        keywords: [
          'скъпо', 'прескъпо', 'не мога да си позволя', 'над бюджета',
          'по-евтин вариант', 'различни цени', 'по-скъпо от другаде',
          'зашо толкова скъпо', 'твърде много', 'намаление',
        ],
        entities: ['price_mentioned', 'competitor'],
        confidence: 0.4,
      },

      // Timing Objection
      {
        type: 'objection_timing',
        keywords: [
          'ще помисля', 'не сега', 'по-късно', 'пролетта', 'есента',
          'догодина', 'не бързам', 'имам време', 'ще видя',
          'ще обсъдя с', 'ще преценя', 'не съм сигурен',
        ],
        entities: ['timeline'],
        confidence: 0.35,
      },

      // Competitor Objection
      {
        type: 'objection_competitor',
        keywords: [
          'технополис', 'зора', 'емаг', 'ольхо', 'друг магазин',
          'по-евтино другаде', 'по-добра оферта', 'другаде ми предложиха',
          'видях го на', 'там е по-евтино', 'конкуренция',
        ],
        entities: ['competitor_name', 'competitor_price'],
        confidence: 0.4,
      },

      // Gratitude
      {
        type: 'gratitude',
        keywords: [
          'благодаря', 'мерси', 'страхотно', 'отлично', 'перфектно',
          'доволен съм', 'радвам се', 'харесва ми', 'супер',
          'благодаря за помощта', 'помогнахте ми',
        ],
        entities: [],
        confidence: 0.5,
      },

      // Complaint
      {
        type: 'complaint',
        keywords: [
          'недоволен', 'разочарован', 'лошо', 'проблем', 'оплакване',
          'не съм доволен', 'лошо обслужване', 'грешка', 'не работи',
          'върнете парите', 'резервация', 'не става',
        ],
        entities: ['issue_type'],
        confidence: 0.4,
      },
    ];
  }

  /**
   * Extract entity from message
   */
  private extractEntity(message: string, entityType: string): boolean {
    const entityPatterns: Record<string, RegExp> = {
      room_type: /(спалня|всекидневна|хол|детска|офис|кухня|таван|мазе)/i,
      square_meters: /(\d+)\s*(кв\.м|квадрата|м2|kvm)/i,
      brand: /(daikin|mitsubishi|lg|fujitsu|panasonic|toshiba)/i,
      budget: /(\d+)\s*(€|eur|euro|евро)/i,
      price_range: /(\d+)\s*(до|-)\s*(\d+)/i,
    };

    const pattern = entityPatterns[entityType];
    return pattern ? pattern.test(message) : false;
  }

  /**
   * Extract all entities from message
   */
  private extractEntities(message: string): IntentEntity[] {
    const entities: IntentEntity[] = [];
    const lowerMessage = message.toLowerCase();

    // Room type
    const roomMatch = lowerMessage.match(/(спалня|всекидневна|хол|детска|офис|кухня|таван|мазе)/i);
    if (roomMatch) {
      entities.push({ type: 'room_type', value: roomMatch[1], confidence: 0.9 });
    }

    // Square meters
    const sqmMatch = lowerMessage.match(/(\d+)\s*(кв\.м|квадрата|м2|kvm)/i);
    if (sqmMatch) {
      entities.push({ type: 'square_meters', value: sqmMatch[1], confidence: 0.9 });
    }

    // Brand
    const brandMatch = lowerMessage.match(/(daikin|mitsubishi|lg|fujitsu|panasonic|toshiba)/i);
    if (brandMatch) {
      entities.push({ type: 'brand', value: brandMatch[1], confidence: 0.95 });
    }

    // Price
    const priceMatch = lowerMessage.match(/(\d{3,4})\s*(€|eur|euro|евро)/i);
    if (priceMatch) {
      entities.push({ type: 'price', value: priceMatch[1], confidence: 0.8 });
    }

    // Budget range
    const budgetMatch = lowerMessage.match(/(до|около|под)\s*(\d{3,4})/i);
    if (budgetMatch) {
      entities.push({ type: 'budget', value: budgetMatch[2], confidence: 0.7 });
    }

    return entities;
  }

  /**
   * Handle general chat when no specific skill matches
   */
  private async handleGeneralChat(intent: UserIntent, context: SkillContext): Promise<SkillResult> {
    return {
      success: true,
      response: '', // Will be filled by Gemini
      confidence: intent.confidence,
    };
  }

  /**
   * Handle skill execution errors
   */
  private async handleSkillError(intent: UserIntent, context: SkillContext): Promise<SkillResult> {
    return {
      success: false,
      response: 'Извинете, срещнах техническа трудност. Нека Ви помогна по друг начин. Имате ли друг въпрос?',
      confidence: 1,
    };
  }

  /**
   * Get all registered skills
   */
  getRegisteredSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Check if skill exists for intent
   */
  hasSkillForIntent(intentType: IntentType): boolean {
    return this.skills.has(intentType);
  }
}

// Export singleton
const skillRouter = new SkillRouter();
export { skillRouter, SkillRouter };
