/**
 * Offline-first fetch обвивка.
 *
 * Поведение:
 *   - online + успех → пише в cache + връща сървърния отговор
 *   - offline / мрежова грешка → пише в queue, връща оптимистичен отговор от локалния cache
 *
 * Подходящо за документи, които потребителят попълва на терен.
 */
import {
  idbDelete,
  idbGet,
  idbPut,
  type CachedDocument,
  type DocKind,
  type HttpMethod,
  type IdMapEntry,
} from "./db";
import { enqueueMutation, resolveServerId, setIdMap } from "./queue";

export interface OfflineSendOpts<TBody = unknown, TData = unknown> {
  kind: DocKind;
  method: HttpMethod;
  endpoint: string;
  body?: TBody;
  /** Локален UUID — задължителен при POST, за да трекваме новосъздадения запис. */
  localId?: string;
  /** При success → как да изчислиш ключа за cache от response (default: data.id). */
  pickKey?: (resp: TData) => string | undefined;
  /** Оптимистична подбана за UI при offline (мерж-ва с тялото). */
  optimisticData?: TData;
}

export interface OfflineSendResult<TData = unknown> {
  ok: boolean;
  data?: TData;
  /** true = записът е в IndexedDB и чака изпращане. */
  queued: boolean;
  /** Ключ, под който документът се намира локално (localId или serverId). */
  key?: string;
  error?: string;
}

/**
 * Генерира UUID v4 — за нови документи без сървърен id.
 * Не разчита на crypto.randomUUID, защото някои стари мобилни Safari версии нямат.
 */
export function newLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `local-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isLocalId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("local-");
}

function summarizeServerErrorText(txt: string, httpStatus: number): string {
  const t = txt.trim();
  if (!t) return `HTTP ${httpStatus} — сървърът върна празен отговор`;
  try {
    const j = JSON.parse(t) as { error?: string };
    if (j && typeof j.error === "string" && j.error.trim()) return j.error.trim();
  } catch { /* не е JSON */ }
  return t.length > 500 ? `${t.slice(0, 499)}…` : t;
}

/**
 * Изпраща мутация. При мрежова грешка / offline я слага в опашка.
 */
export async function offlineSend<TBody = unknown, TData = unknown>(
  opts: OfflineSendOpts<TBody, TData>
): Promise<OfflineSendResult<TData>> {
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;

  let cacheKey: string | undefined;
  if (opts.method !== "DELETE") {
    cacheKey = await writeOptimisticCache(opts);
  }

  if (isOnline) {
    try {
      let endpoint = opts.endpoint;
      if (endpoint.includes(":localId") && opts.localId) {
        const sid = await resolveServerId(opts.localId);
        if (!sid) {
          await enqueueMutation({
            kind: opts.kind, method: opts.method, endpoint: opts.endpoint,
            body: opts.body, localId: opts.localId,
            initialError: "Очаква се първи успешен запис (POST) преди обновяване.",
          });
          return { ok: true, queued: true, key: cacheKey };
        }
        endpoint = endpoint.replace(":localId", sid);
      }

      const init: RequestInit = {
        method: opts.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      };
      if (opts.body !== undefined && opts.method !== "DELETE") {
        init.body = JSON.stringify(opts.body);
      }
      const res = await fetch(endpoint, init);
      if (!res.ok && res.status !== 204) {
        const txt = await res.text().catch(() => "");
        if (res.status >= 500) {
          const errMsg = summarizeServerErrorText(txt, res.status);
          await enqueueMutation({
            kind: opts.kind, method: opts.method, endpoint: opts.endpoint,
            body: opts.body, localId: opts.localId,
            initialError: errMsg,
          });
          return { ok: true, queued: true, key: cacheKey, error: errMsg };
        }
        return {
          ok: false,
          queued: false,
          key: cacheKey,
          error: summarizeServerErrorText(txt, res.status) || `HTTP ${res.status}`,
        };
      }

      let data: TData | undefined;
      try {
        if (res.status !== 204) {
          const json = await res.json();
          data = (json?.data ?? json) as TData;
        }
      } catch { /* ignore */ }

      if (opts.method === "POST" && opts.localId && data) {
        const serverKey = opts.pickKey ? opts.pickKey(data) : (data as { id?: string }).id;
        if (serverKey) {
          await setIdMap(opts.localId, serverKey, opts.kind);
          await migrateDocumentKey(opts.localId, serverKey, opts.kind, data);
          cacheKey = serverKey;
        }
      } else if (data && cacheKey) {
        await writeDocument(cacheKey, opts.kind, data, false, opts.localId);
      }

      return { ok: true, queued: false, key: cacheKey, data };
    } catch (e) {
      const netMsg =
        e instanceof Error ? e.message : "Неуспешна връзка със сървъра";
      await enqueueMutation({
        kind: opts.kind, method: opts.method, endpoint: opts.endpoint,
        body: opts.body, localId: opts.localId,
        initialError: `Мрежа/връзка: ${netMsg}`,
      });
      return { ok: true, queued: true, key: cacheKey, error: netMsg };
    }
  }

  await enqueueMutation({
    kind: opts.kind, method: opts.method, endpoint: opts.endpoint,
    body: opts.body, localId: opts.localId,
    initialError: "Няма мрежова връзка — записът е в опашката.",
  });
  return { ok: true, queued: true, key: cacheKey };
}

async function writeOptimisticCache<TBody, TData>(opts: OfflineSendOpts<TBody, TData>): Promise<string | undefined> {
  let key = opts.localId;
  if (!key) {
    const m = opts.endpoint.match(/\/([0-9a-fA-F-]{8,})(?:$|\?)/);
    key = m?.[1];
  }
  if (!key) return undefined;
  const body = opts.body && typeof opts.body === "object" ? opts.body : opts.optimisticData;
  if (!body) return key;
  await writeDocument(key, opts.kind, body as TData, true, opts.localId);
  return key;
}

async function writeDocument<TData>(
  key: string,
  kind: DocKind,
  data: TData,
  dirty: boolean,
  localId?: string
): Promise<void> {
  const existing = await idbGet<CachedDocument<TData>>("documents", key);
  const merged: CachedDocument<TData> = {
    key,
    kind,
    localId: existing?.localId ?? localId ?? key,
    serverId: existing?.serverId,
    data: existing
      ? { ...(existing.data as object), ...(data as object) } as TData
      : data,
    updatedAt: Date.now(),
    // false = успешен отговор от сървъра → изчистваме dirty; true = оптимистичен офлайн запис.
    // (Предишното `|| existing.dirty` оставяше „Чака мрежа“ завинаги след успешен PUT.)
    dirty,
  };
  await idbPut("documents", merged);
}

/**
 * Премества cache документ от localId към serverId след първи успешен POST.
 *
 * Merge стратегия: `latestData` от сървъра обикновено връща САМО id/status
 * (бекендът не репликира цялата форма). Не искаме да заличаваме попълнените
 * полета (mount_types, materials, signatures…). Затова old.data винаги е основата,
 * а latestData насложва само върнатите полета.
 */
async function migrateDocumentKey<TData>(
  localId: string,
  serverId: string,
  kind: DocKind,
  latestData?: TData,
): Promise<void> {
  const old = await idbGet<CachedDocument<TData>>("documents", localId);
  const baseData = (old?.data as object | undefined) ?? {};
  const overlay = (latestData as object | undefined) ?? {};
  const merged: CachedDocument<TData> = {
    key: serverId,
    kind,
    localId,
    serverId,
    data: { ...baseData, ...overlay } as TData,
    updatedAt: Date.now(),
    dirty: false,
  };
  await idbPut("documents", merged);
  if (old && localId !== serverId) await idbDelete("documents", localId);
}

/** Чете документ от cache (за initial render когато няма мрежа). */
export async function offlineGet<TData = unknown>(
  key: string
): Promise<CachedDocument<TData> | undefined> {
  const direct = await idbGet<CachedDocument<TData>>("documents", key);
  if (direct) return direct;
  const map = await idbGet<IdMapEntry>("id_map", key);
  if (map?.serverId) {
    return await idbGet<CachedDocument<TData>>("documents", map.serverId);
  }
  return undefined;
}
