import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id,slug,name,color,logo_url,website,is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [] }));
}
