/**
 * Emotional Intelligence Engine
 * Empathy detection, mirroring, and warm conversation
 */

import type { EmotionType, EmotionConfig, Message, Conversation, ResponseStrategy, ToneModifier } from '../types';

interface EmotionDetectionResult {
  emotion: EmotionType;
  confidence: number;
  keywords: string[];
  urgency: number; // 0-1 scale
}

interface ConversationWarmth {
  warmthScore: number; // 0-100
  rapportLevel: number; // 0-10
  personalTouches: string[];
  lastConnectionTime: number;
}

class EmotionalIntelligence {
  private emotionConfigs: Map<EmotionType, EmotionConfig>;
  private warmthHistory: Map<string, ConversationWarmth>;
  private stories: string[];

  constructor() {
    this.emotionConfigs = this.buildEmotionConfigs();
    this.warmthHistory = new Map();
    this.stories = this.loadStories();
  }

  /**
   * Detect emotion from user message
   */
  detectEmotion(message: string): EmotionDetectionResult {
    const lowerMessage = message.toLowerCase();
    const emotionScores: Map<EmotionType, { score: number; keywords: string[] }> = new Map();

    // Score each emotion
    this.emotionConfigs.forEach((config, emotionType) => {
      let score = 0;
      const foundKeywords: string[] = [];

      config.keywords.forEach((keyword) => {
        if (lowerMessage.includes(keyword)) {
          score += 1;
          foundKeywords.push(keyword);
        }
      });

      if (score > 0) {
        emotionScores.set(emotionType, { score, keywords: foundKeywords });
      }
    });

    // Find highest scoring emotion
    let bestEmotion: EmotionType = 'neutral';
    let bestScore = 0;
    let bestKeywords: string[] = [];

    emotionScores.forEach((data, emotion) => {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestEmotion = emotion;
        bestKeywords = data.keywords;
      }
    });

    // Calculate urgency
    const urgency = this.calculateUrgency(lowerMessage, bestEmotion);

    // Normalize confidence
    const confidence = Math.min(bestScore / 3, 1);

    return {
      emotion: bestEmotion,
      confidence,
      keywords: bestKeywords,
      urgency,
    };
  }

  /**
   * Generate empathetic response modifier
   */
  getEmpathyModifier(emotion: EmotionType, confidence: number): string {
    if (confidence < 0.3) return ''; // Not confident enough

    const config = this.emotionConfigs.get(emotion);
    if (!config) return '';

    const modifiers: Record<ResponseStrategy, string[]> = {
      empathize_first: [
        'Разбирам перфектно...',
        'Чувам Ви и разбирам притесненията Ви...',
        'Вашите чувства са важни за мен...',
      ],
      educate_gently: [
        'Нека Ви обясня по-просто...',
        'Това е често срещано запитване...',
        'Ще Ви помогна да разберете...',
      ],
      provide_urgency: [
        'Разбирам, че бързате...',
        'Знам, че времето е от съществено значение...',
        'Ще бъда бърз и конкретен...',
      ],
      build_rapport: [
        'Много хора се чудят за същото...',
        'Преди седмица имах клиент с подобен въпрос...',
        'Виждам, че това е важно за Вас...',
      ],
      offer_alternatives: [
        'Има няколко опции за Вас...',
        'Нека разгледаме алтернативи...',
        'Всеки случай е различен...',
      ],
    };

    const options = modifiers[config.responseStrategy];
    return options[Math.floor(Math.random() * options.length)] || '';
  }

  /**
   * Apply mirroring - match user's communication style
   */
  applyMirroring(messages: Message[], response: string): string {
    if (messages.length === 0) return response;

    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return response;

    // Analyze user's style
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    const usesEmoji = userMessages.some((m) => /[\u{1F300}-\u{1F9FF}]/u.test(m.content));
    const usesFormal = userMessages.some((m) => /(Вие|Ваш|Вас|г-н|г-жа)/i.test(m.content));
    const usesShort = avgLength < 50;

    let modifiedResponse = response;

    // Mirror emoji usage
    if (!usesEmoji && /[\u{1F300}-\u{1F9FF}]/u.test(response)) {
      // User doesn't use emoji, reduce ours
      modifiedResponse = modifiedResponse.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    }

    // Mirror formality
    if (usesFormal) {
      // Keep formal tone
      modifiedResponse = modifiedResponse.replace(/ти/i, 'Вие');
    }

    // Mirror length
    if (usesShort && modifiedResponse.length > 150) {
      // User prefers short, make response more concise
      const sentences = modifiedResponse.split(/[.!?]+/).filter((s) => s.trim());
      modifiedResponse = sentences.slice(0, 2).join('. ') + '.';
    }

    return modifiedResponse;
  }

  /**
   * Get warm conversation opener
   */
  getWarmOpener(context: {
    isReturning: boolean;
    visitCount: number;
    lastVisit?: number;
    hasConversationHistory: boolean;
    currentPage: string;
  }): string {
    const { isReturning, visitCount, hasConversationHistory, lastVisit } = context;

    // Returning user with history
    if (isReturning && hasConversationHistory && visitCount > 1) {
      if (lastVisit) {
        const daysSince = Math.floor((Date.now() - lastVisit) / (1000 * 60 * 60 * 24));
        if (daysSince < 1) {
          return 'Здравейте отново! 😊 Продължаваме от там, където спряхме?';
        } else if (daysSince < 7) {
          return `Здравейте! Радвам се да Ви видя пак след ${daysSince} дни. Какво ново?`;
        }
      }
      return 'Здравейте отново! Виждам, че се върнахте. Готов съм с още информация за Вас!';
    }

    // First time but returning visitor
    if (isReturning && !hasConversationHistory) {
      return 'Здравейте! Виждам, че сте ни посещавали преди. Дайте ми шанс да Ви помогна!';
    }

    // First time ever - contextual based on page
    const hour = new Date().getHours();
    let timeGreeting = 'Здравейте!';
    if (hour < 12) timeGreeting = 'Добро утро! ☀️';
    else if (hour < 18) timeGreeting = 'Здравейте! 👋';
    else timeGreeting = 'Добър вечер! 🌙';

    const pageOpeners: Record<string, string> = {
      catalog: `${timeGreeting} Търсите климатик? Аз съм тук, за да направя избора лесен!`,
      product: `${timeGreeting} Виждам, че разглеждате конкретен модел. Имате ли въпроси?`,
      cart: `${timeGreeting} Наближавате финала! Нуждаете ли се от помощ с избора?`,
      home: `${timeGreeting} Добре дошли! Как мога да направя деня Ви по-хубав?`,
      blog: `${timeGreeting} Чета, че се интересувате от HVAC. Имате ли конкретни въпроси?`,
    };

    return pageOpeners[context.currentPage] || `${timeGreeting} Аз съм Вашият личен асистент от Смолян Клима. Как мога да помогна?`;
  }

  /**
   * Get appropriate story for context
   */
  getStory(context: string): string | null {
    const relevantStories = this.stories.filter((story) => {
      const storyLower = story.toLowerCase();
      const contextLower = context.toLowerCase();

      // Check relevance
      if (contextLower.includes('спалня') && storyLower.includes('спалня')) return true;
      if (contextLower.includes('детска') && storyLower.includes('детска')) return true;
      if (contextLower.includes('евтин') && storyLower.includes('спест')) return true;
      if (contextLower.includes('тих') && storyLower.includes('тих')) return true;
      if (contextLower.includes('монтаж') && storyLower.includes('монтаж')) return true;

      return false;
    });

    if (relevantStories.length > 0) {
      return relevantStories[Math.floor(Math.random() * relevantStories.length)];
    }

    // Return generic story if no match
    return this.stories[0] || null;
  }

  /**
   * Build conversation warmth tracking
   */
  updateWarmth(conversationId: string, message: Message): void {
    const existing = this.warmthHistory.get(conversationId) || {
      warmthScore: 50,
      rapportLevel: 5,
      personalTouches: [],
      lastConnectionTime: Date.now(),
    };

    // Increase warmth on positive interactions
    if (message.role === 'user') {
      const positiveIndicators = ['благодаря', 'страхотно', 'супер', 'ок', 'да', 'харесва ми'];
      if (positiveIndicators.some((word) => message.content.toLowerCase().includes(word))) {
        existing.rapportLevel = Math.min(10, existing.rapportLevel + 0.5);
        existing.warmthScore = Math.min(100, existing.warmthScore + 5);
      }
    }

    existing.lastConnectionTime = Date.now();
    this.warmthHistory.set(conversationId, existing);
  }

  /**
   * Get conversation warmth
   */
  getWarmth(conversationId: string): ConversationWarmth | null {
    return this.warmthHistory.get(conversationId) || null;
  }

  /**
   * Calculate urgency from message
   */
  private calculateUrgency(message: string, emotion: EmotionType): number {
    let urgency = 0;

    // Urgent keywords
    const urgentWords = ['веднага', 'сега', 'спешно', 'бързо', 'краен срок', 'изтича'];
    urgentWords.forEach((word) => {
      if (message.includes(word)) urgency += 0.3;
    });

    // Emotion-based urgency
    if (emotion === 'frustrated' || emotion === 'stressed' || emotion === 'urgent') {
      urgency += 0.4;
    }

    return Math.min(urgency, 1);
  }

  /**
   * Build emotion configurations
   */
  private buildEmotionConfigs(): Map<EmotionType, EmotionConfig> {
    const configs = new Map<EmotionType, EmotionConfig>();

    configs.set('neutral', {
      type: 'neutral',
      keywords: [],
      responseStrategy: 'build_rapport',
      toneModifier: 'more_detailed',
    });

    configs.set('happy', {
      type: 'happy',
      keywords: ['радвам', 'страхотно', 'супер', 'перфектно', 'доволен', 'харесва'],
      responseStrategy: 'build_rapport',
      toneModifier: 'more_casual',
    });

    configs.set('confused', {
      type: 'confused',
      keywords: ['объркан', 'не разбирам', 'какво', 'обясни', 'неясно', 'как става'],
      responseStrategy: 'educate_gently',
      toneModifier: 'more_detailed',
    });

    configs.set('frustrated', {
      type: 'frustrated',
      keywords: ['ядосан', 'недоволен', 'проблем', 'не работи', 'разочарован', 'лошо'],
      responseStrategy: 'empathize_first',
      toneModifier: 'warmer',
    });

    configs.set('skeptical', {
      type: 'skeptical',
      keywords: ['скептичен', 'не вярвам', 'сигурен ли', 'докажи', 'зашо'],
      responseStrategy: 'build_rapport',
      toneModifier: 'more_formal',
    });

    configs.set('stressed', {
      type: 'stressed',
      keywords: ['стрес', 'притеснен', 'тревожен', 'не знам', 'помогни'],
      responseStrategy: 'empathize_first',
      toneModifier: 'warmer',
    });

    configs.set('excited', {
      type: 'excited',
      keywords: ['вълнувам', 'чудесно', 'невероятно', 'толкова хубаво', 'яко'],
      responseStrategy: 'build_rapport',
      toneModifier: 'more_casual',
    });

    configs.set('urgent', {
      type: 'urgent',
      keywords: ['бързам', 'спешно', 'вече', 'незабавно', 'нуждая се сега'],
      responseStrategy: 'provide_urgency',
      toneModifier: 'more_urgent',
    });

    return configs;
  }

  /**
   * Load storytelling database
   */
  private loadStories(): string[] {
    return [
      'Миналия месец инсталирахме на младо семейство с бебе. Избраха най-тихия модел - сега бебето спи спокойно, а те спестяват 40% от сметките. 😊',
      'Г-н Иванов от Райково ми праща снимка на сметката всяко лято. Първата година спести 280 лв, миналата - 320 лв. Вече е фен номер 1.',
      'Нашият екип - Митко и Георги, работят заедно от 8 години. Знаят всяка къща в Смолян и винаги намират най-доброто решение.',
      'Семейство от Доспат търсеха "най-евтиното". Обясних им за разходите за ток и... избраха среден клас. Сега ми благодарят всеки път като мине техен познат.',
      'Баба Мария от село Триград каза: "Момче, не разбирам от коефициенти, но знам че тази зима съм топла и сметката е половинка". Това е най-добрият отзив, който съм получавал.',
      'Миналата година инсталирахме 47 климатици в новите блокове. Този месец 12 от тези клиенти ни препоръчаха на приятели. Това е най-голямата награда.',
      'Г-жа Петрова от Пампорово каза: "Аз съм взискателна, но вие сте перфектни - от първото обаждане до последния винт". Запомних тези думи.',
      'Знаете ли, че 73% от клиентите ни се връщат за втори климатик? Това не е случайно - грижим се за всеки, сякаш е семейство.',
    ];
  }
}

// Export singleton
const emotionalIntelligence = new EmotionalIntelligence();
export { emotionalIntelligence, EmotionalIntelligence };
