import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { FleetMiscExpenseUpdateSchema } from "@/lib/admin/fleetMiscExpenseSchemas";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = FleetMiscExpenseUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да редактирате разходи." }, { status: 403 }));
  }

  const payload: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.category !== undefined) payload.category = d.category;
  if (d.title !== undefined) payload.title = d.title.trim();
  if (d.expenseDate !== undefined) payload.expense_date = d.expenseDate;
  if (d.costEur !== undefined) payload.cost_eur = d.costEur;
  if (d.notes !== undefined) payload.notes = d.notes?.trim() || null;

  if (!Object.keys(payload).length) {
    return withCors(req, NextResponse.json({ error: "Няма промени" }, { status: 400 }));
  }

  const { data, error } = await session.db
    .from("fleet_misc_expenses")
    .update(payload)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Записът не е намерен" }, { status: 404 }));

  await logAdminActivity({
    action: "fleet_misc_expense.update",
    entityType: "fleet_misc_expense",
    entityId: id,
    details: payload,
  });

  return withCors(req, NextResponse.json({ data: { id } }));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да изтривате разходи." }, { status: 403 }));
  }

  const { data, error } = await session.db
    .from("fleet_misc_expenses")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Записът не е намерен" }, { status: 404 }));

  await logAdminActivity({
    action: "fleet_misc_expense.delete",
    entityType: "fleet_misc_expense",
    entityId: id,
    details: {},
  });

  return withCors(req, NextResponse.json({ data: { id } }));
}
