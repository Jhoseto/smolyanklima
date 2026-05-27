import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";
import { computeNextRunAt } from "@/lib/ai/agent/agentSchedule";
import { runScheduledReport, type ScheduledReportRow } from "@/lib/ai/agent/agentScheduledReports";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  prompt: z.string().min(1).max(8000).optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
  hourLocal: z.number().int().min(0).max(23).optional(),
  enabled: z.boolean().optional(),
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

  const { data: existing, error: loadErr } = await session.db
    .from("admin_agent_scheduled_reports")
    .select("*")
    .eq("id", id)
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadErr) return withCors(req, NextResponse.json({ error: loadErr.message }, { status: 500 }));
  if (!existing) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const row = existing as ScheduledReportRow;
  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim();
  if (parsed.data.prompt !== undefined) patch.prompt = parsed.data.prompt.trim();
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
  if (parsed.data.frequency !== undefined) patch.frequency = parsed.data.frequency;
  if (parsed.data.dayOfWeek !== undefined) patch.day_of_week = parsed.data.dayOfWeek;
  if (parsed.data.dayOfMonth !== undefined) patch.day_of_month = parsed.data.dayOfMonth;
  if (parsed.data.hourLocal !== undefined) patch.hour_local = parsed.data.hourLocal;

  const scheduleChanged =
    parsed.data.frequency !== undefined ||
    parsed.data.dayOfWeek !== undefined ||
    parsed.data.dayOfMonth !== undefined ||
    parsed.data.hourLocal !== undefined;

  if (scheduleChanged) {
    const frequency = (parsed.data.frequency ?? row.frequency) as "daily" | "weekly" | "monthly";
    const hourLocal = parsed.data.hourLocal ?? row.hour_local;
    const dayOfWeek = parsed.data.dayOfWeek !== undefined ? parsed.data.dayOfWeek : row.day_of_week;
    const dayOfMonth = parsed.data.dayOfMonth !== undefined ? parsed.data.dayOfMonth : row.day_of_month;
    patch.next_run_at = computeNextRunAt({ frequency, hourLocal, dayOfWeek, dayOfMonth }).toISOString();
  }

  const { data, error } = await session.db
    .from("admin_agent_scheduled_reports")
    .update(patch)
    .eq("id", id)
    .select("id,template_id,title,prompt,frequency,day_of_week,day_of_month,hour_local,enabled,last_run_at,next_run_at,last_conversation_id,last_status,last_error,created_at,updated_at")
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
  const { error } = await session.db
    .from("admin_agent_scheduled_reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ ok: true }));
}

export async function POST(req: NextRequest, ctx: Params) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const { data: existing, error: loadErr } = await session.db
    .from("admin_agent_scheduled_reports")
    .select("*")
    .eq("id", id)
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (loadErr) return withCors(req, NextResponse.json({ error: loadErr.message }, { status: 500 }));
  if (!existing) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const outcome = await runScheduledReport(session, existing as ScheduledReportRow);
  return withCors(req, NextResponse.json(outcome));
}
