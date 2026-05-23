import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminSession, requireRole } from "@/lib/admin/db";
import { createSupabaseServiceRoleClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Converts a phone number to an internal Supabase Auth email. */
function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `staff_${digits}@smolyanklima.internal`;
}

/** GET /api/admin/staff — list all staff (master_admin only) */
export async function GET() {
  try {
    const session = await adminSession();
    requireRole(session, "master_admin");

    const { data, error } = await session.db
      .from("admin_users")
      .select("id,phone,name,role,is_active,created_at,last_login_at,avatar_url")
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ staff: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_AUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "NOT_ADMIN" || msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const CreateSchema = z.object({
  phone: z.string().min(6, "Въведи валиден телефонен номер"),
  password: z.string().min(12, "Паролата трябва да е поне 12 символа"),
  name: z.string().min(2).max(80),
  role: z.enum(["office_staff", "service_staff"]),
});

/** POST /api/admin/staff — create new staff member (master_admin only) */
export async function POST(req: NextRequest) {
  try {
    const session = await adminSession();
    requireRole(session, "master_admin");

    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "INVALID_REQUEST" }, { status: 400 });
    }

    const { phone, password, name, role } = parsed.data;
    const email = phoneToEmail(phone);

    // Create Supabase Auth user via admin API
    const adminClient = createSupabaseAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      const msg = authError.message.includes("already registered")
        ? "Служител с този телефон вече съществува."
        : authError.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const userId = authData.user.id;

    // Insert into admin_users
    const serviceClient = createSupabaseServiceRoleClient();
    const { data: staffRow, error: dbError } = await serviceClient
      .from("admin_users")
      .insert({ id: userId, email, phone, name, role, is_active: true })
      .select("id,phone,name,role,is_active,created_at,avatar_url")
      .single();

    if (dbError) {
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ staff: staffRow }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_AUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "NOT_ADMIN" || msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
