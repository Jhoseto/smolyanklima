/** Strip PostgREST filter metacharacters from user search terms. */
export function sanitizeIlikeTerm(raw: string, maxLen = 80): string {
  return raw
    .trim()
    .slice(0, maxLen)
    .replace(/[,()%.\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
