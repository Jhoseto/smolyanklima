import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { notifyAdminsLiveChat } from "@/lib/admin-web-push";
import { allowPublicPost, getClientIdFromRequest } from "@/lib/rate-limit";

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
  /** Resume only when caller proves ownership with prior session token (never by email alone). */
  resume_chat_id: z.string().uuid().optional(),
  resume_session_token: z.string().uuid().optional(),
});

async function resolveOwnedChat(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  chatId: string,
  sessionToken: string,
) {
  const { data } = await supabase
    .from("live_chats")
    .select("id, session_token, visitor_name, visitor_email, status, created_at")
    .eq("id", chatId)
    .maybeSingle();
  if (!data || data.session_token !== sessionToken) return null;
  return data;
}

function greetingText(name: string): string {
  return `Здравейте, ${name}! Добре дошли в чата на Смолян Klima. С какво можем да ви бъдем полезни ? 🙂`;
}

function continuationText(name: string, prevDate: string): string {
  const d = new Date(prevDate).toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric" });
  return `— Продължение на разговор от ${d} —`;
}

export async function POST(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!allowPublicPost(`chat-start:${clientId}`, 12, 60 * 60 * 1000)) {
    return withCors(req, NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = StartSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }));
  }

  const {
    visitor_name,
    visitor_email,
    visitor_phone,
    visitor_page_url,
    ai_context,
    resume_chat_id,
    resume_session_token,
  } = parsed.data;
  const supabase = createSupabaseServiceRoleClient();
  const email = visitor_email || null;

  // ── Resume only with valid chat id + session token (never email alone) ─────
  if (resume_chat_id && resume_session_token) {
    const owned = await resolveOwnedChat(supabase, resume_chat_id, resume_session_token);
    if (owned) {
      if (owned.status !== "closed") {
        const newToken = crypto.randomUUID();
        await supabase
          .from("live_chats")
          .update({
            session_token: newToken,
            visitor_name,
            visitor_phone: visitor_phone || null,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", owned.id);

        await supabase.from("live_chat_messages").insert({
          chat_id: owned.id,
          sender_role: "system",
          content: `— Посетителят се свърза отново (${new Date().toLocaleString("bg-BG")}) —`,
        });

        return withCors(req, NextResponse.json({
          chatId: owned.id,
          sessionToken: newToken,
          visitorName: visitor_name,
          status: owned.status,
          resumed: true,
        }));
      }

      // Closed chat — new chat with history (owner proved via token)
      const { data: newChat, error: insertErr } = await supabase
        .from("live_chats")
        .insert({
          visitor_name,
          visitor_email: email ?? owned.visitor_email,
          visitor_phone: visitor_phone || null,
          ai_context: ai_context ?? null,
          status: "waiting",
          last_message_at: new Date().toISOString(),
          previous_chat_id: owned.id,
          visitor_page_url: visitor_page_url ?? null,
        })
        .select("id, session_token, visitor_name, status")
        .single();

      if (insertErr || !newChat) {
        return withCors(req, NextResponse.json({ error: "DB_ERROR" }, { status: 500 }));
      }

      const { data: prevMsgs } = await supabase
        .from("live_chat_messages")
        .select("sender_role, content, created_at")
        .eq("chat_id", owned.id)
        .order("created_at", { ascending: true });

      const historyRows: Array<{ chat_id: string; sender_role: string; content: string }> = [];
      historyRows.push({
        chat_id: newChat.id,
        sender_role: "system",
        content: continuationText(visitor_name, owned.created_at),
      });

      for (const m of prevMsgs ?? []) {
        if (m.sender_role === "system" && m.content.startsWith("—")) continue;
        historyRows.push({ chat_id: newChat.id, sender_role: m.sender_role, content: m.content });
      }

      historyRows.push({
        chat_id: newChat.id,
        sender_role: "system",
        content: "— Нов разговор —",
      });

      if (historyRows.length > 0) {
        await supabase.from("live_chat_messages").insert(historyRows);
      }

      await supabase.from("live_chat_messages").insert({
        chat_id: newChat.id,
        sender_role: "system",
        content: greetingText(visitor_name),
      });

      if (ai_context && ai_context.length > 0) {
        await supabase.from("live_chat_messages").insert({
          chat_id: newChat.id,
          sender_role: "system",
          content: `— Прехвърлен от AI асистент. Контекст от разговора (${ai_context.length} съобщения) —`,
        });
      }

      void notifyAdminsLiveChat({
        title: "Нова жива връзка",
        body: `${newChat.visitor_name} изчаква консултант`,
        url: "/admin/chat",
        tag: `live-chat-${newChat.id}`,
      }).catch(() => {});

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

  // ── New chat ──────────────────────────────────────────────────────────────
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

  await supabase.from("live_chat_messages").insert({
    chat_id: chat.id,
    sender_role: "system",
    content: greetingText(visitor_name),
  });

  if (ai_context && ai_context.length > 0) {
    await supabase.from("live_chat_messages").insert({
      chat_id: chat.id,
      sender_role: "system",
      content: `— Прехвърлен от AI асистент. Контекст от разговора (${ai_context.length} съобщения) —`,
    });
  }

  void notifyAdminsLiveChat({
    title: "Нова жива връзка",
    body: `${chat.visitor_name} изчаква консултант`,
    url: "/admin/chat",
    tag: `live-chat-${chat.id}`,
  }).catch(() => {});

  return withCors(req, NextResponse.json({
    chatId: chat.id,
    sessionToken: chat.session_token,
    visitorName: chat.visitor_name,
    status: chat.status,
    resumed: false,
    hadHistory: false,
  }));
}
