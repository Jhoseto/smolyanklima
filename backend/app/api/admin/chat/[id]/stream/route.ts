import { NextRequest } from "next/server";
import { adminSessionIfChatOperator } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Polling за отворен конкретен чат. Преди беше 900ms × 2 заявки/tick →
 * 130 DB заявки/мин на отворен чат. Сега 2.5s × 2 → 48/мин. Икономия
 * ~63%. Реално UX-ът се запазва: 2.5s забавяне за ново съобщение е
 * незабележимо за admin работа.
 *
 * За още по-бързо UX, паралелно има optimistic UI:
 *  • Admin пише → се вижда веднага локално
 *  • Visitor пише → push notification удря телефона веднага
 *  • SSE синхронизира history-то в фон
 */
const POLL_MS = 2_500;

/** GET /api/admin/chat/[id]/stream — SSE for messages in a specific chat */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await adminSessionIfChatOperator();
  if (!session) return new Response("Forbidden", { status: 403 });
  const supabase = session.db;

  const encoder = new TextEncoder();
  let lastMsgTs = new Date().toISOString();
  let lastUserTyping = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ chatId: id })}\n\n`));

      const timer = setInterval(async () => {
        if (req.signal.aborted) return;
        try {
          // ── New messages (include metadata for product cards) ───────────
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

          // ── Chat status + user typing ───────────────────────────────────
          const { data: chat } = await supabase
            .from("live_chats")
            .select("status, user_typing_at")
            .eq("id", id)
            .maybeSingle();

          if (chat?.status === "closed") {
            controller.enqueue(encoder.encode(`event: closed\ndata: {}\n\n`));
          }

          const userTypingNow = chat?.user_typing_at
            ? Date.now() - new Date(chat.user_typing_at).getTime() < 5_000
            : false;
          if (userTypingNow !== lastUserTyping) {
            lastUserTyping = userTypingNow;
            controller.enqueue(encoder.encode(`event: typing\ndata: ${JSON.stringify({ typing: userTypingNow })}\n\n`));
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
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
