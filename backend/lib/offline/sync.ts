/**
 * Sync engine — обхожда mutation_queue и изпраща чакащите заявки към сървъра.
 * Свободен от UI dependency-та — може да се извика и от service worker контекст.
 */
import {
  countPendingMutations,
  deleteMutation,
  listPendingMutations,
  markError,
  markSyncing,
  resetStaleSyncing,
  resolveServerId,
  setIdMap,
  updateMutation,
} from "./queue";
import {
  getOfflineDb,
  idbDelete,
  idbGet,
  idbPut,
  type CachedDocument,
} from "./db";

const MAX_RETRIES = 5;
const LOCK_NAME = "sk-offline-sync";

export interface SyncResult {
  flushed: number;
  failed: number;
  remaining: number;
}

let inflight: Promise<SyncResult> | null = null;

/**
 * Опитва се да изпрати всички pending mutations.
 * Идемпотентна:
 *   • повторни извиквания в същия tab → reuse-ват вече течащ flush (`inflight`).
 *   • multi-tab → Web Locks API гарантира, че само един tab flush-ва наведнъж
 *     (предотвратява двойни заявки към сървъра).
 *   • Service Worker също използва същия lock name — не се състезава с tab-овете.
 */
export function flushQueue(): Promise<SyncResult> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // Multi-tab защита: ако друг tab вече flush-ва, изчакваме (или връщаме празно).
      if (typeof navigator !== "undefined" && "locks" in navigator) {
        const lockedResult = await navigator.locks.request(
          LOCK_NAME,
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              // Друг tab/SW в момента държи lock-а → връщаме празен резултат.
              // Той ще flush-ва вместо нас.
              return { flushed: 0, failed: 0, remaining: await countPendingMutations() };
            }
            return doFlush();
          },
        );
        return lockedResult as SyncResult;
      }
      return await doFlush();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Веднъж при mount на админ панела:
 *   1) Изчиства "syncing" мутации, които са останали зомби от убит tab/SW (P3).
 *   2) Изтрива стари clean cached документи > 30 дни (P11) — пазим IDB quota.
 * Безопасно е да се вика няколко пъти — idempotent.
 */
export async function bootstrapOfflineQueue(): Promise<void> {
  try {
    await resetStaleSyncing();
  } catch { /* IDB не е достъпен */ }
  try {
    const { cleanupOldDocuments } = await import("./db");
    await cleanupOldDocuments();
  } catch { /* best-effort */ }
}

async function doFlush(): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { flushed: 0, failed: 0, remaining: await countPendingMutations() };
  }

  const pending = await listPendingMutations();
  let flushed = 0;
  let failed = 0;

  for (const m of pending) {
    if (!m.id) continue;
    if (m.retries >= MAX_RETRIES) {
      failed += 1;
      continue;
    }
    try {
      await markSyncing(m.id);

      // Заместване на :localId с реален server id, ако вече сме го получили.
      let endpoint = m.endpoint;
      if (endpoint.includes(":localId") && m.localId) {
        const sid = await resolveServerId(m.localId);
        if (!sid) {
          await updateMutation(m.id, { status: "pending" });
          continue;
        }
        endpoint = endpoint.replace(":localId", sid);
      }

      const init: RequestInit = {
        method: m.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      };
      if (m.body !== undefined && m.method !== "DELETE") {
        init.body = JSON.stringify(m.body);
      }
      if (m.idempotencyKey) {
        init.headers = { ...init.headers, "Idempotency-Key": m.idempotencyKey };
      }

      const res = await fetch(endpoint, init);
      if (!res.ok && res.status !== 204) {
        const isClientErr = res.status >= 400 && res.status < 500;
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        if (isClientErr) {
          await markError(m.id, errText);
          await updateMutation(m.id, { retries: MAX_RETRIES });
          failed += 1;
        } else {
          await markError(m.id, errText);
        }
        continue;
      }

      // Успех: ако POST-ът върна нов id, запази mapping.
      if (m.method === "POST" && m.localId) {
        try {
          const json = await res.clone().json();
          const serverId: string | undefined = json?.data?.id ?? json?.id;
          if (serverId) {
            await setIdMap(m.localId, serverId, m.kind);
            await migrateDocumentKey(m.localId, serverId);
          }
        } catch {
          /* без JSON отговор е ОК */
        }
      }

      await deleteMutation(m.id);
      flushed += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (m.id) await markError(m.id, msg);
      failed += 1;
    }
  }

  return {
    flushed,
    failed,
    remaining: await countPendingMutations(),
  };
}

/**
 * Премества cached документ от localId към serverId, маркира го като clean.
 * Запазва съществуващото data (попълнено от потребителя на терен) —
 * сървърният отговор обикновено връща само id/status, не цялата форма.
 */
async function migrateDocumentKey(localId: string, serverId: string): Promise<void> {
  const old = await idbGet<CachedDocument>("documents", localId);
  if (!old) return;
  const next: CachedDocument = {
    ...old,
    key: serverId,
    serverId,
    dirty: false,
    updatedAt: Date.now(),
    // data не се пипа — попълненото от потребителя е истината.
  };
  await idbPut("documents", next);
  if (localId !== serverId) {
    await idbDelete("documents", localId);
  }
}

/** Удобен helper: dump на сурова база (за SW). */
export { getOfflineDb };
