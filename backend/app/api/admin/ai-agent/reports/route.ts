import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";
import { computeNextRunAt } from "@/lib/ai/agent/agentSchedule";

const BodySchema = z.object({
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(8000),
  templateId: z.string().uuid().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  hourLocal: z.number().int().min(0).max(23).optional(),
  enabled: z.boolean().optional(),
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
    .from("admin_agent_scheduled_reports")
    .select("id,template_id,title,prompt,frequency,day_of_week,day_of_month,hour_local,enabled,last_run_at,next_run_at,last_conversation_id,last_status,last_error,created_at,updated_at")
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
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

  const frequency = parsed.data.frequency;
  if (frequency === "weekly" && parsed.data.dayOfWeek === undefined) {
    return withCors(req, NextResponse.json({ error: "dayOfWeek required for weekly" }, { status: 400 }));
  }
  if (frequency === "monthly" && parsed.data.dayOfMonth === undefined) {
    return withCors(req, NextResponse.json({ error: "dayOfMonth required for monthly" }, { status: 400 }));
  }

  const hourLocal = parsed.data.hourLocal ?? 8;
  const nextRunAt = computeNextRunAt({
    frequency,
    hourLocal,
    dayOfWeek: parsed.data.dayOfWeek ?? null,
    dayOfMonth: parsed.data.dayOfMonth ?? null,
  });

  const { data, error } = await session.db
    .from("admin_agent_scheduled_reports")
    .insert({
      admin_user_id: session.userId,
      template_id: parsed.data.templateId ?? null,
      title: parsed.data.title.trim(),
      prompt: parsed.data.prompt.trim(),
      frequency,
      day_of_week: frequency === "weekly" ? (parsed.data.dayOfWeek ?? 1) : null,
      day_of_month: frequency === "monthly" ? (parsed.data.dayOfMonth ?? 1) : null,
      hour_local: hourLocal,
      enabled: parsed.data.enabled ?? true,
      next_run_at: nextRunAt.toISOString(),
    })
    .select("id,template_id,title,prompt,frequency,day_of_week,day_of_month,hour_local,enabled,last_run_at,next_run_at,last_conversation_id,last_status,last_error,created_at,updated_at")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data }));
}
