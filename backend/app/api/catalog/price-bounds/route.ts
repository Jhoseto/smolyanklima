import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServiceRoleClient();
  const [asc, desc] = await Promise.all([
    supabase.from("products").select("price").eq("is_active", true).order("price", { ascending: true }).limit(1),
    supabase.from("products").select("price").eq("is_active", true).order("price", { ascending: false }).limit(1),
  ]);
  if (asc.error) return withCors(req, NextResponse.json({ error: asc.error.message }, { status: 500 }));
  if (desc.error) return withCors(req, NextResponse.json({ error: desc.error.message }, { status: 500 }));
  const min = Number(asc.data?.[0]?.price ?? 0);
  const max = Number(desc.data?.[0]?.price ?? 0);
  return withCors(req, NextResponse.json({ min, max }));
}
