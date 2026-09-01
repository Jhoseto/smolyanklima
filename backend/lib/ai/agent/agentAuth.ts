import { adminSession, requireRole, type AdminSession } from "@/lib/admin/db";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/** master_admin + office_staff — чат с AI agent. */
export async function requireAdminAgentSession(): Promise<AdminSession> {
  const session = await adminSession();
  requireRole(session, "master_admin", "office_staff");
  return session;
}

/** Само master_admin — история, търсене, изтриване, експорт, scheduled reports. */
export async function requireMasterAdminAgentSession(): Promise<AdminSession> {
  const session = await adminSession();
  requireRole(session, "master_admin");
  return session;
}

export function canBrowseAgentConversations(session: AdminSession): boolean {
  return session.role === "master_admin";
}

export async function agentSessionForUserId(userId: string): Promise<AdminSession> {
  const db = createSupabaseServiceRoleClient();
  const { data: adminRow, error } = await db
    .from("admin_users")
    .select("id,is_active,role,name,email,avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!adminRow?.is_active || adminRow.role !== "master_admin") {
    throw new Error("Invalid master_admin for scheduled report");
  }

  return {
    db,
    role: "master_admin",
    userId: adminRow.id,
    name: adminRow.name ?? "",
    email: adminRow.email ?? "",
    avatarUrl: adminRow.avatar_url ?? null,
  };
}

export function isAgentCronAuthorized(req: Request): boolean {
  const secret = process.env.AI_AGENT_CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("x-ai-agent-cron-secret") === secret;
}

export async function requireMasterAdminOrCron(req: Request): Promise<AdminSession | "cron"> {
  if (isAgentCronAuthorized(req)) return "cron";
  return requireMasterAdminAgentSession();
}
