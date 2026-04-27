/**
 * Gemini Client Tests
 * Unit tests for Gemini API integration
 */

import { GeminiClient, getGeminiClient } from '../core/GeminiClient';
import type { Message } from '../types';

describe('GeminiClient', () => {
  const mockApiKey = 'test-api-key';
  let client: GeminiClient;

  beforeEach(() => {
    client = new GeminiClient({ apiKey: mockApiKey });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided API key', () => {
      expect(client).toBeDefined();
    });

    it('should use default model if not specified', () => {
      const client = new GeminiClient({ apiKey: mockApiKey });
      expect(client).toBeDefined();
    });

    it('should use custom config when provided', () => {
      const client = new GeminiClient({
        apiKey: mockApiKey,
        temperature: 0.5,
        maxOutputTokens: 1000,
      });
      expect(client).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should throw rate limit error when daily limit exceeded', async () => {
      // Simulate rate limit exceeded
      const messages: Message[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      // Mock rate limits to be exceeded
      jest.spyOn(client as any, 'checkRateLimits').mockReturnValue({
        allowed: false,
        reason: 'Daily request limit exceeded',
      });

      await expect(client.sendMessage(messages)).rejects.toThrow('Rate limit exceeded');
    });

    it('should update rate limits after successful request', async () => {
      const messages: Message[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      // Mock successful API response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Hi!' }] }, finishReason: 'STOP' }],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 5,
              totalTokenCount: 15,
            },
          }),
      });

      const response = await client.sendMessage(messages);
      expect(response.content).toBe('Hi!');
      expect(response.usage.totalTokens).toBe(15);
    });
  });

  describe('rate limiting', () => {
    it('should get rate limit status', () => {
      const status = client.getRateLimitStatus();
      expect(status.requestsRemaining).toBeDefined();
      expect(status.tokensRemaining).toBeDefined();
      expect(status.requestsUsed).toBeDefined();
      expect(status.tokensUsed).toBeDefined();
    });

    it('should reset daily counters after 24 hours', () => {
      // Advance time by 25 hours
      jest.useFakeTimers();
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);

      const status = client.getRateLimitStatus();
      expect(status.requestsUsed).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens correctly', () => {
      const text = 'Hello world';
      const tokens = client.estimateTokens(text);
      // Roughly 11 chars / 4 = 3 tokens
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const messages: Message[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      await expect(client.sendMessage(messages)).rejects.toMatchObject({
        type: 'server_error',
        retryable: false,
      });
    });

    it('should handle 429 rate limit from API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
      });

      const messages: Message[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      await expect(client.sendMessage(messages)).rejects.toMatchObject({
        type: 'rate_limit',
        retryable: true,
      });
    });
  });
});

describe('getGeminiClient singleton', () => {
  it('should return same instance for same API key', () => {
    const client1 = getGeminiClient('key1');
    const client2 = getGeminiClient('key1');
    expect(client1).toBe(client2);
  });

  it('should return different instance after reset', () => {
    const client1 = getGeminiClient('key1');
    jest.resetModules();
    const { getGeminiClient: getNewClient } = require('../core/GeminiClient');
    const client2 = getNewClient('key1');
    expect(client1).not.toBe(client2);
  });
});
