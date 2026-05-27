import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireAdminAgentSession } from "@/lib/ai/agent/agentAuth";
import { handleAgentChat } from "@/lib/ai/agent/chatHandler";
import { getEnv } from "@/lib/env";

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
    session = await requireAdminAgentSession();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_AUTHENTICATED") {
      return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
    }
    return withCors(req, NextResponse.json({ error: "Нямате достъп до AI Agent." }, { status: 403 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидно съобщение." }, { status: 400 }));
  }

  if (!parsed.data.regenerate && !parsed.data.message?.trim()) {
    return withCors(req, NextResponse.json({ error: "Невалидно съобщение." }, { status: 400 }));
  }

  const env = getEnv();

  try {
    const result = await handleAgentChat(session, parsed.data);
    return withCors(req, NextResponse.json(result));
  } catch (e) {
    return agentChatErrorResponse(req, e, env);
  }
}

export function agentChatErrorResponse(req: NextRequest, e: unknown, env: ReturnType<typeof getEnv>) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "AI_DISABLED") {
    return withCors(req, NextResponse.json({ error: "AI е временно изключен." }, { status: 403 }));
  }
  if (msg === "AI_MISCONFIGURED") {
    return withCors(req, NextResponse.json({ error: "AI не е конфигуриран." }, { status: 503 }));
  }
  if (msg === "AI_DAILY_LIMIT") {
    const limit = env.AI_AGENT_DAILY_REQUESTS_PER_USER ?? 50;
    return withCors(
      req,
      NextResponse.json({ error: `Достигнахте дневния лимит от ${limit} AI заявки.` }, { status: 429 }),
    );
  }
  if (msg === "AI_CONVERSATION_LIMIT") {
    const limit = env.AI_AGENT_MAX_MESSAGES_PER_CONVERSATION ?? 100;
    return withCors(
      req,
      NextResponse.json({ error: `Разговорът достигна лимита от ${limit} съобщения.` }, { status: 400 }),
    );
  }
  if (msg.includes("отменена")) {
    return withCors(req, NextResponse.json({ error: msg }, { status: 499 }));
  }
  return withCors(req, NextResponse.json({ error: msg || "AI грешка." }, { status: 502 }));
}
