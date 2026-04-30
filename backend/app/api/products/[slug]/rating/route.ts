import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { allowPublicPost, getClientIdFromRequest } from "@/lib/rate-limit";

const BodySchema = z
  .object({
    stars: z.number().int().min(1).max(5),
    /** Honeypot — must stay empty */
    website: z.string().optional(),
  })
  .refine((d) => !d.website?.trim(), { message: "INVALID_REQUEST", path: ["website"] });

const RATER_COOKIE = "sk_rate_id";
const RATER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const clientId = getClientIdFromRequest(req);
  if (!allowPublicPost(`rating:${clientId}`, 20, 3_600_000)) {
    return withCors(req, NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 }));
  }

  const { slug } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid body" }, { status: 400 }));
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: p, error: pErr } = await supabase
    .from("products")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (pErr) return withCors(req, NextResponse.json({ error: pErr.message }, { status: 500 }));
  if (!p) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const existingCookie = req.cookies.get(RATER_COOKIE)?.value?.trim();
  const raterKey = existingCookie && existingCookie.length >= 16 ? existingCookie : randomUUID();
  const ipHash = createHash("sha256").update(clientId).digest("hex");
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 500) || null;

  const { error } = await supabase.from("product_ratings").insert({
    product_id: p.id,
    stars: parsed.data.stars,
    rater_key: raterKey,
    ip_hash: ipHash,
    user_agent: ua,
  });

  if (error) {
    const isMissingTable =
      String((error as any).code ?? "") === "42P01" || String(error.message ?? "").includes("product_ratings");
    if (isMissingTable) {
      return withCors(req, NextResponse.json({ error: "RATINGS_NOT_READY" }, { status: 503 }));
    }
    const duplicate =
      String((error as any).code ?? "") === "23505" ||
      String(error.message ?? "").includes("product_ratings_product_id_rater_key_key");
    if (duplicate) {
      return withCors(req, NextResponse.json({ error: "ALREADY_RATED" }, { status: 409 }));
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const { data: updated } = await supabase
    .from("products")
    .select("rating,reviews_count")
    .eq("id", p.id)
    .maybeSingle();

  const res = withCors(
    req,
    NextResponse.json(
      {
        data: {
          rating: Number((updated as any)?.rating ?? 0),
          reviewsCount: Number((updated as any)?.reviews_count ?? 0),
        },
      },
      { status: 201 },
    ),
  );
  if (!existingCookie) {
    res.cookies.set(RATER_COOKIE, raterKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: RATER_COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return res;
}
