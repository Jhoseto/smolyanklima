import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = await adminDb();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) return withCors(req, NextResponse.json({ error: userErr.message }, { status: 500 }));
  if (!user) return withCors(req, NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 }));

  const { data: adminRow, error: adminErr } = await supabase
    .from("admin_users")
    .select("id,is_active,role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminErr) return withCors(req, NextResponse.json({ error: adminErr.message }, { status: 500 }));

  return withCors(
    req,
    NextResponse.json({
      data: {
        user: { id: user.id, email: user.email },
        admin: adminRow ?? null,
        isActiveAdmin: Boolean(adminRow?.is_active),
      },
    }),
  );
}

