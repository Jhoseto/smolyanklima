import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function adminDb() {
  // Uses anon key + auth cookies + RLS (admin policies) for safety.
  return await createSupabaseServerClient();
}

