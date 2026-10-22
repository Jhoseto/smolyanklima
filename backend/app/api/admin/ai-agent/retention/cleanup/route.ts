import { NextRequest, NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminOrCron } from "@/lib/ai/agent/agentAuth";
import { purgeOldAgentConversations } from "@/lib/ai/agent/agentRetention";
import { logAdminActivity } from "@/lib/admin/audit";
import { getEnv } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireMasterAdminOrCron(req);
    if (auth === "cron" && !process.env.AI_AGENT_CRON_SECRET) {
      return withCors(req, NextResponse.json({ error: "Cron not configured" }, { status: 503 }));
    }
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const env = getEnv();
  const retentionDays = env.AI_AGENT_RETENTION_DAYS ?? 90;
  const db = auth === "cron" ? createSupabaseServiceRoleClient() : auth.db;
  const result = await purgeOldAgentConversations(db, retentionDays);

  await logAdminActivity({
    action: "agent_retention_cleanup",
    entityType: "ai_agent",
    details: { retentionDays, ...result },
  });

  return withCors(req, NextResponse.json({ ok: true, retentionDays, ...result }));
}
