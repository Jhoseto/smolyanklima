import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

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
  const escaped = serial.replace(/[%,]/g, " ").trim();
  let query = supabase
    .from("products")
    .select("id,name,slug,indoor_unit_serial,outdoor_unit_serial")
    .or(`indoor_unit_serial.ilike.${escaped},outdoor_unit_serial.ilike.${escaped}`)
    .limit(10);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const needle = serial.toLowerCase();
  const matches: Match[] = (data ?? [])
    .map((row) => {
      const indoor = String(row.indoor_unit_serial ?? "").trim().toLowerCase();
      const outdoor = String(row.outdoor_unit_serial ?? "").trim().toLowerCase();
      const hitIndoor = indoor === needle;
      const hitOutdoor = outdoor === needle;
      if (!hitIndoor && !hitOutdoor) return null;
      return {
        id: row.id as string,
        name: row.name as string,
        slug: (row.slug as string | null) ?? null,
        field: hitIndoor && hitOutdoor ? "both" : hitIndoor ? "indoor" : "outdoor",
      } satisfies Match;
    })
    .filter((m): m is Match => Boolean(m))
    .slice(0, 5);

  return withCors(req, NextResponse.json({ data: matches }));
}
