/**
 * HandoffSkill.ts
 * Прехвърляне на разговор на човек
 */

import type { IntentType, SkillResult, SkillContext } from '../types';
import { aiAnalytics } from '../analytics';

export class HandoffSkill {
  public name = 'HandoffSkill';
  public description = 'Прехвърля разговор на човек когато е необходимо';
  public triggers: IntentType[] = ['complaint', 'technical_support', 'complex_request', 'human_requested'];
  public priority = 11;

  /**
   * Execute handoff
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const { intent, conversation, query } = context;

    try {
      // Track handoff
      aiAnalytics.track('message_sent', {
        handoffReason: intent.type,
        query: query || '',
      });

      // Generate handoff message
      const response = this.buildHandoffMessage(intent.type, query || '');

      // In production, this would:
      // 1. Send notification to human agent
      // 2. Transfer conversation history
      // 3. Queue for human response
      // 4. Notify user of expected wait time

      return {
        success: true,
        response,
        confidence: 1.0,
      };
    } catch (error) {
      console.error('HandoffSkill error:', error);
      return {
        success: false,
        response: 'Съжалявам, имаше проблем при свързването. Моля, обадете се директно на 0876 123 456.',
        confidence: 0,
      };
    }
  }

  /**
   * Build handoff message based on reason
   */
  private buildHandoffMessage(reason: string, query: string): string {
    switch (reason) {
      case 'complaint':
        return this.buildComplaintHandoff(query);
      case 'technical_support':
        return this.buildTechnicalHandoff(query);
      case 'complex_request':
        return this.buildComplexHandoff(query);
      case 'human_requested':
        return this.buildRequestedHandoff(query);
      default:
        return this.buildDefaultHandoff(query);
    }
  }

  /**
   * Build complaint handoff message
   */
  private buildComplaintHandoff(query: string): string {
    return `🙏 **Извиняваме се за неудобството**\n\n` +
      `Разбираме, че имате проблем и сме тук, за да го решим веднага.\n\n` +
      `**👨‍💼 Прехвърляме Ви на екипа:**\n` +
      `• Митко - управител: 0876 123 456\n` +
      `• Георги - сервиз: 0876 123 457\n\n` +
      `**📋 Предадена информация:**\n` +
      `• Причина: Оплакване\n` +
      `• Запис на разговора: запазен\n` +
      `• Приоритет: ВИСОК 🔴\n\n` +
      `**⏰ Очаквано време за отговор:** до 15 минути\n\n` +
      `Благодарим Ви за търпението. Ще се погрижим за проблема Ви! 🤝`;
  }

  /**
   * Build technical handoff message
   */
  private buildTechnicalHandoff(query: string): string {
    return `🔧 **Техническа поддръжка**\n\n` +
      `Вашият въпрос изисква лично внимание от нашия сервизен екип.\n\n` +
      `**👨‍🔧 На разположение:**\n` +
      `• Георги - сертифициран техник: 0876 123 457\n` +
      `• Работно време: Пн-Пт 09:00-18:00, Събота 09:00-14:00, Неделя: Почивен ден\n\n` +
      `**🚗 Опции:**\n` +
      `• Телефонна консултация (безплатна)\n` +
      `• Изпращане на техник на адрес\n` +
      `• Видео разговор за диагностика\n\n` +
      `**📸 Ако имате проблем:**\n` +
      `• Снимайте климатика (дисплей, шум, теч)\n` +
      `• Опишете кога започна проблемът\n` +
      `• Кажете модела на климатика\n\n` +
      `Готови сме да помогнем! Позвънете сега. 📞`;
  }

  /**
   * Build complex request handoff
   */
  private buildComplexHandoff(query: string): string {
    return `🏢 **Специализирана консултация**\n\n` +
      `Вашата заявка изисква експертна оценка от нашия екип.\n\n` +
      `**👨‍💼 На разположение:**\n` +
      `• Митко - търговски директор: 0876 123 456\n` +
      `• Пламен - проектиране: 0876 123 458\n\n` +
      `**📋 За по-бързо обслужване, моля имайте готови:**\n` +
      `• Размери на помещението (дължина, ширина, височина)\n` +
      `• Ориентация на стаите (юг/север)\n` +
      `• Изолация на сградата\n` +
      `• Предпочитан бюджет\n` +
      `• Кога планирате изпълнение\n\n` +
      `**🎁 Ще получите:**\n` +
      `• Безплатен оглед на място\n` +
      `• Детайлна оферта до 24 часа\n` +
      `• Професионална консултация\n\n` +
      `Обадете се сега за час: 📞 0876 123 456`;
  }

  /**
   * Build requested handoff message
   */
  private buildRequestedHandoff(query: string): string {
    return `👨‍💼 **Прехвърляне на човек**\n\n` +
      `Разбирам, че предпочитате да говорите с човек.\n\n` +
      `**📞 На разположение сме:**\n` +
      `• Митко (управител): 0876 123 456\n` +
      `• Георги (сервиз): 0876 123 457\n` +
      `• Пламен (проекти): 0876 123 458\n\n` +
      `**⏰ Работно време:**\n` +
      `• Понеделник - Петък: 09:00 - 18:00\n` +
      `• Събота: 09:00 - 14:00 (до обяд)\n` +
      `• Неделя: Почивен ден\n\n` +
      `**� Адрес:**\n` +
      `• ул. Наталия 19, кв. Райково, гр. Смолян\n\n` +
      `**📞 Телефон:**\n` +
      `• 0888 58 58 16\n\n` +
      `Благодарим Ви, че използвахте AI асистента ни! Очакваме обаждането Ви. 🤝`;
  }

  /**
   * Build default handoff message
   */
  private buildDefaultHandoff(query: string): string {
    return `👨‍💼 **Свързване с екипа**\n\n` +
      `Вашето запитване изисква лично внимание.\n\n` +
      `**📞 Моля, обадете се на:**\n` +
      `• Телефон: 0876 123 456\n` +
      `• Адрес: ул. "Смолянска" 15, Смолян\n\n` +
      `**⏰ Работно време:**\n` +
      `• Понеделник-Петък: 9:00-18:00\n` +
      `• Събота: 10:00-14:00\n\n` +
      `**📝 Записът на разговора е запазен** и ще бъде предаден на колегата.\n\n` +
      `Благодарим Ви за разбирането! Ще се радваме да Ви помогнем. 😊`;
  }

  /**
   * Check if this skill should handle handoff
   */
  shouldHandoff(context: SkillContext): boolean {
    const { intent } = context;
    return this.triggers.includes(intent.type as IntentType);
  }

  /**
   * Check if this skill can handle the intent
   */
  canHandle(intent: string): boolean {
    return this.triggers.includes(intent as IntentType);
  }

}

// Export singleton
export const handoffSkill = new HandoffSkill();
export default handoffSkill;
