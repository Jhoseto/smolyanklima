import { adminDb, adminSession, requireRole, type AdminSession } from "@/lib/admin/db";

export async function requireMasterAdminAgentSession(): Promise<AdminSession> {
  const session = await adminSession();
  requireRole(session, "master_admin");
  return session;
}

export async function agentSessionForUserId(userId: string): Promise<AdminSession> {
  const db = await adminDb();
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
