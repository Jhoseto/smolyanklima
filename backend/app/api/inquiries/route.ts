import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";
import { allowPublicPost, getClientIdFromRequest } from "@/lib/rate-limit";
import { sendResendEmail } from "@/lib/email/resend";
import { buildProductInquiryMessage } from "@/lib/inquiry/inquiryMessage";
import { attachProductsToInquiries } from "@/lib/inquiry/inquiryProducts";
import { submitPublicInquiry } from "@/lib/inquiry/submitPublicInquiry";

const BodySchema = z
  .object({
    source: z.enum(["contact", "product", "wizard", "quick_view", "ai"]),
    customerName: z.string().min(2).max(120),
    customerPhone: z.string().min(6).max(40),
    customerEmail: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
    message: z.string().max(2000).optional(),
    productSlug: z.string().min(1).optional(),
    productName: z.string().min(1).max(200).optional(),
    serviceType: z.enum(["consultation", "sale", "installation", "maintenance", "repair"]).optional(),
    includeInstallation: z.boolean().optional(),
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

  let result: { id: string; created_at: string; status: string; merged: boolean };
  try {
    result = await submitPublicInquiry(supabase, {
      source: parsed.data.source,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerEmail: parsed.data.customerEmail,
      message: parsed.data.message,
      productSlug: parsed.data.productSlug,
      productName: parsed.data.productName,
      serviceType: parsed.data.serviceType,
      includeInstallation: parsed.data.includeInstallation,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Грешка";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }

  let enriched: Awaited<ReturnType<typeof attachProductsToInquiries>>[number] | undefined;
  try {
    const productMessage = buildProductInquiryMessage({
      productName: parsed.data.productName,
      includeInstallation: parsed.data.includeInstallation,
      extraMessage: parsed.data.message,
    });
    [enriched] = await attachProductsToInquiries(supabase, [
      {
        id: result.id,
        message: productMessage,
        product_id: null,
      },
    ]);
  } catch {
    /* не блокираме успешното запитване */
  }

  try {
    const env = getEnv();
    if (env.NOTIFY_EMAIL_TO && env.NOTIFY_EMAIL_FROM) {
      const productNames =
        enriched?.products?.map((p) => p.product_name) ??
        (parsed.data.productName ? [parsed.data.productName] : []);
      const lines = [
        `<p><strong>Ново запитване</strong> (${parsed.data.source})${result.merged ? " — добавен модел към съществуващ клиент" : ""}</p>`,
        `<p>Име: ${escapeHtml(parsed.data.customerName)}<br/>Телефон: ${escapeHtml(parsed.data.customerPhone)}</p>`,
      ];
      if (parsed.data.customerEmail) lines.push(`<p>Имейл: ${escapeHtml(parsed.data.customerEmail)}</p>`);
      if (parsed.data.includeInstallation === true) {
        lines.push("<p>Монтаж: <strong>с монтаж</strong></p>");
      } else if (parsed.data.includeInstallation === false) {
        lines.push("<p>Монтаж: <strong>само уред</strong></p>");
      }
      if (parsed.data.message) lines.push(`<p>Съобщение:<br/>${escapeHtml(parsed.data.message)}</p>`);
      if (productNames.length) {
        lines.push(`<p>Климатици: ${escapeHtml(productNames.join("; "))}</p>`);
      }
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

  return withCors(
    req,
    NextResponse.json(
      {
        data: { id: result.id, created_at: result.created_at, status: result.status, merged: result.merged },
      },
      { status: result.merged ? 200 : 201 },
    ),
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
