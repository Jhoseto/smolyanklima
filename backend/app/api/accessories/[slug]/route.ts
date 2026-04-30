import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("accessories")
    .select("id,slug,name,description,price,old_price,kind,is_active,brands:brand_id(id,slug,name),accessory_images(url,sort_order,is_main)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  return withCors(req, NextResponse.json({ data }));
}

