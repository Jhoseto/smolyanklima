export const CONSENT_VERSION = 1 as const;
export const CONSENT_STORAGE_KEY = 'sk_cookie_consent_v1';

export interface CookieConsent {
  version: typeof CONSENT_VERSION;
  updatedAt: number;
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export type ConsentCategory = 'functional' | 'analytics' | 'marketing';

export interface ConsentPreferences {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export const NECESSARY_ONLY: ConsentPreferences = {
  functional: false,
  analytics: false,
  marketing: false,
};

export const ACCEPT_ALL: ConsentPreferences = {
  functional: true,
  analytics: true,
  marketing: true,
};
