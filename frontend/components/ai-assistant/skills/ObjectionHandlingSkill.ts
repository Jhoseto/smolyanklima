/**
 * ObjectionHandlingSkill.ts
 * Реакция на възражения на клиенти
 */

import type { IntentType, UserContext, SkillResult, SkillContext } from '../types';
import { aiAnalytics } from '../analytics';

export class ObjectionHandlingSkill {
  public name = 'ObjectionHandlingSkill';
  public description = 'Обработва възражения на клиенти';
  public triggers: IntentType[] = ['objection_price', 'objection_timing', 'objection_competitor', 'objection_quality'];
  public priority = 10;

  /**
   * Execute objection handling
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const { intent, query, userContext } = context;

    try {
      // Track objection
      aiAnalytics.track('message_sent', {
        objectionType: intent.type,
        query: query || '',
      });

      // Handle specific objections
      const response = this.handleObjection(intent.type, query || '', userContext);

      return {
        success: true,
        response,
        confidence: 0.8,
      };
    } catch (error) {
      console.error('ObjectionHandlingSkill error:', error);
      return {
        success: false,
        response: 'Разбирам Вашето притеснение. Нека Ви свържа с Митко на 0876 123 456, който ще Ви помогне с конкретната ситуация.',
        confidence: 0,
      };
    }
  }

  /**
   * Handle specific objection type
   */
  private handleObjection(objectionType: string, query: string, userContext?: UserContext): string {
    switch (objectionType) {
      case 'objection_price':
        return this.handlePriceObjection(query, userContext);
      case 'objection_timing':
        return this.handleTimingObjection(query, userContext);
      case 'objection_competitor':
        return this.handleCompetitorObjection(query, userContext);
      case 'objection_quality':
        return this.handleQualityObjection(query, userContext);
      default:
        return this.handleGenericObjection(query, userContext);
    }
  }

  /**
   * Handle price objection
   */
  private handlePriceObjection(query: string, userContext?: UserContext): string {
    return `💰 **Разбирам напълно** - инвестицията е сериозна. Нека Ви покажа дългосрочната сметка:\n\n` +
      `**📊 Сметка за ток (примерна):**\n` +
      `• Стар/некачествен климатик: ~77 €/месец\n` +
      `• Инверторен климатик A+++: ~41 €/месец\n` +
      `• **Спестяване: 36 €/месец = 430 €/година** 💡\n\n` +
      `• При цена 615 €: изплаща се за ~1.4 години\n` +
      `• След това: чиста печалба от 430 €/година\n\n` +
      `**🎁 Допълнително получавате:**\n` +
      `• 36 месеца гаранция\n` +
      `• Безплатен професионален монтаж\n` +
      `• Годишна безплатна профилактика\n` +
      `• 24/7 поддръжка\n\n` +
      `**💳 Опции за плащане:**\n` +
      `• На изплащане до 12 месеца без оскъпяване\n` +
      `• Кредит с бързо одобрение\n\n` +
      `Разбирам, че търсите най-добрата стойност. Мога ли да предложа подходящ модел според точния Ви бюджет? 🤝`;
  }

  /**
   * Handle timing objection
   */
  private handleTimingObjection(query: string, userContext?: UserContext): string {
    return `⏰ **Разбирам, че искате да помислите** - това е сериозна покупка.\n\n` +
      `**🌡️ Сезонни фактори:**\n` +
      `• Сега е идеалното време за подготовка за лятото\n` +
      `• Цените са най-ниски преди сезона\n` +
      `• Монтажните екипи са свободни\n\n` +
      `**📦 Наличност:**\n` +
      `• Този модел е с ограничена наличност\n` +
      `• Следващата доставка е след 3 седмици\n` +
      `• Мога да го запазя за Вас за 24 часа без ангажимент\n\n` +
      `**🎯 Моята препоръка:**\n` +
      `• Решете сега за предпочитан дат на монтаж\n` +
      `• Имате 7 дни право на размисъл с пълно връщане на парите\n\n` +
      `Искате ли да запазим модела, докато помислите? Без ангажимент! ✅`;
  }

  /**
   * Handle competitor objection
   */
  private handleCompetitorObjection(query: string, userContext?: UserContext): string {
    return `🏪 **Разбирам, че сте намерили друга оферта.**\n\n` +
      `**🌟 Уникалните ни предимства:**\n` +
      `• Официален дилър с пълна гаранция\n` +
      `• Собствен сертифициран екип (не външни фирми)\n` +
      `• 25+ години опит в Смолян\n` +
      `• 3000+ успешни инсталации\n\n` +
      `**💎 Какво получавате допълнително:**\n` +
      `• Безплатен оглед преди монтаж\n` +
      `• Професионален монтаж с гаранция\n` +
      `• 24/7 телефон за въпроси\n` +
      `• Годишна безплатна профилактика\n` +
      `• Приоритетно обслужване за клиенти\n\n` +
      `**📞 Референции:**\n` +
      `• 95% от клиентите ни се връщат за втори климатик\n` +
      `• Можем да Ви дадем телефони на доволни клиенти във Вашия район\n\n` +
      `Мога ли да изготвя оферта за сравнение? Ние сме сигурни, че ще видите разликата! 💪`;
  }

  /**
   * Handle quality objection
   */
  private handleQualityObjection(query: string, userContext?: UserContext): string {
    return `🔧 **Разбирам Вашето притеснение за качеството.**\n\n` +
      `**🏆 Нашата репутация:**\n` +
      `• 25 години на пазара в Смолян\n` +
      `• Официален дилър на Daikin, Mitsubishi, Gree, Toshiba\n` +
      `• Сертифицирани техници от производителите\n\n` +
      `**📜 Гаранции:**\n` +
      `• Продукт: 24-36 месеца\n` +
      `• Компресор: 3-5 години\n` +
      `• Монтаж: 12 месеца\n` +
      `• **Важно:** При професионален монтаж от наш екип!\n\n` +
      `**⭐ Отзиви:**\n` +
      `• Средна оценка 4.8/5 от 200+ клиенти\n` +
      `• 95% препоръчват нас на приятели\n\n` +
      `**🛡️ Застраховка:**\n` +
      `• Разширена гаранция до 5 години (опционално)\n` +
      `• 24/7 телефон за аварии\n\n` +
      `Искате ли да говорите с клиент, който е ползвал наш услуги повече от 5 години? 📞`;
  }

  /**
   * Handle generic objection
   */
  private handleGenericObjection(query: string, userContext?: UserContext): string {
    return `🤝 **Разбирам Вашето притеснение.**\n\n` +
      `Всяка покупка е важно решение. Нека да обсъдим какво точно Ви притеснява?\n\n` +
      `**Мога ли да помогна с:**\n` +
      `• Допълнителна информация за продуктите?\n` +
      `• Безплатен оглед на място?\n` +
      `• Разговор с техник?\n` +
      `• Оферта за сравнение?\n\n` +
      `**Свържете се с нас:** 0876 123 456\n` +
      `Митко или Георги ще се радват да помогнат! 😊`;
  }

  /**
   * Check if this skill can handle the intent
   */
  canHandle(intent: string): boolean {
    return this.triggers.includes(intent as IntentType);
  }

}

// Export singleton
export const objectionHandlingSkill = new ObjectionHandlingSkill();
export default objectionHandlingSkill;
