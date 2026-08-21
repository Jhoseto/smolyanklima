import { ADMIN_CATALOG_BULK_CHUNK_SIZE } from "./catalogBulkLimits";

type BulkJson = { error?: string; warning?: string; affected?: number };

/** Хвърля се, когато сървърът иска изрично потвърждение (409 + warning) преди да продължи. */
export class BulkConfirmRequiredError extends Error {
  warning: string;
  constructor(warning: string) {
    super(warning);
    this.name = "BulkConfirmRequiredError";
    this.warning = warning;
  }
}

/**
 * Изпълнява POST /bulk на парчета — обхожда лимита от 200 id на заявка.
 */
export async function postAdminCatalogBulkInChunks(
  url: string,
  ids: string[],
  bodyWithoutIds: Record<string, unknown>,
  chunkSize = ADMIN_CATALOG_BULK_CHUNK_SIZE,
): Promise<number> {
  if (ids.length === 0) return 0;
  let affected = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...bodyWithoutIds, ids: chunk }),
    });
    const json = (await res.json().catch(() => ({}))) as BulkJson;
    if (res.status === 409 && json.warning) {
      throw new BulkConfirmRequiredError(json.warning);
    }
    if (!res.ok) {
      throw new Error(json.error || `Грешка при масова операция (${i + 1}–${i + chunk.length} от ${ids.length})`);
    }
    affected += json.affected ?? chunk.length;
  }
  return affected;
}
