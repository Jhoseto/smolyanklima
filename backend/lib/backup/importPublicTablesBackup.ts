import type { SupabaseClient } from "@supabase/supabase-js";

export { previewBackupPayload, type BackupFilePreview } from "./backupManifest";

const BATCH = 400;

/** Колони с FK към таблица, която още не е заредена — null в pass 1, пълни в pass 2. */
const DEFERRED_FK_COLUMNS: Record<string, readonly string[]> = {
  products: ["supplier_order_work_item_id"],
  work_items: ["sale_work_item_id", "installation_work_item_id"],
};

const DEFERRED_TABLES = new Set(Object.keys(DEFERRED_FK_COLUMNS));

/** Ред на зареждане според FK зависимости (родители преди деца). */
export const RESTORE_TABLE_ORDER: string[] = [
  "settings",
  "brands",
  "product_types",
  "categories",
  "category_types",
  "features",
  "contacts",
  "admin_users",
  "newsletter_subscribers",
  "products",
  "accessories",
  "product_catalog_settings",
  "product_specs",
  "product_images",
  "product_features",
  "product_ratings",
  "accessory_images",
  "contact_phones",
  "inquiries",
  "inquiry_products",
  "work_items",
  "service_protocols",
  "service_repair_protocols",
  "live_chats",
  "live_chat_messages",
  "chat_canned_responses",
  "articles",
  "email_outbox",
  "activity_logs",
  "admin_web_push_subscriptions",
];

const UPSERT_ON: Record<string, string> = {
  settings: "key",
  category_types: "category_id,product_type",
  product_features: "product_id,feature_id",
  product_specs: "product_id",
};

export type BackupManifest = {
  format: string;
  formatVersion: number;
  exportedAt: string;
  tables: string[];
  rowCounts?: Record<string, number>;
  tableErrors?: Record<string, string>;
};

export type BackupFilePayload = {
  manifest: BackupManifest;
  data: Record<string, Record<string, unknown>[]>;
};

export type RestoreMode = "merge" | "replace";

export type RestoreResult = {
  mode: RestoreMode;
  tablesProcessed: number;
  rowsInserted: number;
  tableResults: Record<string, { rows: number; error?: string }>;
};

export function parseBackupFile(raw: unknown): BackupFilePayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Невалиден JSON файл.");
  }
  const body = raw as BackupFilePayload;
  if (!body.manifest || !body.data) {
    throw new Error("Липсва manifest или data в архива.");
  }
  if (body.manifest.format !== "smolyanklima-full-json") {
    throw new Error(`Непознат формат: ${body.manifest.format ?? "?"}`);
  }
  if (body.manifest.formatVersion !== 1) {
    throw new Error(`Неподдържана версия: ${body.manifest.formatVersion}`);
  }
  return body;
}

function sortTablesForRestore(tables: string[]): string[] {
  const known = new Set(RESTORE_TABLE_ORDER);
  const ordered = RESTORE_TABLE_ORDER.filter((t) => tables.includes(t));
  const rest = tables.filter((t) => !known.has(t)).sort();
  return [...ordered, ...rest];
}

function truncateTablesForReplace(tables: string[]): string[] {
  return [...sortTablesForRestore(tables)].reverse();
}

function stripDeferredColumns(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const cols = DEFERRED_FK_COLUMNS[table];
  if (!cols?.length) return row;
  const copy = { ...row };
  for (const col of cols) copy[col] = null;
  return copy;
}

async function truncateTables(supabase: SupabaseClient, tables: string[]): Promise<void> {
  const { error } = await supabase.rpc("admin_backup_truncate_tables", { table_names: tables });
  if (error) {
    throw new Error(`Грешка при изчистване на таблици: ${error.message}`);
  }
}

async function upsertBatch(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const onConflict = UPSERT_ON[table] ?? "id";
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(error.message);
}

async function loadTableRows(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  stripDeferred: boolean,
): Promise<number> {
  if (rows.length === 0) return 0;

  let loaded = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((row) => (stripDeferred ? stripDeferredColumns(table, row) : row));
    await upsertBatch(supabase, table, chunk);
    loaded += chunk.length;
  }
  return loaded;
}

async function resetSequences(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("admin_backup_reset_sequences");
  if (error) {
    throw new Error(`Sequences не са синхронизирани: ${error.message}`);
  }
}

export async function importPublicTablesBackup(
  supabase: SupabaseClient,
  payload: BackupFilePayload,
  mode: RestoreMode,
): Promise<RestoreResult> {
  const tables = sortTablesForRestore(Object.keys(payload.data));
  const tableResults: RestoreResult["tableResults"] = {};
  let rowsInserted = 0;

  if (mode === "replace") {
    await truncateTables(supabase, truncateTablesForReplace(tables));
  }

  // Pass 1: всички таблици; products/work_items без кръгови FK колони
  for (const table of tables) {
    const rows = payload.data[table] ?? [];
    try {
      const n = await loadTableRows(supabase, table, rows, DEFERRED_TABLES.has(table));
      tableResults[table] = { rows: n };
      rowsInserted += n;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      tableResults[table] = { rows: 0, error: message };
      throw new Error(`Таблица ${table}: ${message}`);
    }
  }

  // Pass 2: products + work_items с пълните FK връзки
  for (const table of ["products", "work_items"] as const) {
    if (!tables.includes(table)) continue;
    const rows = payload.data[table] ?? [];
    if (rows.length === 0) continue;
    try {
      await loadTableRows(supabase, table, rows, false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Таблица ${table} (FK pass 2): ${message}`);
    }
  }

  await resetSequences(supabase);

  return {
    mode,
    tablesProcessed: tables.length,
    rowsInserted,
    tableResults,
  };
}
