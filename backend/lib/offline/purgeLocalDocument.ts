import { idbDelete, idbGetAll, type DocKind } from "./db";
import { deleteMutation, listPendingMutations, resolveServerId } from "./queue";

/**
 * Изтрива локален протокол от IndexedDB + опашката (само на това устройство).
 * Не пипа сървъра — подходящо за заседнали offline чернови.
 */
export async function purgeLocalDocument(key: string, kind: DocKind = "acceptance"): Promise<void> {
  const serverId = await resolveServerId(key);

  const allQueue = await idbGetAll<{ id?: number; kind?: string; localId?: string; endpoint?: string }>(
    "mutation_queue",
  );
  for (const m of allQueue) {
    if (m.kind !== kind || m.id == null) continue;
    const ep = m.endpoint ?? "";
    const matches =
      m.localId === key ||
      ep.includes(key) ||
      (serverId != null && ep.includes(serverId));
    if (matches) await deleteMutation(m.id);
  }

  // Допълнително — pending/error от helper-а (ако getAll пропусне нещо).
  const pending = await listPendingMutations();
  for (const m of pending) {
    if (m.kind !== kind || m.id == null) continue;
    const ep = m.endpoint ?? "";
    if (m.localId === key || ep.includes(key) || (serverId && ep.includes(serverId))) {
      await deleteMutation(m.id);
    }
  }

  await idbDelete("id_map", key);
  await idbDelete("documents", key);
  if (serverId) await idbDelete("documents", serverId);
}
