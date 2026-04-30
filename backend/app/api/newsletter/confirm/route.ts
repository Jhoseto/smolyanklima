import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return withCors(req, NextResponse.json({ error: "Missing token" }, { status: 400 }));
  }

  const supabase = createSupabaseServiceRoleClient();
  const tokenHash = sha256(token);

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .update({ status: "active", confirmed_at: new Date().toISOString() })
    .eq("confirm_token_hash", tokenHash)
    .select("id,email,status")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Invalid token" }, { status: 404 }));

  // Clear token hash after confirm to prevent reuse
  await supabase.from("newsletter_subscribers").update({ confirm_token_hash: null }).eq("id", data.id);

  return withCors(req, NextResponse.json({ data }));
}

