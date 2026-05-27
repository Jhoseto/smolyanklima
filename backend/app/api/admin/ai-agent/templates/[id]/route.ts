import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  prompt: z.string().min(1).max(8000).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function PATCH(req: NextRequest, ctx: Params) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid body" }, { status: 400 }));
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim();
  if (parsed.data.prompt !== undefined) patch.prompt = parsed.data.prompt.trim();
  if (parsed.data.description !== undefined) patch.description = parsed.data.description?.trim() || null;
  if (parsed.data.sortOrder !== undefined) patch.sort_order = parsed.data.sortOrder;

  const { data, error } = await session.db
    .from("admin_agent_query_templates")
    .update(patch)
    .eq("id", id)
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
    .select("id,title,prompt,description,sort_order,created_at,updated_at")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
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
  const { error } = await session.db
    .from("admin_agent_query_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ ok: true }));
}
