import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const BodySchema = z.object({
  targetId: z.string().uuid(),
  sourceId: z.string().uuid(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const { targetId, sourceId } = parsed.data;
  if (targetId === sourceId) {
    return withCors(req, NextResponse.json({ error: "Избрани са еднакви контакти" }, { status: 400 }));
  }

  const supabase = await adminDb();

  const [{ data: target, error: tErr }, { data: source, error: sErr }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", targetId).maybeSingle(),
    supabase.from("contacts").select("*").eq("id", sourceId).maybeSingle(),
  ]);

  if (tErr) return withCors(req, NextResponse.json({ error: tErr.message }, { status: 500 }));
  if (sErr) return withCors(req, NextResponse.json({ error: sErr.message }, { status: 500 }));
  if (!target || !source) {
    return withCors(req, NextResponse.json({ error: "Липсва контакт за сливане" }, { status: 404 }));
  }

  const targetNotes = String((target as any).notes ?? "").trim();
  const sourceNotes = String((source as any).notes ?? "").trim();
  const mergedNotes =
    sourceNotes.length > 0
      ? [targetNotes, `[Merged от ${String((source as any).full_name ?? "контакт")}]: ${sourceNotes}`]
          .filter(Boolean)
          .join("\n\n")
      : targetNotes || null;

  const patch = {
    full_name: String((target as any).full_name ?? "").trim() || String((source as any).full_name ?? "").trim(),
    phone: String((target as any).phone ?? "").trim() || String((source as any).phone ?? "").trim(),
    email: (target as any).email || (source as any).email || null,
    address: (target as any).address || (source as any).address || null,
    notes: mergedNotes,
    customer_status: mergeCustomerStatus((target as any).customer_status, (source as any).customer_status),
    next_follow_up_at: earliestDate((target as any).next_follow_up_at, (source as any).next_follow_up_at),
    last_contacted_at: latestDate((target as any).last_contacted_at, (source as any).last_contacted_at),
  };

  let { error: uErr } = await supabase.from("contacts").update(patch).eq("id", targetId);
  if (uErr && isMissingFollowupColumns(uErr.message)) {
    const {
      customer_status: _customerStatus,
      next_follow_up_at: _nextFollowUpAt,
      last_contacted_at: _lastContactedAt,
      ...legacyPatch
    } = patch;
    const legacyRes = await supabase.from("contacts").update(legacyPatch).eq("id", targetId);
    uErr = legacyRes.error;
  }
  if (uErr) return withCors(req, NextResponse.json({ error: uErr.message }, { status: 500 }));

  const { data: linkedRows, error: lErr } = await supabase.from("work_items").select("id").eq("contact_id", sourceId);
  if (lErr) return withCors(req, NextResponse.json({ error: lErr.message }, { status: 500 }));
  const moved = (linkedRows ?? []).length;

  const { error: moveErr } = await supabase.from("work_items").update({ contact_id: targetId }).eq("contact_id", sourceId);
  if (moveErr) return withCors(req, NextResponse.json({ error: moveErr.message }, { status: 500 }));

  const { error: dErr } = await supabase.from("contacts").delete().eq("id", sourceId);
  if (dErr) return withCors(req, NextResponse.json({ error: dErr.message }, { status: 500 }));

  await logAdminActivity({
    action: "contact.merge",
    entityType: "contact",
    entityId: targetId,
    details: { targetId, sourceId, movedWorkItems: moved },
  });

  return withCors(req, NextResponse.json({ ok: true, data: { targetId, sourceId, movedWorkItems: moved } }));
}

function mergeCustomerStatus(target?: string | null, source?: string | null) {
  const rank: Record<string, number> = { lost: 0, new: 1, active: 2, vip: 3 };
  const t = target || "new";
  const s = source || "new";
  return (rank[s] ?? 1) > (rank[t] ?? 1) ? s : t;
}

function earliestDate(a?: string | null, b?: string | null) {
  if (!a) return b || null;
  if (!b) return a || null;
  return a < b ? a : b;
}

function latestDate(a?: string | null, b?: string | null) {
  if (!a) return b || null;
  if (!b) return a || null;
  return a > b ? a : b;
}

function isMissingFollowupColumns(message: string) {
  return (
    message.includes("customer_status") ||
    message.includes("next_follow_up_at") ||
    message.includes("last_contacted_at") ||
    message.includes("schema cache")
  );
}
