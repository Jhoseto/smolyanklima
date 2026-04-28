/**
 * Gemini Client
 * World-class Google Gemini API integration with safety controls
 */

import type { GeminiResponse, APIError, Message, Conversation } from '../types';

// Gemini 2.5 Flash - stable GA model, cost-effective and fast
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

interface RateLimitState {
  userMessageCount: Map<string, { last30MinCount: number; lastReset: number; timestamps: number[] }>;
}

class GeminiClient {
  private apiKey: string;
  private model: string;
  private config: Required<Omit<GeminiConfig, 'apiKey'>>;
  private rateLimits: RateLimitState;
  private abortController: AbortController | null = null;

  // 30-minute rolling limits (no daily limits)
  private readonly MAX_USER_MESSAGES_PER_30MIN = 100;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || GEMINI_MODEL;
    this.config = {
      model: this.model,
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxOutputTokens ?? 2048,
      topP: config.topP ?? 0.95,
      topK: config.topK ?? 40,
    };

    // Initialize rate limiting state
    this.rateLimits = {
      userMessageCount: new Map(),
    };
  }

  /**
   * Main method to send a message and get AI response
   */
  async sendMessage(
    messages: Message[],
    systemPrompt?: string,
    userId?: string
  ): Promise<GeminiResponse> {
    // Check rate limits before making request
    const rateLimitCheck = this.checkRateLimits(userId);
    if (!rateLimitCheck.allowed) {
      throw this.createRateLimitError(rateLimitCheck.reason);
    }

    try {
      const response = await this.makeGeminiRequest(messages, systemPrompt);
      
      // Update rate limits after successful request
      this.updateRateLimits(response.usage.totalTokens, userId);
      
      return response;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Make the actual API request to Gemini
   */
  private async makeGeminiRequest(
    messages: Message[],
    systemPrompt?: string
  ): Promise<GeminiResponse> {
    const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`;

    // Convert messages to Gemini format
    const contents = this.convertMessagesToGeminiFormat(messages);

    const requestBody = {
      contents,
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxOutputTokens,
        topP: this.config.topP,
        topK: this.config.topK,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    };

    this.abortController = new AbortController();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw this.createAPIError(response.status, errorData);
    }

    const data = await response.json();
    return this.parseGeminiResponse(data);
  }

  /**
   * Convert internal message format to Gemini format
   */
  private convertMessagesToGeminiFormat(messages: Message[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Parse Gemini API response to internal format
   */
  private parseGeminiResponse(data: unknown): GeminiResponse {
    const geminiData = data as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const candidate = geminiData.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    const usage = geminiData.usageMetadata;

    return {
      content,
      usage: {
        promptTokens: usage?.promptTokenCount || 0,
        completionTokens: usage?.candidatesTokenCount || 0,
        totalTokens: usage?.totalTokenCount || 0,
      },
      finishReason: candidate?.finishReason || 'STOP',
      model: this.model,
    };
  }

  /**
   * Check rate limits before making request
   */
  private checkRateLimits(userId?: string): { allowed: boolean; reason?: string } {
    // Check per-user 30-minute rolling limits
    if (userId) {
      const userCounts = this.rateLimits.userMessageCount.get(userId);
      if (userCounts) {
        this.resetUserCountersIfNeeded(userId, userCounts);

        if (userCounts.last30MinCount >= this.MAX_USER_MESSAGES_PER_30MIN) {
          return { allowed: false, reason: '30-minute message limit exceeded. Please wait a moment.' };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Update rate limits after successful request
   */
  private updateRateLimits(tokens: number, userId?: string): void {
    if (userId) {
      let userCounts = this.rateLimits.userMessageCount.get(userId);
      if (!userCounts) {
        userCounts = { last30MinCount: 0, lastReset: Date.now(), timestamps: [] };
      }
      this.resetUserCountersIfNeeded(userId, userCounts);
      
      userCounts.last30MinCount++;
      userCounts.timestamps.push(Date.now());
      this.rateLimits.userMessageCount.set(userId, userCounts);
    }
  }

  /**
   * Reset user counters if needed (30-minute rolling window)
   */
  private resetUserCountersIfNeeded(
    userId: string,
    counts: { last30MinCount: number; lastReset: number; timestamps: number[] }
  ): void {
    const now = Date.now();
    const thirtyMinMs = 30 * 60 * 1000;

    // Remove timestamps older than 30 minutes
    counts.timestamps = counts.timestamps.filter(timestamp => now - timestamp < thirtyMinMs);
    counts.last30MinCount = counts.timestamps.length;
    
    this.rateLimits.userMessageCount.set(userId, counts);
  }

  /**
   * Create rate limit error
   */
  private createRateLimitError(reason: string): APIError {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded: ${reason}. Please try again later or contact support.`,
      type: 'rate_limit',
      retryable: true,
    };
  }

  /**
   * Create API error from HTTP response
   */
  private createAPIError(status: number, errorData: Record<string, unknown>): APIError {
    const error: APIError = {
      code: `HTTP_${status}`,
      message: (typeof errorData.error === 'object' && errorData.error && 'message' in errorData.error 
        ? String(errorData.error.message) 
        : 'An error occurred'),
      type: 'server_error',
      retryable: status >= 500 || status === 429,
    };

    if (status === 429) {
      error.type = 'rate_limit';
      error.code = 'API_RATE_LIMIT';
    } else if (status >= 400 && status < 500) {
      error.type = 'invalid_request';
    }

    return error;
  }

  /**
   * Handle errors and provide user-friendly messages
   */
  private handleError(error: unknown): never {
    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        code: 'REQUEST_ABORTED',
        message: 'Request was cancelled',
        type: 'network_error',
        retryable: true,
      } as APIError;
    }

    if (this.isAPIError(error)) {
      throw error;
    }

    throw {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      type: 'server_error',
      retryable: false,
    } as APIError;
  }

  /**
   * Type guard for APIError
   */
  private isAPIError(error: unknown): error is APIError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'type' in error
    );
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    maxMessagesPer30Min: number;
    userMessageCount: Map<string, { last30MinCount: number; lastReset: number; timestamps: number[] }>;
  } {
    return {
      maxMessagesPer30Min: this.MAX_USER_MESSAGES_PER_30MIN,
      userMessageCount: this.rateLimits.userMessageCount,
    };
  }

  /**
   * Cancel ongoing request
   */
  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token for English/Bulgarian
    return Math.ceil(text.length / 4);
  }
}

// Export singleton instance factory
let clientInstance: GeminiClient | null = null;

export function getGeminiClient(apiKey: string): GeminiClient {
  if (!clientInstance) {
    clientInstance = new GeminiClient({ apiKey });
  }
  return clientInstance;
}

export function resetGeminiClient(): void {
  clientInstance = null;
}

export { GeminiClient };
export type { GeminiConfig };
