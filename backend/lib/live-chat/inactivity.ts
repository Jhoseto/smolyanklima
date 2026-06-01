import type { SupabaseClient } from "@supabase/supabase-js";

/** Без user съобщение след последното → първи системен въпрос. */
export const INACTIVITY_PROMPT_MS = 3 * 60 * 1_000;

/** След първия въпрос, без отговор от клиента → затваряне. */
export const INACTIVITY_CLOSE_AFTER_PROMPT_MS = 2 * 60 * 1_000;

/** Интервал на проверка (admin SSE / visitor SSE). */
export const INACTIVITY_CHECK_INTERVAL = 30_000;

export const INACTIVITY_PROMPT_MESSAGE =
  "Има ли още нещо, с което можем да ви бъдем полезни и нуждаете ли се от допълнителна помощ?";

export const INACTIVITY_CLOSE_MESSAGE =
  "Благодарим, че се свързахте с нас. Този чат прозорец ще бъде затворен. Ако имате нужда от помощ или консултация, не се колебайте да се свържете с нас отново.";

type ChatRow = {
  id: string;
  status: string;
  last_warned_at: string | null;
  created_at: string;
};

type Db = SupabaseClient;

export async function getLastUserMessageAt(db: Db, chatId: string): Promise<number | null> {
  const { data } = await db
    .from("live_chat_messages")
    .select("created_at")
    .eq("chat_id", chatId)
    .eq("sender_role", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return null;
  return new Date(data.created_at as string).getTime();
}

export async function userRepliedAfter(db: Db, chatId: string, afterIso: string): Promise<boolean> {
  const { data } = await db
    .from("live_chat_messages")
    .select("id")
    .eq("chat_id", chatId)
    .eq("sender_role", "user")
    .gt("created_at", afterIso)
    .limit(1);
  return Boolean(data && data.length > 0);
}

export async function insertSystemMessage(db: Db, chatId: string, content: string) {
  const { data, error } = await db
    .from("live_chat_messages")
    .insert({ chat_id: chatId, sender_role: "system", content })
    .select("id, sender_role, content, created_at, metadata")
    .single();
  if (error) throw error;
  return data;
}

/** Само активни чатове (разговор с оператор). */
export async function processChatInactivity(db: Db, chat: ChatRow, now = Date.now()) {
  if (chat.status !== "active") return { action: "none" as const };

  const lastUserAt = await getLastUserMessageAt(db, chat.id);
  const idleSince = lastUserAt ?? new Date(chat.created_at).getTime();
  const warnedAtMs = chat.last_warned_at ? new Date(chat.last_warned_at).getTime() : null;

  if (warnedAtMs) {
    if (await userRepliedAfter(db, chat.id, chat.last_warned_at!)) {
      await db.from("live_chats").update({ last_warned_at: null }).eq("id", chat.id);
      return { action: "reset" as const };
    }

    if (now - warnedAtMs >= INACTIVITY_CLOSE_AFTER_PROMPT_MS) {
      const { data: latest } = await db
        .from("live_chats")
        .select("status, last_warned_at")
        .eq("id", chat.id)
        .maybeSingle();
      if (!latest || latest.status === "closed") return { action: "none" as const };
      if (latest.last_warned_at && (await userRepliedAfter(db, chat.id, latest.last_warned_at))) {
        await db.from("live_chats").update({ last_warned_at: null }).eq("id", chat.id);
        return { action: "reset" as const };
      }

      const inserted = await insertSystemMessage(db, chat.id, INACTIVITY_CLOSE_MESSAGE);
      await db
        .from("live_chats")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", chat.id);
      return { action: "close" as const, message: inserted };
    }

    return { action: "none" as const };
  }

  if (now - idleSince >= INACTIVITY_PROMPT_MS) {
    const { data: latest } = await db
      .from("live_chats")
      .select("last_warned_at, status")
      .eq("id", chat.id)
      .maybeSingle();
    if (!latest || latest.status !== "active" || latest.last_warned_at) {
      return { action: "none" as const };
    }

    const inserted = await insertSystemMessage(db, chat.id, INACTIVITY_PROMPT_MESSAGE);
    const warnNow = new Date().toISOString();
    await db.from("live_chats").update({ last_warned_at: warnNow }).eq("id", chat.id);
    return { action: "prompt" as const, message: inserted };
  }

  return { action: "none" as const };
}

export async function runInactivityCheckForOpenChats(db: Db) {
  const { data: chats } = await db
    .from("live_chats")
    .select("id, status, last_warned_at, created_at")
    .eq("status", "active");

  for (const chat of chats ?? []) {
    try {
      await processChatInactivity(db, chat as ChatRow);
    } catch {
      /* continue other chats */
    }
  }
}
