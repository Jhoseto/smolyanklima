import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";
import { allowPublicPost, getClientIdFromRequest } from "@/lib/rate-limit";
import { sendResendEmail } from "@/lib/email/resend";

const BodySchema = z
  .object({
    source: z.enum(["contact", "product", "wizard", "quick_view", "ai"]),
    customerName: z.string().min(2).max(120),
    customerPhone: z.string().min(6).max(40),
    customerEmail: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
    message: z.string().max(2000).optional(),
    productSlug: z.string().min(1).optional(),
    serviceType: z.enum(["sale", "installation", "maintenance", "repair"]).optional(),
    /** Honeypot — must be empty (bots often fill hidden fields). */
    website: z.string().optional(),
  })
  .refine((d) => !d.website?.trim(), { message: "INVALID_REQUEST", path: ["website"] });

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!allowPublicPost(`inquiry:${clientId}`, 30, 3_600_000)) {
    return withCors(req, NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid body" }, { status: 400 }));
  }

  const supabase = createSupabaseServiceRoleClient();

  let productId: string | null = null;
  let productName: string | null = null;
  if (parsed.data.productSlug) {
    const { data: p } = await supabase
      .from("products")
      .select("id,name")
      .eq("slug", parsed.data.productSlug)
      .maybeSingle();
    productId = p?.id ?? null;
    productName = (p as { name?: string } | null)?.name ?? null;
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

  try {
    const env = getEnv();
    if (env.NOTIFY_EMAIL_TO && env.NOTIFY_EMAIL_FROM) {
      const lines = [
        `<p><strong>Ново запитване</strong> (${parsed.data.source})</p>`,
        `<p>Име: ${escapeHtml(parsed.data.customerName)}<br/>Телефон: ${escapeHtml(parsed.data.customerPhone)}</p>`,
      ];
      if (parsed.data.customerEmail) lines.push(`<p>Имейл: ${escapeHtml(parsed.data.customerEmail)}</p>`);
      if (parsed.data.message) lines.push(`<p>Съобщение:<br/>${escapeHtml(parsed.data.message)}</p>`);
      if (productName) lines.push(`<p>Продукт: ${escapeHtml(productName)}</p>`);
      const html = lines.join("");
      await sendResendEmail({
        to: env.NOTIFY_EMAIL_TO,
        from: env.NOTIFY_EMAIL_FROM,
        subject: `[SmolyanKlima] Запитване от ${parsed.data.customerName}`,
        html,
        text: stripTags(html),
      });
    }
  } catch {
    // non-blocking
  }

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
