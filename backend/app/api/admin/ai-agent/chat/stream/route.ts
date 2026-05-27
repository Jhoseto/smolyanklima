import { NextRequest } from "next/server";
import { z } from "zod";
import { corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";
import { handleAgentChat } from "@/lib/ai/agent/chatHandler";

const BodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(8000).optional(),
  regenerate: z.boolean().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const status = msg === "NOT_AUTHENTICATED" ? 401 : 403;
    return new Response(JSON.stringify({ error: status === 401 ? "Неоторизиран достъп" : "Forbidden" }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const json = await req.json().catch(() => null);
  const parsedBody = BodySchema.safeParse(json);
  if (!parsedBody.success) {
    return new Response(JSON.stringify({ error: "Невалидно съобщение." }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await handleAgentChat(session, parsedBody.data, {
          signal: req.signal,
          onProgress: (event) => send("progress", event),
          onTextDelta: (chunk) => send("delta", { text: chunk }),
        });
        send("done", result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
