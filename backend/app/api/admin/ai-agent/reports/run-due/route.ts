import { NextRequest, NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminOrCron } from "@/lib/ai/agent/agentAuth";
import { runDueScheduledReports } from "@/lib/ai/agent/agentScheduledReports";
import { logAdminActivity } from "@/lib/admin/audit";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMasterAdminOrCron(req);
    if (auth === "cron" && !process.env.AI_AGENT_CRON_SECRET) {
      return withCors(req, NextResponse.json({ error: "Cron not configured" }, { status: 503 }));
    }
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  try {
    const result = await runDueScheduledReports();
    await logAdminActivity({
      action: "agent_scheduled_reports_run",
      entityType: "ai_agent",
      details: result,
    });
    return withCors(req, NextResponse.json({ ok: true, ...result }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Run failed";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}
