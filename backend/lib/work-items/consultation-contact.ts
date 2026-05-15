import type { SupabaseClient } from "@supabase/supabase-js";

/** Синхронизира CRM контакт при събитие „консултация“. */
export async function syncConsultationContactFollowUp(
  db: SupabaseClient,
  params: {
    contactId: string | null | undefined;
    dueDate: string | null | undefined;
    status: string;
    eventCode: string | null | undefined;
  },
): Promise<void> {
  const { contactId, dueDate, status, eventCode } = params;
  if (eventCode !== "consultation" || !contactId) return;

  const patch: Record<string, unknown> = {};
  if (status === "done") {
    patch.last_contacted_at = new Date().toISOString();
    patch.next_follow_up_at = null;
  } else if (status === "planned" || status === "in_progress") {
    if (dueDate) patch.next_follow_up_at = dueDate;
  }

  if (Object.keys(patch).length === 0) return;
  await db.from("contacts").update(patch).eq("id", contactId);
}
