import { NextRequest, NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";
import { logAdminActivity } from "@/lib/admin/audit";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const now = new Date().toISOString();
  const { data, error } = await session.db
    .from("admin_agent_conversations")
    .update({ deleted_at: now })
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
    .select("id");

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  const count = data?.length ?? 0;
  await logAdminActivity({
    action: "agent_bulk_delete",
    entityType: "ai_agent",
    details: { count },
  });

  return withCors(req, NextResponse.json({ ok: true, count }));
}
