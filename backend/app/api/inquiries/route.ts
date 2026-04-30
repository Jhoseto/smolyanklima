import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  source: z.enum(["contact", "product", "wizard", "quick_view", "ai"]),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().min(6).max(40),
  customerEmail: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  message: z.string().max(2000).optional(),
  productSlug: z.string().min(1).optional(),
  serviceType: z.enum(["sale", "installation", "maintenance", "repair"]).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid body" }, { status: 400 }));
  }

  const supabase = createSupabaseServiceRoleClient();

  let productId: string | null = null;
  if (parsed.data.productSlug) {
    const { data: p } = await supabase.from("products").select("id").eq("slug", parsed.data.productSlug).maybeSingle();
    productId = p?.id ?? null;
  }

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      source: parsed.data.source,
      customer_name: parsed.data.customerName,
      customer_phone: parsed.data.customerPhone,
      customer_email: parsed.data.customerEmail,
      message: parsed.data.message,
      product_id: productId,
      service_type: parsed.data.serviceType,
    })
    .select("id,created_at,status")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}

