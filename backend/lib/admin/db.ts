import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type AdminRole = "master_admin" | "office_staff" | "service_staff";

export interface AdminSession {
  db: ReturnType<typeof createSupabaseServiceRoleClient>;
  role: AdminRole;
  userId: string;
  name: string;
  email: string;
  /** Профилна снимка (Cloudinary URL), ако е зададена. */
  avatarUrl: string | null;
}

/** Full session with role — use for new routes and the layout. */
export async function adminSession(): Promise<AdminSession> {
  const anon = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await anon.auth.getUser();

  if (userErr) throw new Error(userErr.message);
  if (!user) throw new Error("NOT_AUTHENTICATED");

  const { data: adminRow, error: adminErr } = await anon
    .from("admin_users")
    .select("id,is_active,role,name,email,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (adminErr) throw new Error(adminErr.message);
  if (!adminRow?.is_active) throw new Error("NOT_ADMIN");

  return {
    db: createSupabaseServiceRoleClient(),
    role: (adminRow.role ?? "office_staff") as AdminRole,
    userId: adminRow.id,
    name: adminRow.name ?? "",
    email: adminRow.email ?? "",
    avatarUrl: (adminRow as { avatar_url?: string | null }).avatar_url ?? null,
  };
}

/** Throw FORBIDDEN if the session role is not in the allowed list. */
export function requireRole(session: AdminSession, ...roles: AdminRole[]) {
  if (!roles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }
}

/** Legacy helper — returns only the service-role DB client.
 *  Kept for backwards compatibility with existing routes. */
export async function adminDb() {
  const { db } = await adminSession();
  return db;
}
