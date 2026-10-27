import type { SupabaseClient } from "@supabase/supabase-js";

// Use the existing settings store: adding a supplier does not require a schema migration.
const STATUS_KEY = "tempex_catalog_sync";
const LOCK_KEY = "tempex_catalog_sync_lock";
const LEASE_MS = 30 * 60_000;

export type TempexSyncStatus = {
  at: string | null;
  status: "running" | "ok" | "partial" | "error";
  summary: Record<string, unknown> | null;
};

export async function readTempexSyncStatus(db: SupabaseClient): Promise<TempexSyncStatus | null> {
  const { data, error } = await db.from("settings").select("value").eq("key", STATUS_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ? JSON.parse(data.value) as TempexSyncStatus : null;
}

export async function writeTempexSyncStatus(db: SupabaseClient, status: TempexSyncStatus): Promise<void> {
  const { error } = await db.from("settings").upsert({ key: STATUS_KEY, value: JSON.stringify(status), description: "Последна синхронизация на каталога от Tempex" }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export class TempexSyncBusyError extends Error {
  constructor() { super("Вече се изпълнява синхронизация с Tempex. Опитайте след приключването ѝ."); }
}

/** A unique settings key plus compare-and-swap protects concurrent requests across server processes. */
export async function acquireTempexSyncLock(db: SupabaseClient): Promise<() => Promise<void>> {
  const value = JSON.stringify({ token: crypto.randomUUID(), expiresAt: Date.now() + LEASE_MS });
  const inserted = await db.from("settings").insert({ key: LOCK_KEY, value, description: "Заключване на Tempex синхронизация" });
  if (inserted.error) {
    if (inserted.error.code !== "23505") throw new Error(inserted.error.message);
    const { data, error } = await db.from("settings").select("value").eq("key", LOCK_KEY).single();
    if (error) throw new Error(error.message);
    const lease = JSON.parse(data.value) as { expiresAt: number };
    if (lease.expiresAt > Date.now()) throw new TempexSyncBusyError();
    const taken = await db.from("settings").update({ value }).eq("key", LOCK_KEY).eq("value", data.value).select("key");
    if (taken.error) throw new Error(taken.error.message);
    if (!taken.data?.length) throw new TempexSyncBusyError();
  }
  return async () => {
    const { error } = await db.from("settings").delete().eq("key", LOCK_KEY).eq("value", value);
    if (error) throw new Error(error.message);
  };
}
