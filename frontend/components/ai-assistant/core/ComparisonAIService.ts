/**
 * Comparison AI Service
 * Uses Gemini's built-in Google Search to generate accurate product comparisons
 */

import { GeminiClient } from './GeminiClient';
import type { Product } from '../types';

interface ComparisonRecommendation {
  summary: string;
  bestChoice: string;
  keyDifferences: string[];
  recommendation: string;
}

class ComparisonAIService {
  /**
   * Generate AI-powered comparison using Gemini with Google Search
   */
  async generateComparison(products: Product[]): Promise<ComparisonRecommendation> {
    // Build prompt with instruction to use Google Search
    const prompt = this.buildComparisonPrompt(products);

    // Generate AI response using Gemini with Google Search enabled
    // Increase maxOutputTokens to allow for longer responses (8192 tokens)
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    const geminiClient = new GeminiClient({ 
      apiKey, 
      maxOutputTokens: 8192 
    });
    const response = await geminiClient.sendMessage(
      [{ role: 'user' as const, content: prompt, id: '', timestamp: Date.now() }],
      this.getSystemPrompt()
    );

    // Parse AI response
    return this.parseAIResponse(response.content, products);
  }

  /**
   * Build comparison prompt with Google Search instruction
   */
  private buildComparisonPrompt(products: Product[]): string {
    let prompt = 'Използвай Google Search за да намериш актуална информация за следните климатици и направи сравнение:\n\n';

    products.forEach((product, index) => {
      prompt += `${index + 1}. ${product.name}\n`;
      prompt += `   Цена: €${product.price}\n`;
      prompt += `   Енергиен клас: ${product.energyClass}\n`;
      prompt += `   Шум: ${product.specs.noiseLevel} dB\n`;
      prompt += `   Покритие: ${product.specs.coverage} кв.м.\n`;
      prompt += `   Особености: ${product.features.join(', ')}\n\n`;
    });

    prompt += '\n--- ЗАДАЧА ---\n';
    prompt += 'ВАЖНО: Потребителят ВЕЧЕ ВИЖДА техническите характеристики в таблицата горе. НЕ повтаряй спецификациите.\n\n';
    prompt += 'Фокусирай се на:\n';
    prompt += '- За кого е подходящ всеки модел\n';
    prompt += '- Надеждност според отзиви\n';
    prompt += '- Предимства и недостатъци\n\n';
    prompt += 'НАПИСАНИ:\n';
    prompt += '- КРАТКО и ЯСНО (максимум 1-2 изречения на секция)\n';
    prompt += '- С ПРОСТИ ДУМИ (без сложни изрази)\n';
    prompt += '- БЕЗ излишни детайли\n\n';
    prompt += 'Напиши в ТОЧНИЯ формат:\n\n';
    prompt += '===ОБОБЩЕНИЕ===\n';
    prompt += '[1-2 изречения]\n\n';
    prompt += '===НАЙ-ДОБЪР===\n';
    prompt += '[1 изречение - кой и защо]\n\n';
    prompt += '===РАЗЛИКИ===\n';
    prompt += '[2-3 кратки разлики]\n\n';
    prompt += '===ПРЕПОРЪКА===\n';
    prompt += '[1-2 изречения за кого е подходящ]\n\n';
    prompt += 'ВАЖНО: Използвай ТОЧНО тези заглавия: ===ОБОБЩЕНИЕ===, ===НАЙ-ДОБЪР===, ===РАЗЛИКИ===, ===ПРЕПОРЪКА===';
    prompt += '\nКРАТКО, ЯСНО, С ПРОСТИ ДУМИ.';

    return prompt;
  }

  /**
   * Get system prompt for comparison with Google Search enabled
   */
  private getSystemPrompt(): string {
    return `Ти си експерт по климатици. Твоята задача е да правиш точни и полезни сравнения между различни модели климатици на база на технически характеристики и реални отзиви от потребители от интернет.

Правила:
- Винаги използвай Google Search за актуална информация
- Бъди обективен и честен
- Отговаряй на български език
- Бъди кратък и ясен
- Използвай реални данни от интернет`;
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(response: string, products: Product[]): ComparisonRecommendation {
    // Try to parse using ===SECTION=== format (no spaces)
    const sections = response.split('===').filter(s => s.trim());
    
    let summary = '';
    let bestChoice = '';
    const keyDifferences: string[] = [];
    let recommendation = '';

    for (const section of sections) {
      const lines = section.trim().split('\n').filter(l => l.trim());
      const sectionName = lines[0]?.trim().toUpperCase() || '';
      
      const content = lines.slice(1).join('\n').trim();

      if (sectionName === 'ОБОБЩЕНИЕ') {
        summary = content;
      } else if (sectionName === 'НАЙ-ДОБЪР') {
        bestChoice = content;
      } else if (sectionName === 'РАЗЛИКИ') {
        keyDifferences.push(...content.split('\n').filter(l => l.trim()));
      } else if (sectionName === 'ПРЕПОРЪКА') {
        recommendation = content;
      }
    }

    // If parsing failed, use the raw response as summary
    if (!summary && !bestChoice && keyDifferences.length === 0) {
      console.log('Parsing failed, using raw response');
      return {
        summary: response.trim(),
        bestChoice: '',
        keyDifferences: [],
        recommendation: '',
      };
    }

    return {
      summary: summary || '',
      bestChoice: bestChoice || '',
      keyDifferences: keyDifferences,
      recommendation: recommendation || '',
    };
  }
}

// Export singleton
let comparisonAIService: ComparisonAIService | null = null;

export function getComparisonAIService(): ComparisonAIService {
  if (!comparisonAIService) {
    comparisonAIService = new ComparisonAIService();
  }
  return comparisonAIService;
}

export default ComparisonAIService;
