import { NextRequest } from "next/server";
import { adminSessionIfChatOperator, type AdminSession } from "@/lib/admin/db";
import {
  INACTIVITY_CHECK_INTERVAL,
  runInactivityCheckForOpenChats,
} from "@/lib/live-chat/inactivity";

export const dynamic = "force-dynamic";

const POLL_MS = 5_000;

/** GET /api/admin/chat/stream — SSE for inbox changes (new chats / status changes) */
export async function GET(req: NextRequest) {
  const session = await adminSessionIfChatOperator();
  if (!session) return new Response("Forbidden", { status: 403 });
  const supabase = session.db;

  const encoder = new TextEncoder();
  let lastSig = await getSignature(supabase);
  let lastInactivityCheck = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`));

      const timer = setInterval(async () => {
        if (req.signal.aborted) return;
        try {
          const nextSig = await getSignature(supabase);
          if (nextSig !== lastSig) {
            lastSig = nextSig;
            controller.enqueue(
              encoder.encode(`event: changed\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`),
            );
          } else {
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          }

          const now = Date.now();
          if (now - lastInactivityCheck >= INACTIVITY_CHECK_INTERVAL) {
            lastInactivityCheck = now;
            await runInactivityCheckForOpenChats(supabase);
          }
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
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function getSignature(supabase: AdminSession["db"]) {
  const { data } = await supabase
    .from("live_chats")
    .select("id, updated_at, last_message_at")
    .in("status", ["waiting", "active"])
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return "empty";
  return data.map((c) => `${c.id}:${c.last_message_at ?? ""}:${c.updated_at}`).join("|");
}
