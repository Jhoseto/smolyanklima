const STORAGE_PREFIX = "sk-sales-report-ai-v4:";

export type CachedSalesReportAnalysis = {
  text: string;
  generatedAt: string;
  queryKey: string;
};

/** Стабилен ключ само от филтрите — без token/време. */
export function normalizeSalesReportQueryKey(queryString: string): string {
  const sp = new URLSearchParams(queryString);
  return [...sp.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function storageKey(queryKey: string): string {
  return `${STORAGE_PREFIX}${queryKey}`;
}

export function loadSalesReportAnalysisCache(queryString: string): CachedSalesReportAnalysis | null {
  if (typeof window === "undefined") return null;
  const queryKey = normalizeSalesReportQueryKey(queryString);
  try {
    const raw = localStorage.getItem(storageKey(queryKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSalesReportAnalysis;
    if (parsed.queryKey !== queryKey || !parsed.text?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSalesReportAnalysisCache(
  queryString: string,
  text: string,
  generatedAt: string,
): void {
  if (typeof window === "undefined") return;
  const queryKey = normalizeSalesReportQueryKey(queryString);
  const entry: CachedSalesReportAnalysis = { text, generatedAt, queryKey };
  try {
    localStorage.setItem(storageKey(queryKey), JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}
