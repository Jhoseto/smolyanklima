import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

/**
 * On Windows in development, Node.js cannot verify Supabase's SSL certificate
 * because it doesn't use the Windows CA store.  Instead of disabling TLS
 * globally (NODE_TLS_REJECT_UNAUTHORIZED=0), we scope the bypass to just the
 * fetch layer via an undici Agent — production is completely unaffected.
 */
function patchDevTls() {
  if (process.env.NODE_ENV !== "development") return;
  try {
    // undici is bundled with Node.js 18+ — no extra dependency needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Agent, setGlobalDispatcher } = require("undici") as typeof import("undici");
    setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));
  } catch {
    // undici not available — fall back silently
  }
}

// Apply once at module load (dev only)
patchDevTls();

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
