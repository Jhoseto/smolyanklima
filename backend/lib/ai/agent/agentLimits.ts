import type { SupabaseClient } from "@supabase/supabase-js";
import type { getEnv } from "@/lib/env";

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h.startsWith("127.")) return true;
  if (h === "::1" || h === "[::1]") return true;

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const [, a, b] = ipv4.map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

export async function assertAgentDailyBudget(
  db: SupabaseClient,
  adminUserId: string,
  env: ReturnType<typeof getEnv>,
): Promise<void> {
  const limit = env.AI_AGENT_DAILY_REQUESTS_PER_USER ?? 50;
  const { count, error } = await db
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "agent_query")
    .eq("user_id", adminUserId)
    .gte("created_at", startOfTodayIso());

  if (error) throw new Error(error.message);
  if ((count ?? 0) >= limit) {
    throw new Error("AI_DAILY_LIMIT");
  }
}

export async function assertConversationMessageLimit(
  db: SupabaseClient,
  conversationId: string,
  env: ReturnType<typeof getEnv>,
): Promise<void> {
  const limit = env.AI_AGENT_MAX_MESSAGES_PER_CONVERSATION ?? 100;
  const { count, error } = await db
    .from("admin_agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  if (error) throw new Error(error.message);
  if ((count ?? 0) >= limit) {
    throw new Error("AI_CONVERSATION_LIMIT");
  }
}

export async function countSupplierWebCallsToday(
  db: SupabaseClient,
  adminUserId: string,
): Promise<number> {
  const { count, error } = await db
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "agent_supplier_web")
    .eq("user_id", adminUserId)
    .gte("created_at", startOfTodayIso());

  if (error) return 0;
  return count ?? 0;
}

export async function rollbackFailedAgentTurn(
  db: SupabaseClient,
  opts: {
    conversationId: string;
    userMessageId: string | null;
    isNewConversation: boolean;
  },
): Promise<void> {
  if (opts.userMessageId) {
    await db.from("admin_agent_messages").delete().eq("id", opts.userMessageId);
  }

  if (opts.isNewConversation) {
    await db.from("admin_agent_messages").delete().eq("conversation_id", opts.conversationId);
    await db.from("admin_agent_conversations").delete().eq("id", opts.conversationId);
    return;
  }

  const { count } = await db
    .from("admin_agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", opts.conversationId);

  if ((count ?? 0) === 0) {
    await db
      .from("admin_agent_conversations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", opts.conversationId);
  }
}

export function workItemAdminHref(row: {
  id: string;
  event_code?: string | null;
}): string {
  const code = String(row.event_code ?? "");
  if (code === "sale") return "/admin/history";
  if (code === "supplier_order") return `/admin/supplier-orders?highlight=${row.id}`;
  return `/admin?workItem=${row.id}`;
}
