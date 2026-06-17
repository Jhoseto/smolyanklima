import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { sendResendEmail } from "@/lib/email/resend";

export type DrainOutboxResult = {
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  error?: string;
};

/** Processes a batch of pending `email_outbox` rows. */
export async function drainEmailOutbox(supabase: SupabaseClient): Promise<DrainOutboxResult> {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch {
    return { sent: 0, failed: 0, skipped: 0, processed: 0, error: "Invalid server env" };
  }

  if (!process.env.RESEND_API_KEY) {
    return { sent: 0, failed: 0, skipped: 0, processed: 0, error: "RESEND_API_KEY not configured" };
  }

  const from = env.NOTIFY_EMAIL_FROM;
  if (!from) {
    return { sent: 0, failed: 0, skipped: 0, processed: 0, error: "NOTIFY_EMAIL_FROM required for sending" };
  }

  const { data: rows, error } = await supabase
    .from("email_outbox")
    .select("id,to_email,subject,html,text")
    .eq("status", "pending")
    .lte("send_after", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) {
    return { sent: 0, failed: 0, skipped: 0, processed: 0, error: error.message };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const r = row as { id: string; to_email: string; subject: string; html: string; text: string | null };
    const result = await sendResendEmail({
      to: r.to_email,
      from,
      subject: r.subject,
      html: r.html,
      text: r.text ?? undefined,
    });

    if (result.ok) {
      await supabase
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", r.id);
      sent += 1;
    } else if (result.skipped) {
      skipped += 1;
    } else {
      failed += 1;
      await supabase
        .from("email_outbox")
        .update({ status: "failed", last_error: result.error ?? "send failed" })
        .eq("id", r.id);
    }
  }

  return { sent, failed, skipped, processed: (rows ?? []).length };
}
