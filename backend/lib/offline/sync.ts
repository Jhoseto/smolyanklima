/**
 * Sync engine — обхожда mutation_queue и изпраща чакащите заявки към сървъра.
 * Свободен от UI dependency-та — може да се извика и от service worker контекст.
 */
import {
  countPendingMutations,
  clearIdMap,
  deleteMutation,
  listPendingMutations,
  markError,
  markSyncing,
  purgeObsoleteQueueMutations,
  resetStaleSyncing,
  resolveServerId,
  setIdMap,
  updateMutation,
} from "./queue";
import {
  cleanupOldDocuments,
  getOfflineDb,
  idbDelete,
  idbGet,
  idbPut,
  listCachedDocuments,
  purgeUnsupportedCachedDocuments,
  purgeUnsupportedIdMapEntries,
  type CachedDocument,
  type DocKind,
} from "./db";
import { parseOfflineApiError, sanitizeAcceptanceProtocolBody } from "./acceptancePayload";

function isLocalDocumentId(id: string): boolean {
  return id.startsWith("local-");
}

const MAX_RETRIES = 5;
const LOCK_NAME = "sk-offline-sync";

function sanitizeMutationBody(kind: DocKind, body: unknown): unknown {
  if (kind !== "acceptance" || !body || typeof body !== "object") return body;
  return sanitizeAcceptanceProtocolBody(body as Record<string, unknown>);
}

function isStaleProtocolMutation(method: string, status: number, errText: string): boolean {
  if (method !== "PUT") return false;
  if (status === 404) return true;
  const msg = (parseOfflineApiError(errText) ?? errText).toLowerCase();
  return msg.includes("cannot coerce") || msg.includes("не е намерен");
}

/** UUID в пътя на endpoint след успешна мутация — синхронизираме `dirty` в кеша. */
const ID_IN_API_PATH =
  /\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|\?|$)/;

/**
 * След успешен PUT/PATCH/DELETE от опашката: маркираме кеша като чист или го махаме.
 * (POST се грижи `migrateDocumentKey`.)
 */
async function reconcileDocumentCacheAfterMutation(endpoint: string, method: string): Promise<void> {
  const match = endpoint.match(ID_IN_API_PATH);
  const id = match?.[1];
  if (!id) return;

  if (method === "DELETE") {
    await idbDelete("documents", id);
    return;
  }

  if (method === "PUT" || method === "PATCH") {
    const doc = await idbGet<CachedDocument>("documents", id);
    if (!doc) return;
    await idbPut("documents", { ...doc, dirty: false, updatedAt: Date.now() });
  }
}

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
 * Качва локални протоколи, които са само в IndexedDB (без запис в mutation_queue).
 * Случва се при прекъснат sync или изчистена опашка с останал кеш.
 */
export async function syncOrphanedLocalDocuments(): Promise<number> {
  let recovered = 0;
  try {
    const cached = await listCachedDocuments<Record<string, unknown>>("acceptance");
    for (const doc of cached) {
      if (!isLocalDocumentId(doc.key)) continue;
      if (await resolveServerId(doc.key)) continue;
      const hasPending = (await listPendingMutations()).some(
        (m) => m.localId === doc.key || m.endpoint.includes(doc.key),
      );
      if (hasPending) continue;
      const sid = await attemptRecoveryPost(doc.key, doc.kind, doc.data);
      if (sid) recovered += 1;
    }
  } catch { /* IDB недостъпен */ }
  return recovered;
}

/** Нулира заседнали PUT/POST грешки (напр. „Cannot coerce“), за да може „Качи сега“ да помогне. */
async function resetRecoverableAcceptanceMutations(): Promise<number> {
  let n = 0;
  try {
    const pending = await listPendingMutations();
    const all = pending.filter((m) => m.kind === "acceptance" && m.retries >= MAX_RETRIES);
    for (const m of all) {
      if (!m.id) continue;
      const err = (parseOfflineApiError(m.lastError) ?? m.lastError ?? "").toLowerCase();
      const recoverable =
        m.method === "POST" ||
        (m.method === "PUT" &&
          (err.includes("cannot coerce") ||
            err.includes("не е намерен") ||
            err.includes("не съществува")));
      if (!recoverable) continue;
      if (m.localId) await clearIdMap(m.localId);
      await updateMutation(m.id, { status: "pending", retries: 0, lastError: undefined });
      n += 1;
    }
  } catch { /* IDB */ }
  return n;
}

/**
 * Пълен sync: recovery на „сираци“ + flush на опашката.
 */
export async function syncAllPending(): Promise<SyncResult> {
  await resetRecoverableAcceptanceMutations();
  await syncOrphanedLocalDocuments();
  return flushQueue();
}

/**
 * Веднъж при mount на админ панела:
 *   0) Премахва исторически offline записи за видове, които вече не се синхронизират.
 *   1) Изчиства "syncing" мутации, които са останали зомби от убит tab/SW (P3).
 *   2) Изтрива стари clean cached документи > 30 дни (P11) — пазим IDB quota.
 * Безопасно е да се вика няколко пъти — idempotent.
 */
export async function bootstrapOfflineQueue(): Promise<void> {
  try {
    await purgeObsoleteQueueMutations();
  } catch { /* IDB не е достъпен */ }
  try {
    await purgeUnsupportedCachedDocuments();
    await purgeUnsupportedIdMapEntries();
  } catch { /* best-effort */ }
  try {
    await resetStaleSyncing();
  } catch { /* IDB не е достъпен */ }
  try {
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
        let sid = await resolveServerId(m.localId);
        if (!sid) {
          const hasPendingPost = pending.some(
            (p) => p.method === "POST" && p.localId === m.localId && p.id !== m.id,
          );
          if (!hasPendingPost) {
            sid = await attemptRecoveryPost(m.localId, m.kind, m.body as Record<string, unknown> | undefined);
          }
        }
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
        init.body = JSON.stringify(sanitizeMutationBody(m.kind, m.body));
      }
      if (m.idempotencyKey) {
        init.headers = { ...init.headers, "Idempotency-Key": m.idempotencyKey };
      } else if (m.method === "POST" && m.localId) {
        init.headers = { ...init.headers, "Idempotency-Key": m.localId };
      }

      let res = await fetch(endpoint, init);
      if (!res.ok && res.status !== 204) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        const readable = parseOfflineApiError(errText) ?? errText;

        if (isStaleProtocolMutation(m.method, res.status, errText) && m.localId) {
          await clearIdMap(m.localId);
          const sid = await attemptRecoveryPost(
            m.localId,
            m.kind,
            m.body as Record<string, unknown> | undefined,
          );
          if (sid) {
            endpoint = m.endpoint.includes(":localId")
              ? m.endpoint.replace(":localId", sid)
              : endpoint.replace(
                  /\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
                  `/${sid}`,
                );
            init.body =
              m.body !== undefined && m.method !== "DELETE"
                ? JSON.stringify(sanitizeMutationBody(m.kind, m.body))
                : undefined;
            res = await fetch(endpoint, init);
            if (res.ok || res.status === 204) {
              if (m.method !== "POST") {
                await reconcileDocumentCacheAfterMutation(endpoint, m.method);
              }
              await deleteMutation(m.id);
              flushed += 1;
              continue;
            }
          }
        }

        const isClientErr = res.status >= 400 && res.status < 500;
        if (isClientErr) {
          await markError(m.id, readable);
          await updateMutation(m.id, { retries: MAX_RETRIES });
          failed += 1;
        } else {
          await markError(m.id, readable);
        }
        continue;
      }

      // Успех: ако POST-ът върна нов id, запази mapping.
      if (m.method === "POST" && m.localId) {
        try {
          const json = await res.clone().json();
          const serverData: Record<string, unknown> | undefined = json?.data ?? json;
          const serverId: string | undefined =
            (serverData as { id?: string } | undefined)?.id;
          if (serverId) {
            await setIdMap(m.localId, serverId, m.kind);
            await migrateDocumentKey(m.localId, serverId, serverData);
          }
        } catch {
          /* без JSON отговор е ОК */
        }
      } else {
        await reconcileDocumentCacheAfterMutation(endpoint, m.method);
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
 * Overlay-ва само id/status от сървъра — останалото (mount_types, materials,
 * signatures) идва от потребителя и не трябва да се презапише от частичния
 * POST отговор. Същата стратегия като в offlineFetch.ts.
 */
async function migrateDocumentKey(
  localId: string,
  serverId: string,
  serverData?: Record<string, unknown>,
): Promise<void> {
  const old = await idbGet<CachedDocument>("documents", localId);
  if (!old) return;
  const safeOverlay: Record<string, unknown> = {};
  if (serverData) {
    if (serverData.id)     safeOverlay.id = serverData.id;
    if (serverData.status) safeOverlay.status = serverData.status;
  }
  const next: CachedDocument = {
    ...old,
    key: serverId,
    serverId,
    data: { ...(old.data as object), ...safeOverlay },
    dirty: false,
    updatedAt: Date.now(),
  };
  await idbPut("documents", next);
  if (localId !== serverId) {
    await idbDelete("documents", localId);
  }
}

/** POST от локален кеш, когато PUT е в опашката, но липсва POST. */
async function attemptRecoveryPost(
  localId: string,
  kind: DocKind,
  body?: Record<string, unknown>,
): Promise<string | undefined> {
  const doc = await idbGet<CachedDocument<Record<string, unknown>>>("documents", localId);
  let payload = doc?.data;
  if ((!payload || typeof payload !== "object") && body && typeof body === "object") {
    payload = body;
  } else if (payload && body && typeof body === "object") {
    payload = { ...payload, ...body };
  }
  if (!payload || typeof payload !== "object") return undefined;
  payload = sanitizeAcceptanceProtocolBody(payload);

  const init: RequestInit = {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": localId,
    },
    body: JSON.stringify(payload),
  };
  const res = await fetch("/api/admin/service/protocols", init);
  if (!res.ok && res.status !== 204) return undefined;

  try {
    const json = await res.json();
    const serverData: Record<string, unknown> | undefined = json?.data ?? json;
    const serverId: string | undefined = (serverData as { id?: string } | undefined)?.id;
    if (!serverId) return undefined;
    await setIdMap(localId, serverId, kind);
    await migrateDocumentKey(localId, serverId, serverData);
    return serverId;
  } catch {
    return undefined;
  }
}

/** Удобен helper: dump на сурова база (за SW). */
export { getOfflineDb };
