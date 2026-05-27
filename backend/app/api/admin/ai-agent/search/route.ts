import { NextRequest, NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";
import { searchAgentConversations } from "@/lib/ai/agent/agentSearch";

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

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return withCors(req, NextResponse.json({ data: [], query: q }));
  }

  try {
    const data = await searchAgentConversations(session.db, session.userId, q);
    return withCors(req, NextResponse.json({ data, query: q }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}
