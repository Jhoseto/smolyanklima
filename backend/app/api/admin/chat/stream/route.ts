import { NextRequest } from "next/server";
import { adminDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

const POLL_MS = 1_500;
/** 5 минути без съобщение от никого → предупреждение */
const INACTIVITY_WARN_MS = 5 * 60 * 1_000;
/** 3 минути след предупреждението без отговор → затваряне */
const INACTIVITY_CLOSE_MS = 3 * 60 * 1_000;
/** Проверява inactivity на всеки 30 секунди (не на всеки poll) */
const INACTIVITY_CHECK_INTERVAL = 30_000;

/** GET /api/admin/chat/stream — SSE for inbox changes (new chats / status changes) */
export async function GET(req: NextRequest) {
  const supabase = await adminDb().catch(() => null);
  if (!supabase) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let lastSig = await getSignature(supabase);
  let lastInactivityCheck = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`));

      const timer = setInterval(async () => {
        if (req.signal.aborted) return;
        try {
          // ── Inbox signature change ──────────────────────────────────────
          const nextSig = await getSignature(supabase);
          if (nextSig !== lastSig) {
            lastSig = nextSig;
            controller.enqueue(
              encoder.encode(`event: changed\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`)
            );
          } else {
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          }

          // ── Inactivity check (server-side, runs even when client SSE is off) ──
          const now = Date.now();
          if (now - lastInactivityCheck >= INACTIVITY_CHECK_INTERVAL) {
            lastInactivityCheck = now;
            await checkInactivity(supabase, now);
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
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function getSignature(supabase: Awaited<ReturnType<typeof adminDb>>) {
  const { data } = await supabase
    .from("live_chats")
    .select("id,updated_at")
    .in("status", ["waiting", "active"])
    .order("updated_at", { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return "empty";
  return `${data[0].id}:${data[0].updated_at}`;
}

/**
 * Server-side inactivity enforcement — runs from the admin SSE so it works
 * even when the visitor has closed/minimised the chat widget.
 */
async function checkInactivity(
  supabase: Awaited<ReturnType<typeof adminDb>>,
  now: number
) {
  const warnThreshold = new Date(now - INACTIVITY_WARN_MS).toISOString();
  const closeThreshold = new Date(now - INACTIVITY_CLOSE_MS).toISOString();

  // ── 1. Fetch all active/waiting chats ────────────────────────────────────
  const { data: chats } = await supabase
    .from("live_chats")
    .select("id, visitor_name, status, last_message_at, last_warned_at")
    .in("status", ["waiting", "active"]);

  if (!chats || chats.length === 0) return;

  for (const chat of chats) {
    const lastMsgAt = chat.last_message_at
      ? new Date(chat.last_message_at).getTime()
      : now;
    const warnedAt = chat.last_warned_at
      ? new Date(chat.last_warned_at).getTime()
      : null;

    if (!warnedAt && now - lastMsgAt >= INACTIVITY_WARN_MS) {
      // ── Send warning message ──────────────────────────────────────────
      const warnMsg = `Здравейте, ${chat.visitor_name}! Имате ли още въпроси? Ако не — чатът ще бъде автоматично затворен след 3 минути.`;
      const warnNow = new Date().toISOString();

      // Guard: check last_warned_at again to avoid double-insert from both SSEs
      const { data: latest } = await supabase
        .from("live_chats")
        .select("last_warned_at")
        .eq("id", chat.id)
        .single();
      if (latest?.last_warned_at) continue; // already warned by user SSE

      await supabase.from("live_chat_messages").insert({
        chat_id: chat.id,
        sender_role: "system",
        content: warnMsg,
      });
      await supabase
        .from("live_chats")
        .update({ last_warned_at: warnNow })
        .eq("id", chat.id);

    } else if (warnedAt && chat.last_warned_at && chat.last_warned_at <= closeThreshold) {
      // ── Check if user replied after warning ──────────────────────────
      const { data: userReplies } = await supabase
        .from("live_chat_messages")
        .select("id")
        .eq("chat_id", chat.id)
        .eq("sender_role", "user")
        .gt("created_at", chat.last_warned_at)
        .limit(1);

      if (userReplies && userReplies.length > 0) {
        // User replied — reset warning
        await supabase
          .from("live_chats")
          .update({ last_warned_at: null })
          .eq("id", chat.id);
      } else {
        // Close the chat
        const closeMsg = "— Чатът беше автоматично затворен поради неактивност. Можете да отворите нов чат по всяко време. —";
        await supabase.from("live_chat_messages").insert({
          chat_id: chat.id,
          sender_role: "system",
          content: closeMsg,
        });
        await supabase
          .from("live_chats")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", chat.id);
      }
    }
  }
}
