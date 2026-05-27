import { NextRequest, NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { data, error } = await session.db
    .from("admin_agent_conversations")
    .select("id,title,created_at,updated_at")
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [] }));
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { data, error } = await session.db
    .from("admin_agent_conversations")
    .insert({ admin_user_id: session.userId, title: "Нов разговор" })
    .select("id,title,created_at,updated_at")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data }));
}
