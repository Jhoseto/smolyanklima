/** Quick DB health check after restore. Usage: npx tsx scripts/db-health-check.ts */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", override: true });

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const TABLES = [
  "admin_users",
  "products",
  "categories",
  "work_items",
  "sales",
  "settings",
  "blog_posts",
  "suppliers",
] as const;

async function main() {
  const sb = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("=== TABLE ROW COUNTS ===");
  for (const table of TABLES) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    console.log(`${table}: ${error ? `ERROR ${error.message}` : count ?? 0}`);
  }

  const { data: admins } = await sb.from("admin_users").select("id,email,name,role,is_active");
  console.log("\n=== ADMIN_USERS ===");
  for (const a of admins ?? []) console.log(a);

  const { data: authData } = await sb.auth.admin.listUsers({ perPage: 50 });
  console.log("\n=== AUTH USERS ===");
  for (const u of authData?.users ?? []) console.log({ id: u.id, email: u.email, last: u.last_sign_in_at });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
