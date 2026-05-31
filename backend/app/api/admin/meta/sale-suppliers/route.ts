import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { groupSupplierNames } from "@/lib/admin/supplierNameNormalize";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** Групирани доставчици от история на продажбите (без дублиране ЕООД/без ЕООД). */
export async function GET(req: NextRequest) {
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("work_items")
    .select("supplier_name")
    .eq("event_code", "sale")
    .not("supplier_name", "is", null)
    .neq("supplier_name", "")
    .limit(4000);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  const names: string[] = [];
  for (const row of data ?? []) {
    const name = String((row as { supplier_name?: string | null }).supplier_name ?? "").trim();
    if (name) names.push(name);
  }

  return withCors(req, NextResponse.json({ data: groupSupplierNames(names) }));
}
