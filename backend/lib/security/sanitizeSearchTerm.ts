/** Strip PostgREST filter metacharacters from user search terms. */
export function sanitizeIlikeTerm(raw: string, maxLen = 80): string {
  return raw
    .trim()
    .slice(0, maxLen)
    .replace(/[,()%.\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Разделя търсенето на значими части — редът не е важен („Mitsubishi 35VG“ → name match). */
export function tokenizeSearchQuery(raw: string, maxTokens = 10): string[] {
  const base = sanitizeIlikeTerm(raw, 200);
  if (!base) return [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const part of base.toLowerCase().split(/[\s\-_/]+/)) {
    const t = part.trim();
    if (!t) continue;
    if (t.length < 2 && !/\d/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    tokens.push(t);
    if (tokens.length >= maxTokens) break;
  }
  return tokens;
}
