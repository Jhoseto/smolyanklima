/** Allow only same-site relative paths after login (no open redirects). */
export function safeRedirectPath(next: string | undefined | null, fallback = '/admin'): string {
  if (!next || typeof next !== 'string') return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  if (/^\/https?:/i.test(trimmed)) return fallback;
  if (trimmed.length > 512) return fallback;
  return trimmed;
}
