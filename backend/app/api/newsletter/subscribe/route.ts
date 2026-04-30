import crypto from "crypto";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";
import { allowPublicPost, getClientIdFromRequest } from "@/lib/rate-limit";

const BodySchema = z
  .object({
    email: z.string().email(),
    website: z.string().optional(),
  })
  .refine((d) => !d.website?.trim(), { message: "INVALID_REQUEST", path: ["website"] });

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!allowPublicPost(`newsletter:${clientId}`, 15, 3_600_000)) {
    return withCors(req, NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid body" }, { status: 400 }));
  }

  const supabase = createSupabaseServiceRoleClient();
  let appUrl = "";
  try {
    appUrl = getEnv().APP_URL ?? "";
  } catch {
    appUrl = process.env.APP_URL ?? "";
  }
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      {
        email: parsed.data.email,
        source: "blog_newsletter",
        status: "pending",
        confirm_token_hash: tokenHash,
        confirm_sent_at: new Date().toISOString(),
        subscribed_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("id,email,status")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  // Queue confirmation email (worker will send later).
  await supabase.from("email_outbox").insert({
    kind: "newsletter_confirm",
    to_email: parsed.data.email,
    subject: "Потвърди абонамента си — SmolyanKlima",
    html: `<p>Потвърдете абонамента си:</p><p><a href="${appUrl}/api/newsletter/confirm?token=${token}">Потвърди</a></p>`,
    text: `Потвърдете абонамента си: ${appUrl}/api/newsletter/confirm?token=${token}`,
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}

