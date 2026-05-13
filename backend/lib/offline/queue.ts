/**
 * Mutation queue API — append-only опашка с persisted state.
 * Mutations се изпълняват в реда, в който са добавени (FIFO),
 * за да се запази правилен причинно-следствен ред (POST преди PUT на същия запис).
 */
import {
  getOfflineDb,
  idbAdd,
  idbDelete,
  idbGet,
  idbGetAll,
  idbGetAllFromIndex,
  idbPut,
  isSupportedOfflineKind,
  type DocKind,
  type HttpMethod,
  type IdMapEntry,
  type QueuedMutation,
} from "./db";

export interface EnqueueOptions {
  kind: DocKind;
  method: HttpMethod;
  endpoint: string;
  body?: unknown;
  localId?: string;
  idempotencyKey?: string;
  /** Ако е известна веднага (напр. тяло от 5xx отговор). */
  initialError?: string;
}

/**
 * Добавя нова заявка в опашката. Връща id на записа.
 *
 * ВАЖНО — дедупликация (предотвратява дубликати в БД):
 *  • POST със същия localId → ако вече има pending POST за същия запис,
 *    обновяваме body-то му ("последен win"). Това предотвратява multiple POST-ове
 *    при поредни auto-save-ове offline.
 *  • PUT със същия localId/endpoint → обединяваме в едно изпращане
 *    с най-новото body. Спестява заявки и предотвратява състезание.
 *  • DELETE — винаги нов запис (не се дедуплицира).
 */
export async function enqueueMutation(opts: EnqueueOptions): Promise<number> {
  const now = Date.now();

  if (opts.method !== "DELETE") {
    const existing = await findDuplicateMutation(opts);
    if (existing?.id) {
      existing.body = opts.body;
      existing.endpoint = opts.endpoint;
      existing.status = "pending";
      existing.retries = 0;
      existing.lastError = opts.initialError?.trim() || undefined;
      existing.updatedAt = now;
      await idbPut("mutation_queue", existing);
      return existing.id;
    }
  }

  const record: QueuedMutation = {
    kind: opts.kind,
    method: opts.method,
    endpoint: opts.endpoint,
    body: opts.body,
    localId: opts.localId,
    idempotencyKey: opts.idempotencyKey,
    status: "pending",
    retries: 0,
    lastError: opts.initialError?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  const key = await idbAdd("mutation_queue", record);
  return Number(key);
}

/**
 * Намира съществуваща мутация, която ще се замени от новата.
 *  • POST → същи kind + method + localId
 *  • PUT/PATCH → същи kind + method + (localId или endpoint)
 * Връща само мутации в "pending"/"error" статус (не пипа "syncing", за да не
 * прекъсваме активен flush).
 */
async function findDuplicateMutation(opts: EnqueueOptions): Promise<QueuedMutation | null> {
  const all = await idbGetAllFromIndex<QueuedMutation>("mutation_queue", "by-status", "pending");
  const errs = await idbGetAllFromIndex<QueuedMutation>("mutation_queue", "by-status", "error");
  const candidates = [...all, ...errs];
  for (const m of candidates) {
    if (m.kind !== opts.kind || m.method !== opts.method) continue;
    if (opts.method === "POST") {
      if (m.localId && opts.localId && m.localId === opts.localId) return m;
    } else if (opts.method === "PUT" || opts.method === "PATCH") {
      // Match по localId (когато използваме :localId placeholder) или по endpoint.
      if (m.localId && opts.localId && m.localId === opts.localId) return m;
      if (!m.localId && !opts.localId && m.endpoint === opts.endpoint) return m;
    }
  }
  return null;
}

/** Връща всички pending mutations подредени по createdAt asc. */
export async function listPendingMutations(): Promise<QueuedMutation[]> {
  const all = await idbGetAllFromIndex<QueuedMutation>("mutation_queue", "by-createdAt");
  return all.filter(m => m.status !== "syncing" && isSupportedOfflineKind(String(m.kind)));
}

/** Брой неизпратени мутации (само за видове, които още се синхронизират). */
export async function countPendingMutations(): Promise<number> {
  const pending = await idbGetAllFromIndex<QueuedMutation>("mutation_queue", "by-status", "pending");
  const errs = await idbGetAllFromIndex<QueuedMutation>("mutation_queue", "by-status", "error");
  const active = (m: QueuedMutation) => isSupportedOfflineKind(String(m.kind));
  return pending.filter(active).length + errs.filter(active).length;
}

/**
 * Последна запазена грешка от опашката (за UI — „не е интернет, а сървърът отказа“).
 */
export async function getPendingQueueSampleError(): Promise<string | undefined> {
  const active = (m: QueuedMutation) => isSupportedOfflineKind(String(m.kind));
  const pending = (await idbGetAllFromIndex<QueuedMutation>("mutation_queue", "by-status", "pending")).filter(active);
  const errs = (await idbGetAllFromIndex<QueuedMutation>("mutation_queue", "by-status", "error")).filter(active);
  const all = [...pending, ...errs]
    .filter((m): m is QueuedMutation & { lastError?: string } => Boolean(m.lastError?.trim()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return all[0]?.lastError?.trim();
}

/** Маркира мутация като in-progress, за да не я хване друг tab/SW. */
export async function markSyncing(id: number): Promise<void> {
  const rec = await idbGet<QueuedMutation>("mutation_queue", id);
  if (!rec) return;
  rec.status = "syncing";
  rec.updatedAt = Date.now();
  await idbPut("mutation_queue", rec);
}

/** Премахва мутация след успешно изпращане. */
export async function deleteMutation(id: number): Promise<void> {
  await idbDelete("mutation_queue", id);
}

/** Връща мутацията обратно в pending с увеличен retry count и грешка. */
export async function markError(id: number, err: string): Promise<void> {
  const rec = await idbGet<QueuedMutation>("mutation_queue", id);
  if (!rec) return;
  rec.status = "error";
  rec.retries += 1;
  rec.lastError = err;
  rec.updatedAt = Date.now();
  await idbPut("mutation_queue", rec);
}

/** Обновява endpoint и body — използва се за смяна на :localId → serverId. */
export async function updateMutation(id: number, patch: Partial<QueuedMutation>): Promise<void> {
  const rec = await idbGet<QueuedMutation>("mutation_queue", id);
  if (!rec) return;
  Object.assign(rec, patch, { updatedAt: Date.now() });
  await idbPut("mutation_queue", rec);
}

/** ID-map: запазваме връзката localId → serverId след успешен POST. */
export async function setIdMap(localId: string, serverId: string, kind: DocKind): Promise<void> {
  const entry: IdMapEntry = { localId, serverId, kind, createdAt: Date.now() };
  await idbPut("id_map", entry);
}

export async function resolveServerId(localId: string): Promise<string | undefined> {
  const entry = await idbGet<IdMapEntry>("id_map", localId);
  return entry?.serverId;
}

/**
 * Reset на „заседнали" мутации в status="syncing" → "pending".
 * Извиква се веднъж при bootstrap, защото tab/SW може да е бил killed
 * посред flush, оставяйки мутации в неработещ state (виж P3).
 */
export async function resetStaleSyncing(): Promise<number> {
  const syncing = await idbGetAllFromIndex<QueuedMutation>("mutation_queue", "by-status", "syncing");
  let n = 0;
  for (const m of syncing) {
    m.status = "pending";
    m.updatedAt = Date.now();
    await idbPut("mutation_queue", m);
    n += 1;
  }
  return n;
}

/** Изтрива чакащи мутации за видове, които вече не се ползват offline (исторически записи). */
export async function purgeObsoleteQueueMutations(): Promise<number> {
  try {
    const all = await idbGetAll<QueuedMutation & { kind: string }>("mutation_queue");
    let n = 0;
    for (const m of all) {
      if (isSupportedOfflineKind(m.kind)) continue;
      if (m.id == null) continue;
      await idbDelete("mutation_queue", m.id);
      n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

/** Helper за SW: достъп до сурова база, ако трябва (rare). */
export async function rawDb() {
  return getOfflineDb();
}
