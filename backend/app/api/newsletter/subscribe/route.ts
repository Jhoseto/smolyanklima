import crypto from "crypto";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  email: z.string().email(),
});

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

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
    html: `<p>Потвърдете абонамента си:</p><p><a href="${process.env.APP_URL ?? ""}/api/newsletter/confirm?token=${token}">Потвърди</a></p>`,
    text: `Потвърдете абонамента си: ${(process.env.APP_URL ?? "")}/api/newsletter/confirm?token=${token}`,
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}

