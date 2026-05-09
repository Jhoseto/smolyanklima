import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminSession, requireRole } from "@/lib/admin/db";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

const UpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  role: z.enum(["master_admin", "office_staff", "service_staff"]).optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

/** PUT /api/admin/staff/[id] — update role / status / password */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const session = await adminSession();
    requireRole(session, "master_admin");

    // Prevent master_admin from demoting themselves
    if (id === session.userId) {
      const body = await req.json().catch(() => ({}));
      if (body.role && body.role !== "master_admin") {
        return NextResponse.json({ error: "Не можеш да промениш собствената си роля." }, { status: 400 });
      }
      if (body.is_active === false) {
        return NextResponse.json({ error: "Не можеш да деактивираш собствения си акаунт." }, { status: 400 });
      }
    }

    const body = await req.json().catch(() => null);
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "INVALID_REQUEST" }, { status: 400 });
    }

    const serviceClient = createSupabaseServiceRoleClient();
    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.role !== undefined) update.role = parsed.data.role;
    if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;

    if (Object.keys(update).length > 0) {
      const { error } = await serviceClient.from("admin_users").update(update).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update password separately via Auth admin API
    if (parsed.data.password) {
      const { error: pwErr } = await serviceClient.auth.admin.updateUserById(id, {
        password: parsed.data.password,
      });
      if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_AUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "NOT_ADMIN" || msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/admin/staff/[id] — permanently remove staff member */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const session = await adminSession();
    requireRole(session, "master_admin");

    if (id === session.userId) {
      return NextResponse.json({ error: "Не можеш да изтриеш собствения си акаунт." }, { status: 400 });
    }

    const serviceClient = createSupabaseServiceRoleClient();
    await serviceClient.from("admin_users").delete().eq("id", id);
    await serviceClient.auth.admin.deleteUser(id);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_AUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "NOT_ADMIN" || msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
