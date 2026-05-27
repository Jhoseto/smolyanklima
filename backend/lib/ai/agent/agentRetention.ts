import type { SupabaseClient } from "@supabase/supabase-js";

export async function purgeOldAgentConversations(
  db: SupabaseClient,
  retentionDays = 90,
): Promise<{ deletedConversations: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffIso = cutoff.toISOString();

  const { data: softDeleted } = await db
    .from("admin_agent_conversations")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoffIso)
    .limit(500);

  const ids = (softDeleted ?? []).map((r) => r.id);
  if (ids.length === 0) return { deletedConversations: 0 };

  await db.from("admin_agent_messages").delete().in("conversation_id", ids);
  await db.from("admin_agent_conversations").delete().in("id", ids);
  return { deletedConversations: ids.length };
}
