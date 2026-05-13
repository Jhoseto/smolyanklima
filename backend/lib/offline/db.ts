/**
 * Лек native IndexedDB wrapper за offline-first работа в админ панела.
 *
 * Без външни зависимости (умишлено) — Promise-обвивка над IDBRequest.
 *
 * Структура:
 *   - documents       : кеш на отворени документи (по тип + сървърен/локален ID)
 *   - mutation_queue  : чакащи POST/PUT/DELETE заявки докато няма мрежа
 *   - id_map          : връзка localId → serverId след първи успешен POST
 *
 * Това е общ слой — НЕ е свързан с конкретен тип документ.
 * Всеки тип (acceptance, service-protocol, offer…) подава "kind" и "endpoint".
 *
 * Multi-tab safety:
 *   - `onversionchange` затваря базата ако друг tab пуска нова версия (виж P10).
 *   - `clearOfflineDb` използва readwrite tx за всички stores наведнъж.
 */

export type DocKind = "acceptance" | "offer" | "invoice" | "warranty";

const SUPPORTED_OFFLINE_KINDS = new Set<string>(["acceptance", "offer", "invoice", "warranty"]);

/** Дали този вид още участва в offline кеша/опашката (исторически видове се чистят при bootstrap). */
export function isSupportedOfflineKind(kind: string): boolean {
  return SUPPORTED_OFFLINE_KINDS.has(kind);
}
export type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";
export type QueueStatus = "pending" | "syncing" | "error";

/** Имена на stores — литерален union за compile-time safety (виж P12). */
export type StoreName = "documents" | "mutation_queue" | "id_map";

export interface CachedDocument<T = unknown> {
  /** Локален ключ — съвпада със серверния id, ако е известен, иначе localId. */
  key: string;
  kind: DocKind;
  /** Локален UUID, генериран при offline create (може да съвпада с key, ако още няма server id). */
  localId: string;
  /** Server UUID, известен след първи успешен sync. */
  serverId?: string;
  /** Сурова data, готова за рендер (последно known състояние). */
  data: T;
  updatedAt: number;
  /** Маркер: има ли неизпратени промени за този документ. */
  dirty: boolean;
}

export interface QueuedMutation {
  /** Auto-incremented PK. */
  id?: number;
  kind: DocKind;
  method: HttpMethod;
  /** Endpoint темплейт; ако съдържа :localId, ще се замени със serverId преди изпращане. */
  endpoint: string;
  /** Body на заявката (за POST/PUT/PATCH). */
  body?: unknown;
  /** За POST: какъв localId е създаден; служи за mapping след отговор. */
  localId?: string;
  /** Подреден отпечатък за идемпотентност (по избор). */
  idempotencyKey?: string;
  status: QueueStatus;
  retries: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface IdMapEntry {
  localId: string;
  serverId: string;
  kind: DocKind;
  createdAt: number;
}

const DB_NAME = "sk-admin-offline";
/**
 * Версия 2 (P8): премахваме невалидния `by-dirty` index — boolean keypath
 * не е валиден IDB key и индексът беше dead.
 *  v1 → v2 миграция: deleteIndex("by-dirty"), запазваме данните.
 */
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getOfflineDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB не е достъпен в тази среда (SSR?)"));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        const oldVersion = event.oldVersion;

        // Първоначално създаване (нова DB)
        if (oldVersion < 1) {
          const docs = db.createObjectStore("documents", { keyPath: "key" });
          docs.createIndex("by-kind", "kind");
          const q = db.createObjectStore("mutation_queue", { keyPath: "id", autoIncrement: true });
          q.createIndex("by-status", "status");
          q.createIndex("by-createdAt", "createdAt");
          db.createObjectStore("id_map", { keyPath: "localId" });
        }

        // v1 → v2: махаме мъртвия by-dirty index (P8)
        if (oldVersion < 2 && db.objectStoreNames.contains("documents")) {
          const docs = req.transaction!.objectStore("documents");
          if (docs.indexNames.contains("by-dirty")) {
            docs.deleteIndex("by-dirty");
          }
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // P10: ако друг tab отвори нова версия на DB-то, я затваряме чисто,
        // за да не блокираме upgrade-а и да позволим reopen с новата schema.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          // Reset on unexpected close (напр. потребителят е изчистил site data).
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
      req.onblocked = () => {
        // Друг tab държи стара версия отворена → ще получим versionchange там.
        // Не fail-ваме — изчакваме браузъра да резолвне.
      };
    });
  }
  return dbPromise;
}

/** Promise-обвивка над IDBRequest. */
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Promise за приключване на транзакция. */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* ─── CRUD helpers (generic) ──────────────────────────────────────────────── */

export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await getOfflineDb();
  const tx = db.transaction(store, "readonly");
  const result = await reqToPromise<T | undefined>(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
  await txDone(tx);
  return result;
}

export async function idbPut<T>(store: StoreName, value: T): Promise<IDBValidKey> {
  const db = await getOfflineDb();
  const tx = db.transaction(store, "readwrite");
  const key = await reqToPromise<IDBValidKey>(
    tx.objectStore(store).put(value as object) as IDBRequest<IDBValidKey>
  );
  await txDone(tx);
  return key;
}

export async function idbAdd<T>(store: StoreName, value: T): Promise<IDBValidKey> {
  const db = await getOfflineDb();
  const tx = db.transaction(store, "readwrite");
  const key = await reqToPromise<IDBValidKey>(tx.objectStore(store).add(value as object) as IDBRequest<IDBValidKey>);
  await txDone(tx);
  return key;
}

export async function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(store, "readwrite");
  await reqToPromise<undefined>(tx.objectStore(store).delete(key) as IDBRequest<undefined>);
  await txDone(tx);
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await getOfflineDb();
  const tx = db.transaction(store, "readonly");
  const result = await reqToPromise<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>);
  await txDone(tx);
  return result;
}

export async function idbGetAllFromIndex<T>(
  store: Exclude<StoreName, "id_map">,
  indexName: string,
  query?: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const db = await getOfflineDb();
  const tx = db.transaction(store, "readonly");
  const idx = tx.objectStore(store).index(indexName);
  const result = await reqToPromise<T[]>(idx.getAll(query) as IDBRequest<T[]>);
  await txDone(tx);
  return result;
}

/** Връща всички документи за даден `kind` от cache (offline + dirty + clean). */
export async function listCachedDocuments<T = unknown>(kind: DocKind): Promise<CachedDocument<T>[]> {
  const all = await idbGetAllFromIndex<CachedDocument<T>>("documents", "by-kind", kind);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ─── Higher-level helpers ───────────────────────────────────────────────── */

/** Изтрива цялата offline база (използвай при logout или ръчно reset). */
export async function clearOfflineDb(): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(["documents", "mutation_queue", "id_map"], "readwrite");
  await Promise.all([
    reqToPromise(tx.objectStore("documents").clear()),
    reqToPromise(tx.objectStore("mutation_queue").clear()),
    reqToPromise(tx.objectStore("id_map").clear()),
  ]);
  await txDone(tx);
}

/**
 * Изтрива кеширани документи с вид, който вече не се ползва в offline слоя
 * (напр. старо "service_protocol" след преминаване към само online API).
 */
export async function purgeUnsupportedCachedDocuments(): Promise<number> {
  try {
    const all = await idbGetAll<CachedDocument & { kind: string }>("documents");
    let deleted = 0;
    for (const doc of all) {
      if (isSupportedOfflineKind(doc.kind)) continue;
      await idbDelete("documents", doc.key);
      deleted += 1;
    }
    if (deleted > 0) await cleanupOrphanIdMap();
    return deleted;
  } catch {
    return 0;
  }
}

/** Премахва id_map за видове, които вече не са в offline слоя. */
export async function purgeUnsupportedIdMapEntries(): Promise<number> {
  try {
    const maps = await idbGetAll<IdMapEntry & { kind: string }>("id_map");
    let n = 0;
    for (const e of maps) {
      if (isSupportedOfflineKind(e.kind)) continue;
      await idbDelete("id_map", e.localId);
      n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * Storage cleanup (P11): изтрива стари clean (non-dirty) cached документи,
 * за да не превишим IndexedDB quota-та. Dirty записи (с неизпратени промени)
 * никога не се изтриват.
 *
 * @param maxAgeMs   Възраст в милисекунди след която документ се счита за стар (default 30 дни).
 * @returns Брой изтрити записи.
 */
export async function cleanupOldDocuments(
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000,
): Promise<number> {
  try {
    const all = await idbGetAll<CachedDocument>("documents");
    const cutoff = Date.now() - maxAgeMs;
    let deleted = 0;
    for (const doc of all) {
      if (doc.dirty) continue;
      if (doc.updatedAt > cutoff) continue;
      await idbDelete("documents", doc.key);
      deleted += 1;
    }
    // Чистим и id_map за изтрити записи — пазим само за нещо в documents или mutation_queue.
    if (deleted > 0) {
      await cleanupOrphanIdMap();
    }
    return deleted;
  } catch {
    return 0;
  }
}

/**
 * Чисти id_map записи, които вече нямат свързан документ в `documents` или
 * pending mutation в `mutation_queue`. Премахва историческа купчина mapping-и.
 */
async function cleanupOrphanIdMap(): Promise<void> {
  try {
    const maps = await idbGetAll<IdMapEntry>("id_map");
    if (maps.length === 0) return;
    const docs = await idbGetAll<CachedDocument>("documents");
    const mutations = await idbGetAll<QueuedMutation>("mutation_queue");
    const aliveLocalIds = new Set<string>();
    for (const d of docs) {
      aliveLocalIds.add(d.key);
      if (d.localId) aliveLocalIds.add(d.localId);
      if (d.serverId) aliveLocalIds.add(d.serverId);
    }
    for (const m of mutations) {
      if (m.localId) aliveLocalIds.add(m.localId);
    }
    for (const map of maps) {
      if (!aliveLocalIds.has(map.localId) && !aliveLocalIds.has(map.serverId)) {
        await idbDelete("id_map", map.localId);
      }
    }
  } catch { /* best-effort */ }
}
