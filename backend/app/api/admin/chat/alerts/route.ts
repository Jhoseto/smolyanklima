import { NextResponse } from "next/server";
import { adminSessionIfChatOperator } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

/** GET /api/admin/chat/alerts — snapshot за звукови известия (нов чат / ново user съобщение). */
export async function GET() {
  const session = await adminSessionIfChatOperator();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = session.db;

  const { data: chats, error: chatErr } = await supabase
    .from("live_chats")
    .select("id, visitor_name, visitor_phone, status, created_at, last_message_at")
    .in("status", ["waiting", "active"]);

  if (chatErr) return NextResponse.json({ error: chatErr.message }, { status: 500 });

  const openChats = chats ?? [];
  const chatIds = openChats.map((c) => c.id as string);
  const waiting = openChats.filter((c) => c.status === "waiting");

  const lastUserByChat = new Map<string, { id: string; created_at: string }>();
  for (const chatId of chatIds) {
    const { data: lastMsg } = await supabase
      .from("live_chat_messages")
      .select("id, created_at")
      .eq("chat_id", chatId)
      .eq("sender_role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastMsg) {
      lastUserByChat.set(chatId, { id: lastMsg.id as string, created_at: lastMsg.created_at as string });
    }
  }

  const userMessages = openChats
    .map((c) => {
      const last = lastUserByChat.get(c.id as string);
      if (!last) return null;
      return {
        chatId: c.id as string,
        visitorName: (c.visitor_name as string) ?? "Посетител",
        visitorPhone: (c.visitor_phone as string | null) ?? null,
        messageId: last.id,
        createdAt: last.created_at,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    waiting: waiting.map((c) => ({
      id: c.id,
      visitorName: c.visitor_name,
      visitorPhone: c.visitor_phone,
      createdAt: c.created_at,
    })),
    userMessages,
  });
}
