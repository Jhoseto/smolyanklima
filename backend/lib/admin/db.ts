import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function adminDb() {
  // Verify admin via anon+cookies, then use service role for DB access.
  // This avoids brittle RLS dependency on `is_active_admin()` function in different environments.
  const anon = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await anon.auth.getUser();

  if (userErr) throw new Error(userErr.message);
  if (!user) throw new Error("NOT_AUTHENTICATED");

  const { data: adminRow, error: adminErr } = await anon
    .from("admin_users")
    .select("id,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (adminErr) throw new Error(adminErr.message);
  if (!adminRow?.is_active) throw new Error("NOT_ADMIN");

  return createSupabaseServiceRoleClient();
}

