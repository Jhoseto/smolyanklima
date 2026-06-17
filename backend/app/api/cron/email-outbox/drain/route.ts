import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { drainEmailOutbox } from "@/lib/email/drainOutbox";
import { isAgentCronAuthorized } from "@/lib/ai/agent/agentAuth";

/**
 * Cron endpoint — drains pending email_outbox rows.
 * Auth: header `x-ai-agent-cron-secret` matching AI_AGENT_CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!isAgentCronAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.AI_AGENT_CRON_SECRET) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const supabase = await adminDb();
  const result = await drainEmailOutbox(supabase);

  if (result.error && result.processed === 0 && result.sent === 0) {
    const status = result.error.includes("not configured") ? 400 : 500;
    return NextResponse.json({ error: result.error, ...result }, { status });
  }

  await logAdminActivity({
    action: "email_outbox.drain",
    entityType: "email_outbox",
    details: {
      source: "cron",
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
