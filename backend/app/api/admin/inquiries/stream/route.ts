import { NextRequest } from "next/server";
import { adminDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 2_000;

export async function GET(req: NextRequest) {
  const supabase = await adminDb();
  const encoder = new TextEncoder();
  let lastSignature = await getInquiriesSignature(supabase);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`));

      const timer = setInterval(async () => {
        if (req.signal.aborted) return;

        try {
          const nextSignature = await getInquiriesSignature(supabase);
          if (nextSignature !== lastSignature) {
            lastSignature = nextSignature;
            controller.enqueue(
              encoder.encode(`event: changed\ndata: ${JSON.stringify({ signature: nextSignature, at: new Date().toISOString() })}\n\n`),
            );
          } else {
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          }
        } catch {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "STREAM_POLL_FAILED" })}\n\n`));
        }
      }, POLL_INTERVAL_MS);

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

async function getInquiriesSignature(supabase: Awaited<ReturnType<typeof adminDb>>) {
  const { data, count, error } = await supabase
    .from("inquiries")
    .select("id,updated_at,created_at", { count: "exact" })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const latest = data?.[0];
  return `${count ?? 0}:${latest?.id ?? "none"}:${latest?.updated_at ?? latest?.created_at ?? "none"}`;
}
