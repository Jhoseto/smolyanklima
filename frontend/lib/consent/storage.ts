import {
  ACCEPT_ALL,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  NECESSARY_ONLY,
  type ConsentPreferences,
  type CookieConsent,
} from './types';

function isValidConsent(value: unknown): value is CookieConsent {
  if (!value || typeof value !== 'object') return false;
  const v = value as CookieConsent;
  return (
    v.version === CONSENT_VERSION &&
    typeof v.updatedAt === 'number' &&
    v.necessary === true &&
    typeof v.functional === 'boolean' &&
    typeof v.analytics === 'boolean' &&
    typeof v.marketing === 'boolean'
  );
}

export function readConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidConsent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeConsent(prefs: ConsentPreferences): CookieConsent {
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    updatedAt: Date.now(),
    necessary: true,
    ...prefs,
  };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  return consent;
}

export function hasStoredConsent(): boolean {
  return readConsent() !== null;
}

export { ACCEPT_ALL, NECESSARY_ONLY };
