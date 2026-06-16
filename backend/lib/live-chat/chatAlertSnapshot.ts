import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminSession } from "@/lib/admin/db";

export type ChatAlertSnapshot = {
  waiting: Array<{ id: string; visitorName: string; visitorPhone: string | null; createdAt: string }>;
  userMessages: Array<{
    chatId: string;
    visitorName: string;
    visitorPhone: string | null;
    messageId: string;
    createdAt: string;
  }>;
};

/** Един snapshot за звук/бadge — без N+1 заявки за всяко съобщение. */
export async function loadChatAlertSnapshot(supabase: SupabaseClient): Promise<ChatAlertSnapshot> {
  const { data: chats, error: chatErr } = await supabase
    .from("live_chats")
    .select("id, visitor_name, visitor_phone, status, created_at, last_message_at")
    .in("status", ["waiting", "active"]);

  if (chatErr) throw chatErr;

  const openChats = chats ?? [];
  const waiting = openChats.filter((c) => c.status === "waiting");
  const chatIds = openChats.map((c) => c.id as string);

  const lastUserByChat = new Map<string, { id: string; created_at: string }>();
  if (chatIds.length > 0) {
    await Promise.all(
      chatIds.map(async (chatId) => {
        const { data: msg, error: msgErr } = await supabase
          .from("live_chat_messages")
          .select("id, created_at")
          .eq("chat_id", chatId)
          .eq("sender_role", "user")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (msgErr) throw msgErr;
        if (msg) {
          lastUserByChat.set(chatId, { id: msg.id as string, created_at: msg.created_at as string });
        }
      }),
    );
  }

  const userMessages = openChats
    .map((c) => {
      const last = lastUserByChat.get(c.id as string);
      if (!last) return null;
      return {
        chatId: c.id as string,
        visitorName: (c.visitor_name as string) ?? "Посетител",
        visitorPhone: (c.visitor_phone as string | null) ?? null,
        messageId: last.id,
        createdAt: last.created_at,
      };
    })
    .filter(Boolean) as ChatAlertSnapshot["userMessages"];

  return {
    waiting: waiting.map((c) => ({
      id: c.id as string,
      visitorName: (c.visitor_name as string) ?? "Посетител",
      visitorPhone: (c.visitor_phone as string | null) ?? null,
      createdAt: c.created_at as string,
    })),
    userMessages,
  };
}

/** Сигнатура за SSE — без `updated_at`, за да не се пуска `changed` при всяка вътрешна touch. */
export async function chatInboxSignature(supabase: AdminSession["db"]): Promise<string> {
  const { data } = await supabase
    .from("live_chats")
    .select("id, status, last_message_at, created_at")
    .in("status", ["waiting", "active"])
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (!data || data.length === 0) return "empty";
  return data
    .map((c) => `${c.id}:${c.status}:${c.last_message_at ?? c.created_at ?? ""}`)
    .join("|");
}
