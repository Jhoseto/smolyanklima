import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: cats, error: cErr } = await supabase
    .from("categories")
    .select("id,slug,name,description,icon,accent_color,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (cErr) return withCors(req, NextResponse.json({ error: cErr.message }, { status: 500 }));

  const { data: links, error: lErr } = await supabase.from("category_types").select("category_id,product_type");
  if (lErr) return withCors(req, NextResponse.json({ error: lErr.message }, { status: 500 }));

  const typesByCategory = new Map<string, string[]>();
  for (const row of links ?? []) {
    const cid = (row as { category_id: string }).category_id;
    const pt = (row as { product_type: string }).product_type;
    const arr = typesByCategory.get(cid) ?? [];
    arr.push(pt);
    typesByCategory.set(cid, arr);
  }

  const data = (cats ?? []).map((c: any) => ({
    ...c,
    product_types: typesByCategory.get(c.id) ?? [],
  }));

  return withCors(req, NextResponse.json({ data }));
}
