import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import {
  cancelProductReservation,
  findActiveProductReservation,
  recordProductReservation,
} from "@/lib/admin/recordProductReservation";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const CreateSchema = z.object({
  productId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  customerName: z.string().min(2).max(160),
  customerPhone: z.string().min(6).max(80),
  customerAddress: z.string().max(500).optional().nullable(),
  notes: z.string().max(8000).optional().nullable(),
  agreedPrice: z.number().nonnegative().optional().nullable(),
  reservationDate: z.string().optional().nullable(),
});

const CancelSchema = z.object({
  productId: z.string().uuid().optional(),
  workItemId: z.string().uuid().optional(),
});

/**
 * GET /api/admin/product-reservations?productId=
 * Активна резервация за продукт (ако има).
 */
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff", "service_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const productId = req.nextUrl.searchParams.get("productId")?.trim();
  if (!productId) {
    return withCors(req, NextResponse.json({ error: "Липсва productId" }, { status: 400 }));
  }

  try {
    const active = await findActiveProductReservation(session.db, productId);
    if (!active) return withCors(req, NextResponse.json({ data: null }));
    const { data, error } = await session.db
      .from("work_items")
      .select(
        "id,title,status,due_date,customer_name,customer_phone,customer_address,unit_price,notes,contact_id,product_id,created_at",
      )
      .eq("id", active.id)
      .maybeSingle();
    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
    return withCors(req, NextResponse.json({ data }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 400 }));
  }
}

/**
 * POST /api/admin/product-reservations
 */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Само офис и администратор могат да резервират продукти." }, { status: 403 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  try {
    const result = await recordProductReservation(session.db, {
      ...parsed.data,
      createdBy: session.userId,
    });

    const { data: createdRow } = await session.db
      .from("work_items")
      .select("*")
      .eq("id", result.reservationId)
      .single();

    await logAdminActivity({
      action: "reservation.create",
      entityType: "work_item",
      entityId: result.reservationId,
      details: {
        productId: parsed.data.productId,
        customer_name: parsed.data.customerName.trim(),
        customer_phone: parsed.data.customerPhone.trim(),
      },
    });

    return withCors(req, NextResponse.json({ data: createdRow }, { status: 201 }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 400 }));
  }
}

/**
 * DELETE /api/admin/product-reservations
 * Отменя активна резервация и връща продукта в наличност.
 */
export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Само офис и администратор могат да отменят резервации." }, { status: 403 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = CancelSchema.safeParse(json);
  if (!parsed.success || (!parsed.data.productId && !parsed.data.workItemId)) {
    return withCors(req, NextResponse.json({ error: "Посочете productId или workItemId" }, { status: 400 }));
  }

  try {
    const result = await cancelProductReservation(session.db, parsed.data);

    await logAdminActivity({
      action: "reservation.cancel",
      entityType: "work_item",
      entityId: result.reservationId,
      details: {
        product_id: result.productId,
        restored: result.restored,
      },
    });

    return withCors(req, NextResponse.json({ data: result }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 400 }));
  }
}
