import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { findSerialConflicts } from "@/lib/admin/productDeliveryValidation";

/**
 * Проверка за дубликат на сериен номер на вътрешно/външно тяло.
 * GET /api/admin/products/check-serial?serial=...&excludeId=...
 *
 * Връща списък на продукти (макс. 5), които имат същия сериен номер като
 * indoor_unit_serial или outdoor_unit_serial. Сравнението е без регистър и
 * без водещи/крайни интервали.
 */

const QuerySchema = z.object({
  serial: z.string().min(1).max(200),
  excludeId: z.string().uuid().optional(),
});

type Match = {
  id: string;
  name: string;
  slug: string | null;
  field: "indoor" | "outdoor" | "both";
};

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }
  const serial = parsed.data.serial.trim();
  if (!serial) {
    return withCors(req, NextResponse.json({ data: [] satisfies Match[] }));
  }
  const excludeId = parsed.data.excludeId;

  const supabase = await adminDb();
  try {
    const matches = await findSerialConflicts(supabase, {
      indoor: serial,
      outdoor: serial,
      excludeId,
    });
    return withCors(req, NextResponse.json({ data: matches satisfies Match[] }));
  } catch (e) {
    return withCors(req, NextResponse.json({ error: String((e as Error).message) }, { status: 500 }));
  }
}
