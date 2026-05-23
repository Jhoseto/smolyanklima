import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

// On Windows dev, Node.js often cannot verify Supabase TLS via the bundled CA store.
// Enabled by default in development only; set ALLOW_INSECURE_TLS=false to disable.
// Production is never affected (NODE_ENV=production).
if (process.env.NODE_ENV === "development" && process.env.ALLOW_INSECURE_TLS !== "false") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function createSupabaseServerClient() {
  const env = getEnv();
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't set cookies; ignore.
        }
      },
    },
  });
}

export function createSupabaseServiceRoleClient() {
  const env = getEnv();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op
      },
    },
  });
}

/** Direct admin client using supabase-js — supports auth.admin.* API. */
export function createSupabaseAdminClient() {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
