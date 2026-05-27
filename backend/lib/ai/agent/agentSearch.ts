import type { SupabaseClient } from "@supabase/supabase-js";
import { blocksToPlainText } from "@/lib/ai/agent/blocksText";
import type { AgentBlock } from "@/lib/ai/agent/types";

export type AgentSearchHit = {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: "user" | "assistant";
  snippet: string;
  createdAt: string;
};

function buildSnippet(text: string, query: string, maxLen = 160): string {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text.slice(0, maxLen) + (text.length > maxLen ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function messagePlainText(role: string, content: unknown): string {
  const c = content as { text?: string; blocks?: AgentBlock[] };
  if (role === "user") return c.text ?? "";
  return blocksToPlainText(c.blocks ?? []);
}

function matchesQuery(text: string, q: string): boolean {
  return text.toLowerCase().includes(q.toLowerCase());
}

export async function searchAgentConversations(
  db: SupabaseClient,
  adminUserId: string,
  query: string,
  limit = 25,
): Promise<AgentSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data: conversations, error: convErr } = await db
    .from("admin_agent_conversations")
    .select("id,title,updated_at")
    .eq("admin_user_id", adminUserId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (convErr) throw new Error(convErr.message);

  const convMap = new Map((conversations ?? []).map((c) => [c.id as string, c as { id: string; title: string; updated_at: string }]));
  const convIds = [...convMap.keys()];
  if (convIds.length === 0) return [];

  const { data: messages, error: msgErr } = await db
    .from("admin_agent_messages")
    .select("id,conversation_id,role,content,created_at")
    .in("conversation_id", convIds)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(400);

  if (msgErr) throw new Error(msgErr.message);

  const hits: AgentSearchHit[] = [];
  const seen = new Set<string>();

  for (const row of messages ?? []) {
    const r = row as { id: string; conversation_id: string; role: string; content: unknown; created_at: string };
    const conv = convMap.get(r.conversation_id);
    if (!conv) continue;
    const plain = messagePlainText(r.role, r.content);
    if (!matchesQuery(plain, q) && !matchesQuery(conv.title, q)) continue;
    const key = `${r.conversation_id}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      conversationId: r.conversation_id,
      conversationTitle: conv.title,
      messageId: r.id,
      role: r.role as "user" | "assistant",
      snippet: buildSnippet(plain || conv.title, q),
      createdAt: r.created_at,
    });
  }

  for (const conv of convMap.values()) {
    if (!matchesQuery(conv.title, q)) continue;
    const key = `${conv.id}:title`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      conversationId: conv.id,
      conversationTitle: conv.title,
      messageId: "",
      role: "user",
      snippet: buildSnippet(conv.title, q),
      createdAt: conv.updated_at,
    });
  }

  hits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return hits.slice(0, limit);
}
