import { adminDb, type AdminSession } from "@/lib/admin/db";
import { agentSessionForUserId } from "@/lib/ai/agent/agentAuth";
import { handleAgentChat } from "@/lib/ai/agent/chatHandler";
import { computeNextRunAt, type ReportFrequency } from "@/lib/ai/agent/agentSchedule";

export type ScheduledReportRow = {
  id: string;
  admin_user_id: string;
  template_id: string | null;
  title: string;
  prompt: string;
  frequency: ReportFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  hour_local: number;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
  last_conversation_id: string | null;
  last_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function runScheduledReport(
  session: AdminSession,
  report: ScheduledReportRow,
): Promise<{ conversationId: string; status: "success" | "failed"; error?: string }> {
  const now = new Date();
  const reportTitle = `[Отчет] ${report.title} — ${now.toLocaleDateString("bg-BG")}`;

  try {
    const result = await handleAgentChat(session, {
      message: report.prompt,
    });

    await session.db
      .from("admin_agent_conversations")
      .update({ title: reportTitle })
      .eq("id", result.conversationId);

    const nextRun = computeNextRunAt(
      {
        frequency: report.frequency,
        hourLocal: report.hour_local,
        dayOfWeek: report.day_of_week,
        dayOfMonth: report.day_of_month,
      },
      now,
    );

    await session.db
      .from("admin_agent_scheduled_reports")
      .update({
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
        last_conversation_id: result.conversationId,
        last_status: "success",
        last_error: null,
      })
      .eq("id", report.id);

    return { conversationId: result.conversationId, status: "success" };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    const nextRun = computeNextRunAt(
      {
        frequency: report.frequency,
        hourLocal: report.hour_local,
        dayOfWeek: report.day_of_week,
        dayOfMonth: report.day_of_month,
      },
      now,
    );

    await session.db
      .from("admin_agent_scheduled_reports")
      .update({
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
        last_status: "failed",
        last_error: errMsg.slice(0, 500),
      })
      .eq("id", report.id);

    return { conversationId: "", status: "failed", error: errMsg };
  }
}

export async function runDueScheduledReports(): Promise<{
  processed: number;
  success: number;
  failed: number;
  results: Array<{ reportId: string; status: string }>;
}> {
  const db = await adminDb();
  const now = new Date().toISOString();

  const { data: due, error } = await db
    .from("admin_agent_scheduled_reports")
    .select("*")
    .eq("enabled", true)
    .is("deleted_at", null)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(10);

  if (error) throw new Error(error.message);

  let success = 0;
  let failed = 0;
  const results: Array<{ reportId: string; status: string }> = [];

  for (const row of due ?? []) {
    const report = row as ScheduledReportRow;
    try {
      const session = await agentSessionForUserId(report.admin_user_id);
      const outcome = await runScheduledReport(session, report);
      results.push({ reportId: report.id, status: outcome.status });
      if (outcome.status === "success") success += 1;
      else failed += 1;
    } catch (e) {
      failed += 1;
      results.push({ reportId: report.id, status: "failed" });
    }
  }

  return { processed: (due ?? []).length, success, failed, results };
}
