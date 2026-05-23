export const MAX_COMPARE = 3;

export function parseCompareParam(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const ids = raw
    .split(',')
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean);
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

export function buildCompareParam(ids: string[]): string {
  return ids.filter(Boolean).slice(0, MAX_COMPARE).join(',');
}

export function buildCompareShareUrl(ids: string[], openTable = true): string {
  const params = new URLSearchParams();
  const compare = buildCompareParam(ids);
  if (compare) params.set('compare', compare);
  if (openTable && ids.length >= 2) params.set('openCompare', '1');
  const qs = params.toString();
  return `${window.location.origin}/catalog${qs ? `?${qs}` : ''}`;
}
