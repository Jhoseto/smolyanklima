const MAX_ROWS = 50;
const MAX_BYTES = 8192;

export function truncateToolResult<T extends Record<string, unknown>>(payload: T): T & { truncated?: boolean; totalCount?: number } {
  const clone = { ...payload } as T & { truncated?: boolean; totalCount?: number; rows?: unknown[]; data?: unknown[] };

  if (Array.isArray(clone.rows)) {
    const rows = clone.rows;
    if (rows.length > MAX_ROWS) {
      clone.totalCount = rows.length;
      clone.rows = rows.slice(0, MAX_ROWS);
      clone.truncated = true;
    }
  }

  if (Array.isArray(clone.data)) {
    const data = clone.data;
    if (data.length > MAX_ROWS) {
      clone.totalCount = data.length;
      clone.data = data.slice(0, MAX_ROWS);
      clone.truncated = true;
    }
  }

  const json = JSON.stringify(clone);
  if (json.length > MAX_BYTES) {
    return { ...clone, truncated: true, _note: "Резултатът е съкратен по размер." } as T & {
      truncated: boolean;
      _note: string;
    };
  }

  return clone;
}
