import { NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sseCorsHeaders } from "@/lib/http/cors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Нов съобщение-поток: 1s за бързо получаване */
const POLL_MS = 1_000;
/** 5 минути без съобщение → предупреждение */
const INACTIVITY_WARN_MS = 5 * 60 * 1_000;
/** 3 минути след предупреждението → затваряне */
const INACTIVITY_CLOSE_MS = 3 * 60 * 1_000;

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: { ...sseCorsHeaders(req), "Access-Control-Allow-Headers": "X-Chat-Session-Token" },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = req.headers.get("x-chat-session-token");
  if (!token) return new Response("Unauthorized", { status: 401 });

  const supabase = createSupabaseServiceRoleClient();

  // Validate session
  const { data: chat } = await supabase
    .from("live_chats")
    .select("id, session_token, visitor_name, status, last_message_at, last_warned_at")
    .eq("id", id)
    .maybeSingle();

  if (!chat || chat.session_token !== token) return new Response("Not Found", { status: 404 });

  const encoder = new TextEncoder();
  // Start from the client's last known message timestamp (if provided) to prevent duplicates
  const afterParam = req.nextUrl.searchParams.get("after");
  let lastMsgTs = afterParam ?? new Date().toISOString();
  let lastStatus = chat.status as string;
  let lastAdminTyping = false;

  // ── Inactivity state ──────────────────────────────────────────────────────
  // Работим с DB полета за устойчивост при рестарт на SSE
  let warningSentAt: number | null = chat.last_warned_at ? new Date(chat.last_warned_at).getTime() : null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ chatId: id })}\n\n`));

      const timer = setInterval(async () => {
        if (req.signal.aborted) return;
        try {
          // ── Нови съобщения ──────────────────────────────────────────────
          const { data: newMsgs } = await supabase
            .from("live_chat_messages")
            .select("id, sender_role, content, created_at, metadata")
            .eq("chat_id", id)
            .gt("created_at", lastMsgTs)
            .order("created_at", { ascending: true });

          if (newMsgs && newMsgs.length > 0) {
            lastMsgTs = newMsgs[newMsgs.length - 1].created_at;
            controller.enqueue(
              encoder.encode(`event: messages\ndata: ${JSON.stringify({ messages: newMsgs })}\n\n`)
            );
          }

          // ── Статус / затваряне ──────────────────────────────────────────
          const { data: fresh } = await supabase
            .from("live_chats")
            .select("status, last_message_at, last_warned_at, admin_typing_at")
            .eq("id", id)
            .maybeSingle();

          if (!fresh) return;

          // ── Admin typing indicator ──────────────────────────────────────
          const adminTypingNow = fresh.admin_typing_at
            ? Date.now() - new Date(fresh.admin_typing_at).getTime() < 5_000
            : false;
          if (adminTypingNow !== lastAdminTyping) {
            lastAdminTyping = adminTypingNow;
            controller.enqueue(encoder.encode(`event: typing\ndata: ${JSON.stringify({ typing: adminTypingNow })}\n\n`));
          }

          if (fresh.status !== lastStatus) {
            lastStatus = fresh.status;
            controller.enqueue(
              encoder.encode(`event: status\ndata: ${JSON.stringify({ status: fresh.status })}\n\n`)
            );
            if (fresh.status === "closed") return; // спираме след closed
          }

          // ── Инактивност ─────────────────────────────────────────────────
          if (fresh.status === "closed") return;

          const now = Date.now();
          const lastMsgTime = fresh.last_message_at
            ? new Date(fresh.last_message_at).getTime()
            : now;
          const dbWarnedAt = fresh.last_warned_at ? new Date(fresh.last_warned_at).getTime() : null;

          // Sync: ако от друга SSE инстанция е изпратено предупреждение
          if (dbWarnedAt && !warningSentAt) {
            warningSentAt = dbWarnedAt;
          }

          const inactive = now - lastMsgTime;

          if (!warningSentAt && inactive >= INACTIVITY_WARN_MS) {
            // ── Изпращаме предупреждение ──────────────────────────────────
            const visitorName = chat.visitor_name;
            const warnMsg = `Здравейте, ${visitorName}! Имате ли още въпроси? Ако не — чатът ще бъде автоматично затворен след 3 минути.`;

            const { data: inserted } = await supabase
              .from("live_chat_messages")
              .insert({ chat_id: id, sender_role: "system", content: warnMsg })
              .select("id, sender_role, content, created_at, metadata")
              .single();

            const warnNow = new Date().toISOString();
            await supabase
              .from("live_chats")
              .update({ last_warned_at: warnNow })
              .eq("id", id);

            warningSentAt = now;
            lastMsgTs = warnNow;

            if (inserted) {
              controller.enqueue(
                encoder.encode(`event: messages\ndata: ${JSON.stringify({ messages: [inserted] })}\n\n`)
              );
            }
          } else if (warningSentAt && now - warningSentAt >= INACTIVITY_CLOSE_MS) {
            // ── Затваряме ─────────────────────────────────────────────────
            // Проверяваме дали потребителят е отговорил след предупреждението
            const { data: recentMsgs } = await supabase
              .from("live_chat_messages")
              .select("sender_role, created_at")
              .eq("chat_id", id)
              .eq("sender_role", "user")
              .gt("created_at", new Date(warningSentAt).toISOString())
              .limit(1);

            if (recentMsgs && recentMsgs.length > 0) {
              // Потребителят е отговорил — нулираме предупреждението
              warningSentAt = null;
              await supabase
                .from("live_chats")
                .update({ last_warned_at: null })
                .eq("id", id);
            } else {
              // Затваряме чата
              const closeMsg = "— Чатът беше автоматично затворен поради неактивност. Можете да отворите нов чат по всяко време. —";

              await supabase.from("live_chat_messages").insert({
                chat_id: id,
                sender_role: "system",
                content: closeMsg,
              });

              await supabase
                .from("live_chats")
                .update({ status: "closed", closed_at: new Date().toISOString() })
                .eq("id", id);

              controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({ status: "closed" })}\n\n`));
              controller.enqueue(
                encoder.encode(`event: messages\ndata: ${JSON.stringify({
                  messages: [{ id: crypto.randomUUID(), sender_role: "system", content: closeMsg, created_at: new Date().toISOString() }]
                })}\n\n`)
              );
            }
          }

          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(`event: error\ndata: {}\n\n`));
        }
      }, POLL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...sseCorsHeaders(req),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
