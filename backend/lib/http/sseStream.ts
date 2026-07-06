/**
 * SSE helpers for long-running catalog sync routes.
 * Cloud Run / reverse proxies often buffer until ~2KB — pad the first chunk so
 * progress events reach the browser during multi-minute crawls.
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/** Comment padding (~2KB) to flush proxy buffers before the first event. */
export const SSE_FLUSH_PAD = new TextEncoder().encode(`:${" ".repeat(2048)}\n\n`);

export function sseEncode(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export type SseSend = (event: string, data: unknown) => void;

/** ReadableStream that sends padding immediately, then runs the worker. */
export function createSseResponse(run: (send: SseSend, controller: ReadableStreamDefaultController<Uint8Array>) => Promise<void>): Response {
  const streamBody = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        controller.enqueue(SSE_FLUSH_PAD);
      } catch {
        /* client disconnected */
      }

      const send: SseSend = (event, data) => {
        try {
          controller.enqueue(sseEncode(event, data));
        } catch {
          /* client disconnected */
        }
      };

      void run(send, controller)
        .catch(() => {
          /* errors should be sent via send("error", …) inside run */
        })
        .finally(() => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
    },
  });

  return new Response(streamBody, { headers: SSE_HEADERS });
}
