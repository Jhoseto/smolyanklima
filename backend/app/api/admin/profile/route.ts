import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminSession } from "@/lib/admin/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PutSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.union([z.string().max(40), z.literal(""), z.null()]).optional(),
  password: z.string().min(4).max(128).optional(),
  avatar_url: z.union([z.string().url("Невалиден URL").max(2048), z.null()]).optional(),
});

/** GET /api/admin/profile — текущият служител (само за себе си). */
export async function GET() {
  try {
    const session = await adminSession();
    const { data, error } = await session.db
      .from("admin_users")
      .select("id,name,email,phone,avatar_url,role,is_active,created_at,last_login_at")
      .eq("id", session.userId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({
      data: {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone ?? "",
        avatar_url: data.avatar_url ?? null,
        role: data.role,
        is_active: data.is_active,
        created_at: data.created_at,
        last_login_at: data.last_login_at ?? null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_AUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "NOT_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PUT /api/admin/profile — редакция само на собствения профил (без роля / активност). */
export async function PUT(req: NextRequest) {
  try {
    const session = await adminSession();
    const body = await req.json().catch(() => null);
    const parsed = PutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "INVALID_REQUEST" }, { status: 400 });
    }

    const { name, phone, password, avatar_url } = parsed.data;
    if (name === undefined && phone === undefined && password === undefined && avatar_url === undefined) {
      return NextResponse.json({ error: "Няма полета за обновяване." }, { status: 400 });
    }

    let phoneNorm: string | null | undefined = phone;
    if (phoneNorm === "") phoneNorm = null;
    if (phoneNorm != null && phoneNorm.length > 0 && phoneNorm.length < 6) {
      return NextResponse.json({ error: "Телефонът трябва да е поне 6 знака или празен." }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name.trim();
    if (phoneNorm !== undefined) update.phone = phoneNorm;

    if (Object.keys(update).length > 0) {
      const { error } = await session.db.from("admin_users").update(update).eq("id", session.userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (avatar_url !== undefined) {
      const { error } = await session.db.from("admin_users").update({ avatar_url }).eq("id", session.userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (password) {
      const supabase = await createSupabaseServerClient();
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_AUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "NOT_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
