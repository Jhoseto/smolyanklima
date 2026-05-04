import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const StartSchema = z.object({
  visitor_name: z.string().min(1).max(120).trim(),
  visitor_email: z.string().email().max(254).optional().or(z.literal("")),
  visitor_phone: z.string().max(30).optional(),
  visitor_page_url: z.string().url().max(500).optional(),
  ai_context: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(20)
    .optional(),
});

function greetingText(name: string): string {
  return `Здравейте, ${name}! Добре дошли в чата на Смолян Клима. С какво можем да ви бъдем полезни ? 🙂`;
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = StartSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 }));
  }

  const { visitor_name, visitor_email, visitor_phone, visitor_page_url, ai_context } = parsed.data;
  const supabase = createSupabaseServiceRoleClient();
  const email = visitor_email || null;

  // Email is contact information only. Resuming by email alone would disclose
  // an existing visitor bearer token to anyone who knows that address.
  const { data: chat, error } = await supabase
    .from("live_chats")
    .insert({
      visitor_name,
      visitor_email: email,
      visitor_phone: visitor_phone || null,
      ai_context: ai_context ?? null,
      status: "waiting",
      last_message_at: new Date().toISOString(),
      visitor_page_url: visitor_page_url ?? null,
    })
    .select("id, session_token, visitor_name, status")
    .single();

  if (error || !chat) {
    return withCors(req, NextResponse.json({ error: "DB_ERROR" }, { status: 500 }));
  }

  // Greeting
  await supabase.from("live_chat_messages").insert({
    chat_id: chat.id,
    sender_role: "system",
    content: greetingText(visitor_name),
  });

  // AI контекст
  if (ai_context && ai_context.length > 0) {
    await supabase.from("live_chat_messages").insert({
      chat_id: chat.id,
      sender_role: "system",
      content: `— Прехвърлен от AI асистент. Контекст от разговора (${ai_context.length} съобщения) —`,
    });
  }

  return withCors(req, NextResponse.json({
    chatId: chat.id,
    sessionToken: chat.session_token,
    visitorName: chat.visitor_name,
    status: chat.status,
    resumed: false,
    hadHistory: false,
  }));
}
