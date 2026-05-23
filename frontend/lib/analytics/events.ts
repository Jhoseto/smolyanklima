import { trackEvent } from './gtag';

export function trackGenerateLead(formType: string, productSlug?: string): void {
  trackEvent('generate_lead', {
    form_type: formType,
    ...(productSlug ? { item_id: productSlug } : {}),
  });
}

export function trackContact(phoneNumber: string): void {
  trackEvent('contact', { phone_number: phoneNumber });
}

export function trackViewItem(itemId: string, itemName: string): void {
  trackEvent('view_item', { item_id: itemId, item_name: itemName });
}

export function trackSearch(searchTerm: string): void {
  trackEvent('search', { search_term: searchTerm });
}

export function trackNewsletterSignup(): void {
  trackEvent('newsletter_signup');
}

export function trackAiEvent(eventType: string, metadata: Record<string, unknown> = {}): void {
  trackEvent(`ai_${eventType}`, {
    event_category: 'ai_assistant',
    ...Object.fromEntries(
      Object.entries(metadata)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]),
    ),
  });
}
