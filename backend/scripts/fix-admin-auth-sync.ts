/**
 * One-off: diagnose and repair admin_users ↔ Supabase Auth linkage after backup restore.
 * Usage: cd backend && npx tsx scripts/fix-admin-auth-sync.ts [--apply]
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", override: true });

const apply = process.argv.includes("--apply");

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function phoneFromStaffEmail(email: string): string | null {
  const m = /^staff_(\d+)@smolyanklima\.internal$/i.exec(email.trim());
  return m ? m[1] : null;
}

async function main() {
  const sb = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authErr } = await sb.auth.admin.listUsers({ perPage: 200 });
  if (authErr) throw authErr;

  const { data: admins, error: adminErr } = await sb
    .from("admin_users")
    .select("id,email,phone,name,role,is_active,created_at")
    .order("created_at");
  if (adminErr) throw adminErr;

  const authUsers = authData.users;
  const adminRows = admins ?? [];
  const authByEmail = new Map(authUsers.map((u) => [u.email?.toLowerCase() ?? "", u]));
  const authIds = new Set(authUsers.map((u) => u.id));
  const adminById = new Map(adminRows.map((a) => [a.id, a]));

  console.log(`Auth users: ${authUsers.length}, admin_users rows: ${adminRows.length}, apply=${apply}\n`);

  type Fix =
    | { kind: "ok"; email: string }
    | { kind: "activate"; authId: string; email: string }
    | { kind: "insert"; authId: string; email: string; name: string; role: string; phone: string | null }
    | { kind: "relink_email"; orphanAdminId: string; authId: string; email: string; name: string; role: string; phone: string | null };

  const fixes: Fix[] = [];

  for (const u of authUsers) {
    const email = u.email ?? "";
    const row = adminById.get(u.id);
    if (row?.is_active) {
      fixes.push({ kind: "ok", email });
      continue;
    }
    if (row && !row.is_active) {
      fixes.push({ kind: "activate", authId: u.id, email });
      continue;
    }

    const byEmail = adminRows.find((a) => a.email?.toLowerCase() === email.toLowerCase());
    if (byEmail && byEmail.id !== u.id) {
      fixes.push({
        kind: "relink_email",
        orphanAdminId: byEmail.id,
        authId: u.id,
        email,
        name: byEmail.name,
        role: byEmail.role === "editor" ? "master_admin" : byEmail.role,
        phone: byEmail.phone ?? phoneFromStaffEmail(email),
      });
      continue;
    }

    const metaName = typeof u.user_metadata?.name === "string" ? u.user_metadata.name : null;
    fixes.push({
      kind: "insert",
      authId: u.id,
      email,
      name: metaName ?? email.split("@")[0] ?? "Admin",
      role: "master_admin",
      phone: phoneFromStaffEmail(email),
    });
  }

  for (const a of adminRows) {
    if (!authIds.has(a.id)) {
      console.log(`orphan admin_users (no auth user): ${a.email} id=${a.id} role=${a.role} active=${a.is_active}`);
    }
  }

  for (const f of fixes) {
    console.log(f);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write fixes.");
    return;
  }

  for (const f of fixes) {
    if (f.kind === "ok") continue;

    if (f.kind === "activate") {
      const { error } = await sb.from("admin_users").update({ is_active: true }).eq("id", f.authId);
      if (error) throw new Error(`activate ${f.email}: ${error.message}`);
      console.log(`activated ${f.email}`);
      continue;
    }

    if (f.kind === "relink_email") {
      const orphanEmail = `${f.email}.orphan.${f.orphanAdminId.slice(0, 8)}@smolyanklima.internal`;
      const { error: orphanErr } = await sb
        .from("admin_users")
        .update({ email: orphanEmail, is_active: false })
        .eq("id", f.orphanAdminId);
      if (orphanErr) throw new Error(`orphan ${f.email}: ${orphanErr.message}`);

      const { error: insErr } = await sb.from("admin_users").upsert(
        {
          id: f.authId,
          email: f.email,
          phone: f.phone,
          name: f.name,
          role: f.role,
          is_active: true,
        },
        { onConflict: "id" },
      );
      if (insErr) throw new Error(`relink insert ${f.email}: ${insErr.message}`);
      console.log(`relinked ${f.email} auth=${f.authId} (orphaned old id ${f.orphanAdminId})`);
      continue;
    }

    if (f.kind === "insert") {
      const { error } = await sb.from("admin_users").upsert(
        {
          id: f.authId,
          email: f.email,
          phone: f.phone,
          name: f.name,
          role: f.role,
          is_active: true,
        },
        { onConflict: "id" },
      );
      if (error) throw new Error(`insert ${f.email}: ${error.message}`);
      console.log(`inserted ${f.email} as ${f.role}`);
    }
  }

  console.log("\nDone. Try login at /login");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
