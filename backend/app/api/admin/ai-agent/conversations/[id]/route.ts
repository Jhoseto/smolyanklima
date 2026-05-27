import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";

type Params = { params: Promise<{ id: string }> };

async function getOwnedConversation(session: Awaited<ReturnType<typeof requireMasterAdminAgentSession>>, id: string) {
  const { data, error } = await session.db
    .from("admin_agent_conversations")
    .select("id,title,created_at,updated_at")
    .eq("id", id)
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: Params) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { id } = await ctx.params;
  try {
    const conv = await getOwnedConversation(session, id);
    if (!conv) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

    const { data: messages, error } = await session.db
      .from("admin_agent_messages")
      .select("id,role,content,token_usage,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return withCors(req, NextResponse.json({ conversation: conv, messages: messages ?? [] }));
  } catch (e) {
    return withCors(req, NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 }));
  }
}

const PatchSchema = z.object({ title: z.string().min(1).max(200) });

export async function PATCH(req: NextRequest, ctx: Params) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Invalid" }, { status: 400 }));

  const conv = await getOwnedConversation(session, id);
  if (!conv) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const { data, error } = await session.db
    .from("admin_agent_conversations")
    .update({ title: parsed.data.title })
    .eq("id", id)
    .select("id,title,updated_at")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data }));
}

export async function DELETE(req: NextRequest, ctx: Params) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const conv = await getOwnedConversation(session, id);
  if (!conv) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const { error } = await session.db
    .from("admin_agent_conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ ok: true }));
}
