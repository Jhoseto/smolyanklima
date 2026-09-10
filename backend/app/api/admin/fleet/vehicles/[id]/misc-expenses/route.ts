import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { requireFleetAccess } from "@/lib/admin/fleetAuth";
import { logAdminActivity } from "@/lib/admin/audit";
import { fetchFleetMiscExpenses } from "@/lib/admin/fleetQueries";
import { FleetMiscExpenseCreateSchema } from "@/lib/admin/fleetMiscExpenseSchemas";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session;
  try {
    session = await adminSession();
    requireFleetAccess(session);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORBIDDEN") {
      return withCors(req, NextResponse.json({ error: "Нямате достъп до автопарка." }, { status: 403 }));
    }
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  try {
    const data = await fetchFleetMiscExpenses(session.db, id, Number.isFinite(year) ? year : undefined);
    return withCors(req, NextResponse.json({ data }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Грешка при зареждане";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: vehicleId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = FleetMiscExpenseCreateSchema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message ?? "Невалидни данни";
    return withCors(req, NextResponse.json({ error: detail }, { status: 400 }));
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
    return withCors(req, NextResponse.json({ error: "Нямате право да добавяте разходи." }, { status: 403 }));
  }

  const { data: vehicle } = await session.db.from("fleet_vehicles").select("id").eq("id", vehicleId).maybeSingle();
  if (!vehicle) {
    return withCors(req, NextResponse.json({ error: "МПС не е намерено" }, { status: 404 }));
  }

  const d = parsed.data;
  const payload = {
    vehicle_id: vehicleId,
    category: d.category ?? "other",
    title: d.title.trim(),
    expense_date: d.expenseDate,
    cost_eur: d.costEur,
    notes: d.notes?.trim() || null,
  };

  const { data, error } = await session.db.from("fleet_misc_expenses").insert(payload).select("id").single();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({
    action: "fleet_misc_expense.create",
    entityType: "fleet_misc_expense",
    entityId: data.id,
    details: { vehicle_id: vehicleId, category: payload.category, title: payload.title, cost_eur: payload.cost_eur },
  });

  return withCors(req, NextResponse.json({ data: { id: data.id } }, { status: 201 }));
}
