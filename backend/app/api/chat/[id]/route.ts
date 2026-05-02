import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

function getSessionToken(req: NextRequest): string | null {
  return req.headers.get("x-chat-session-token");
}

async function resolveChat(chatId: string, sessionToken: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("live_chats")
    .select("id, session_token, visitor_name, visitor_email, status, created_at, last_message_at")
    .eq("id", chatId)
    .maybeSingle();
  if (error || !data) return { chat: null, supabase };
  if (data.session_token !== sessionToken) return { chat: null, supabase };
  return { chat: data, supabase };
}

/** GET /api/chat/[id] — get chat + messages */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = getSessionToken(req);
  if (!token) return withCors(req, NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }));

  const { chat, supabase } = await resolveChat(id, token);
  if (!chat) return withCors(req, NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }));

  const { data: messages } = await supabase
    .from("live_chat_messages")
    .select("id, sender_role, content, created_at, metadata")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  return withCors(req, NextResponse.json({ chat, messages: messages ?? [] }));
}

const SendSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
});

/** POST /api/chat/[id] — visitor sends message */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = getSessionToken(req);
  if (!token) return withCors(req, NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }));

  const { chat, supabase } = await resolveChat(id, token);
  if (!chat) return withCors(req, NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }));
  if (chat.status === "closed") {
    return withCors(req, NextResponse.json({ error: "CHAT_CLOSED" }, { status: 409 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = SendSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }));

  const { data: msg, error } = await supabase
    .from("live_chat_messages")
    .insert({ chat_id: id, sender_role: "user", content: parsed.data.content })
    .select("id, sender_role, content, created_at")
    .single();

  if (error || !msg) return withCors(req, NextResponse.json({ error: "DB_ERROR" }, { status: 500 }));

  // Bump last_message_at + set to active if was waiting
  await supabase
    .from("live_chats")
    .update({
      last_message_at: new Date().toISOString(),
      ...(chat.status === "waiting" ? { status: "waiting" } : {}),
    })
    .eq("id", id);

  return withCors(req, NextResponse.json({ message: msg }));
}

const PatchSchema = z.object({
  status: z.enum(["closed"]).optional(),
  csat_rating: z.number().int().min(1).max(5).optional(),
  csat_comment: z.string().max(500).optional(),
});

/** PATCH /api/chat/[id] — visitor closes chat or submits CSAT */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = getSessionToken(req);
  if (!token) return withCors(req, NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }));

  const { chat, supabase } = await resolveChat(id, token);
  if (!chat) return withCors(req, NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }));

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }));

  const update: Record<string, unknown> = {};
  if (parsed.data.status === "closed") {
    update.status = "closed";
    update.closed_at = new Date().toISOString();
  }
  if (parsed.data.csat_rating !== undefined) update.csat_rating = parsed.data.csat_rating;
  if (parsed.data.csat_comment !== undefined) update.csat_comment = parsed.data.csat_comment;

  if (Object.keys(update).length === 0) {
    return withCors(req, NextResponse.json({ ok: true }));
  }

  await supabase.from("live_chats").update(update).eq("id", id);
  return withCors(req, NextResponse.json({ ok: true }));
}
