import { NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sseCorsHeaders } from "@/lib/http/cors";
import { processChatInactivity } from "@/lib/live-chat/inactivity";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const POLL_MS = 2_500;

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

  const { data: chat } = await supabase
    .from("live_chats")
    .select("id, session_token, visitor_name, status, last_warned_at, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!chat || chat.session_token !== token) return new Response("Not Found", { status: 404 });

  const encoder = new TextEncoder();
  const afterParam = req.nextUrl.searchParams.get("after");
  let lastMsgTs = afterParam ?? new Date().toISOString();
  let lastStatus = chat.status as string;
  let lastAdminTyping = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ chatId: id })}\n\n`));

      const timer = setInterval(async () => {
        if (req.signal.aborted) return;
        try {
          const { data: newMsgs } = await supabase
            .from("live_chat_messages")
            .select("id, sender_role, content, created_at, metadata")
            .eq("chat_id", id)
            .gt("created_at", lastMsgTs)
            .order("created_at", { ascending: true });

          if (newMsgs && newMsgs.length > 0) {
            lastMsgTs = newMsgs[newMsgs.length - 1].created_at;
            controller.enqueue(
              encoder.encode(`event: messages\ndata: ${JSON.stringify({ messages: newMsgs })}\n\n`),
            );
          }

          const { data: fresh } = await supabase
            .from("live_chats")
            .select("status, admin_typing_at, last_warned_at, created_at")
            .eq("id", id)
            .maybeSingle();

          if (!fresh) return;

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
              encoder.encode(`event: status\ndata: ${JSON.stringify({ status: fresh.status })}\n\n`),
            );
            if (fresh.status === "closed") return;
          }

          if (fresh.status === "closed") return;

          const result = await processChatInactivity(
            supabase,
            {
              id,
              status: fresh.status,
              last_warned_at: fresh.last_warned_at,
              created_at: fresh.created_at ?? chat.created_at,
            },
            Date.now(),
          );

          if (result.action === "prompt" || result.action === "close") {
            if (result.message) {
              lastMsgTs = result.message.created_at as string;
              controller.enqueue(
                encoder.encode(`event: messages\ndata: ${JSON.stringify({ messages: [result.message] })}\n\n`),
              );
            }
            if (result.action === "close") {
              lastStatus = "closed";
              controller.enqueue(
                encoder.encode(`event: status\ndata: ${JSON.stringify({ status: "closed" })}\n\n`),
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
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
