import type { SupabaseClient } from "@supabase/supabase-js";

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

/** Синхронизира CRM контакт при задача/консултация, свързана с обаждане. */
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
  if (!contactId) return;

  const dueKey = dateKey(dueDate);

  if (status === "done") {
    const { data: contact } = await db
      .from("contacts")
      .select("next_follow_up_at")
      .eq("id", contactId)
      .maybeSingle();
    const followUpKey = dateKey((contact as { next_follow_up_at?: string | null } | null)?.next_follow_up_at);

    const shouldClear =
      eventCode === "consultation" || Boolean(followUpKey && dueKey && followUpKey <= dueKey);

    if (!shouldClear) return;

    await db
      .from("contacts")
      .update({
        last_contacted_at: new Date().toISOString(),
        next_follow_up_at: null,
      })
      .eq("id", contactId);
    return;
  }

  if (eventCode !== "consultation") return;

  if (status === "planned" || status === "in_progress") {
    if (!dueKey) return;
    await db.from("contacts").update({ next_follow_up_at: dueKey }).eq("id", contactId);
  }
}

/** CRM обаждане без задача — нулира follow-up от панела „Контакти за обаждане“. */
export async function completeContactFollowUpCall(
  db: SupabaseClient,
  contactId: string,
): Promise<void> {
  await db
    .from("contacts")
    .update({
      last_contacted_at: new Date().toISOString(),
      next_follow_up_at: null,
    })
    .eq("id", contactId);
}
