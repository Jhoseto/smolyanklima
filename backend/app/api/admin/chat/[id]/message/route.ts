import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";

type Params = { params: Promise<{ id: string }> };

const MsgSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
  metadata: z.object({
    type: z.string(),
    product: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      image_url: z.string().nullable().optional(),
      price_from: z.number().nullable().optional(),
      brand_name: z.string().nullable().optional(),
    }).optional(),
  }).optional(),
});

/** POST /api/admin/chat/[id]/message — admin sends a message (text or product card) */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await adminDb().catch(() => null);
  if (!supabase) return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = MsgSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const { data: chat } = await supabase
    .from("live_chats")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!chat) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (chat.status === "closed") return NextResponse.json({ error: "CHAT_CLOSED" }, { status: 409 });

  const { data: msg, error } = await supabase
    .from("live_chat_messages")
    .insert({
      chat_id: id,
      sender_role: "admin",
      content: parsed.data.content,
      metadata: parsed.data.metadata ?? null,
    })
    .select("id, sender_role, content, created_at, metadata")
    .single();

  if (error || !msg) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });

  if (chat.status === "waiting") {
    await supabase.from("live_chats").update({ status: "active", last_message_at: new Date().toISOString() }).eq("id", id);
  } else {
    await supabase.from("live_chats").update({ last_message_at: new Date().toISOString() }).eq("id", id);
  }

  return NextResponse.json({ message: msg });
}
