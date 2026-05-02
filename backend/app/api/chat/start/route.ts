import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const StartSchema = z.object({
  visitor_name: z.string().min(1).max(120).trim(),
  visitor_email: z.string().email().max(254).optional().or(z.literal("")),
  visitor_phone: z.string().max(30).optional(),
  visitor_page_url: z.string().url().max(500).optional(),
  ai_context: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(20)
    .optional(),
});

/** Намери най-скорошния чат по имейл (отворен ИЛИ затворен). */
async function findLatestChatByEmail(supabase: ReturnType<typeof createSupabaseServiceRoleClient>, email: string) {
  const { data } = await supabase
    .from("live_chats")
    .select("id, session_token, visitor_name, status, created_at")
    .eq("visitor_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

function greetingText(name: string): string {
  return `Здравейте, ${name}! Добре дошли в чата на Смолян Клима. С какво можем да ви бъдем полезни ? 🙂`;
}

function continuationText(name: string, prevDate: string): string {
  const d = new Date(prevDate).toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric" });
  return `— Продължение на разговор от ${d} —`;
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = StartSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }));
  }

  const { visitor_name, visitor_email, visitor_phone, visitor_page_url, ai_context } = parsed.data;
  const supabase = createSupabaseServiceRoleClient();
  const email = visitor_email || null;

  // ── Проверяваме за предишен чат по имейл ──────────────────────────────────
  if (email) {
    const existing = await findLatestChatByEmail(supabase, email);

    if (existing) {
      // ── Активен/чакащ чат — подновяваме session token ────────────────────
      if (existing.status !== "closed") {
        const newToken = crypto.randomUUID();
        await supabase
          .from("live_chats")
          .update({
            session_token: newToken,
            visitor_name,  // обновяваме ако е сменил
            visitor_phone: visitor_phone || null,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        await supabase.from("live_chat_messages").insert({
          chat_id: existing.id,
          sender_role: "system",
          content: `— Посетителят се свърза отново (${new Date().toLocaleString("bg-BG")}) —`,
        });

        return withCors(req, NextResponse.json({
          chatId: existing.id,
          sessionToken: newToken,
          visitorName: visitor_name,
          status: existing.status,
          resumed: true,
        }));
      }

      // ── Затворен чат — нов чат с история ─────────────────────────────────
      const { data: newChat, error: insertErr } = await supabase
        .from("live_chats")
        .insert({
          visitor_name,
          visitor_email: email,
          visitor_phone: visitor_phone || null,
          ai_context: ai_context ?? null,
          status: "waiting",
          last_message_at: new Date().toISOString(),
          previous_chat_id: existing.id,
          visitor_page_url: visitor_page_url ?? null,
        })
        .select("id, session_token, visitor_name, status")
        .single();

      if (insertErr || !newChat) {
        return withCors(req, NextResponse.json({ error: "DB_ERROR" }, { status: 500 }));
      }

      // Копираме историята на предишния разговор
      const { data: prevMsgs } = await supabase
        .from("live_chat_messages")
        .select("sender_role, content, created_at")
        .eq("chat_id", existing.id)
        .order("created_at", { ascending: true });

      const historyRows: Array<{ chat_id: string; sender_role: string; content: string }> = [];

      historyRows.push({
        chat_id: newChat.id,
        sender_role: "system",
        content: continuationText(visitor_name, existing.created_at),
      });

      for (const m of prevMsgs ?? []) {
        if (m.sender_role === "system" && m.content.startsWith("—")) continue; // пропуски системни разделители
        historyRows.push({ chat_id: newChat.id, sender_role: m.sender_role, content: m.content });
      }

      // Разделител "край на историята / начало на новия разговор"
      historyRows.push({
        chat_id: newChat.id,
        sender_role: "system",
        content: "— Нов разговор —",
      });

      if (historyRows.length > 0) {
        await supabase.from("live_chat_messages").insert(historyRows);
      }

      // Greeting за новия разговор
      await supabase.from("live_chat_messages").insert({
        chat_id: newChat.id,
        sender_role: "system",
        content: greetingText(visitor_name),
      });

      // AI контекст ако е подаден
      if (ai_context && ai_context.length > 0) {
        await supabase.from("live_chat_messages").insert({
          chat_id: newChat.id,
          sender_role: "system",
          content: `— Прехвърлен от AI асистент. Контекст от разговора (${ai_context.length} съобщения) —`,
        });
      }

      return withCors(req, NextResponse.json({
        chatId: newChat.id,
        sessionToken: newChat.session_token,
        visitorName: newChat.visitor_name,
        status: newChat.status,
        resumed: false,
        hadHistory: true,
      }));
    }
  }

  // ── Нов чат (без предишен или без имейл) ──────────────────────────────────
  const { data: chat, error } = await supabase
    .from("live_chats")
    .insert({
      visitor_name,
      visitor_email: email,
      visitor_phone: visitor_phone || null,
      ai_context: ai_context ?? null,
      status: "waiting",
      last_message_at: new Date().toISOString(),
      visitor_page_url: visitor_page_url ?? null,
    })
    .select("id, session_token, visitor_name, status")
    .single();

  if (error || !chat) {
    return withCors(req, NextResponse.json({ error: "DB_ERROR" }, { status: 500 }));
  }

  // Greeting
  await supabase.from("live_chat_messages").insert({
    chat_id: chat.id,
    sender_role: "system",
    content: greetingText(visitor_name),
  });

  // AI контекст
  if (ai_context && ai_context.length > 0) {
    await supabase.from("live_chat_messages").insert({
      chat_id: chat.id,
      sender_role: "system",
      content: `— Прехвърлен от AI асистент. Контекст от разговора (${ai_context.length} съобщения) —`,
    });
  }

  return withCors(req, NextResponse.json({
    chatId: chat.id,
    sessionToken: chat.session_token,
    visitorName: chat.visitor_name,
    status: chat.status,
    resumed: false,
    hadHistory: false,
  }));
}
