import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";

const BodySchema = z.object({
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(8000),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

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
    .from("admin_agent_query_templates")
    .select("id,title,prompt,description,sort_order,created_at,updated_at")
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

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

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid body" }, { status: 400 }));
  }

  const { data, error } = await session.db
    .from("admin_agent_query_templates")
    .insert({
      admin_user_id: session.userId,
      title: parsed.data.title.trim(),
      prompt: parsed.data.prompt.trim(),
      description: parsed.data.description?.trim() || null,
      sort_order: parsed.data.sortOrder ?? 0,
    })
    .select("id,title,prompt,description,sort_order,created_at,updated_at")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data }));
}
