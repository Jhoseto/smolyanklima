/**
 * AI Assistant Analytics
 * Event tracking and analytics for AI interactions
 */

import type { AnalyticsEvent, AnalyticsEventType, ConversationMetrics } from '../types';

class AIAnalytics {
  private events: AnalyticsEvent[] = [];
  private sessionId: string;
  private enabled: boolean;

  constructor(enabled = true) {
    this.sessionId = this.generateSessionId();
    this.enabled = enabled;
  }

  /**
   * Track an analytics event
   */
  track(eventType: AnalyticsEventType, metadata: Record<string, unknown> = {}): void {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      type: eventType,
      timestamp: Date.now(),
      conversationId: this.sessionId,
      metadata: {
        ...metadata,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
      },
    };

    this.events.push(event);
    
    // Send to analytics endpoint or console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[AI Analytics]', event);
    }

    // In production, send to your analytics endpoint
    // this.sendToAnalyticsEndpoint(event);
  }

  /**
   * Track chat opened
   */
  trackChatOpened(): void {
    this.track('chat_opened');
  }

  /**
   * Track message sent
   */
  trackMessageSent(content: string): void {
    this.track('message_sent', { contentLength: content.length });
  }

  /**
   * Track message received
   */
  trackMessageReceived(content: string, processingTime: number): void {
    this.track('message_received', {
      contentLength: content.length,
      processingTime,
    });
  }

  /**
   * Track product viewed from chat
   */
  trackProductViewed(productId: string): void {
    this.track('product_viewed', { productId });
  }

  /**
   * Track quote generated
   */
  trackQuoteGenerated(products: string[]): void {
    this.track('quote_generated', { products });
  }

  /**
   * Track conversion to quote
   */
  trackConversionQuote(): void {
    this.track('conversion_quote');
  }

  /**
   * Track conversion to purchase
   */
  trackConversionPurchase(): void {
    this.track('conversion_purchase');
  }

  /**
   * Track error
   */
  trackError(error: string): void {
    this.track('error_occurred', { error });
  }

  /**
   * Track human handoff
   */
  trackHumanHandoff(reason: string): void {
    this.track('human_handoff', { reason });
  }

  /**
   * Calculate conversation metrics
   */
  calculateMetrics(): ConversationMetrics {
    const conversationEvents = this.events.filter(
      (e) => e.conversationId === this.sessionId
    );

    const firstEvent = conversationEvents[0];
    const lastEvent = conversationEvents[conversationEvents.length - 1];

    return {
      conversationId: this.sessionId,
      duration: firstEvent && lastEvent ? lastEvent.timestamp - firstEvent.timestamp : 0,
      messageCount: conversationEvents.filter((e) => e.type === 'message_sent').length,
      conversionFunnel: {
        chatOpened: conversationEvents.some((e) => e.type === 'chat_opened'),
        productViewed: conversationEvents.some((e) => e.type === 'product_viewed'),
        quoteRequested: conversationEvents.some((e) => e.type === 'quote_generated'),
        quoteGenerated: conversationEvents.some((e) => e.type === 'conversion_quote'),
        purchaseCompleted: conversationEvents.some((e) => e.type === 'conversion_purchase'),
      },
      emotionalJourney: [], // Would be populated from emotion detection
    };
  }

  /**
   * Get all events
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Clear events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send to analytics endpoint (implement based on your analytics provider)
   */
  private async sendToAnalyticsEndpoint(event: AnalyticsEvent): Promise<void> {
    // Implement based on your analytics provider (Google Analytics, Mixpanel, etc.)
    // Example:
    // await fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event),
    // });
  }
}

// Export singleton
const aiAnalytics = new AIAnalytics();
export { aiAnalytics, AIAnalytics };
