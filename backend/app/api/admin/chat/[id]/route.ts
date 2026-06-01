import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { adminSessionIfChatOperator } from "@/lib/admin/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/chat/[id] — full chat with messages */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await adminSessionIfChatOperator();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = session.db;

  const { data: chat, error } = await supabase
    .from("live_chats")
    .select("id, visitor_name, visitor_email, visitor_phone, status, ai_context, admin_notes, created_at, last_message_at, closed_at, visitor_page_url, csat_rating, csat_comment")
    .eq("id", id)
    .maybeSingle();

  if (error || !chat) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { data: messages } = await supabase
    .from("live_chat_messages")
    .select("id, sender_role, content, created_at, metadata")
    .eq("chat_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ chat, messages: messages ?? [] });
}

const PatchSchema = z.object({
  status: z.enum(["waiting", "active", "closed"]).optional(),
  admin_notes: z.string().max(2000).optional(),
});

/** PATCH /api/admin/chat/[id] — update status / notes */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await adminSessionIfChatOperator();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = session.db;

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "closed") {
    update.closed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("live_chats")
    .update(update)
    .eq("id", id)
    .select("id, status, admin_notes, closed_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "DB_ERROR" }, { status: 500 });
  return NextResponse.json({ chat: data });
}

/** DELETE /api/admin/chat/[id] — изтриване само на приключени чатове */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await adminSessionIfChatOperator();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = session.db;

  const { data: chat, error: fetchErr } = await supabase
    .from("live_chats")
    .select("id, status, visitor_name")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!chat) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (chat.status !== "closed") {
    return NextResponse.json({ error: "Може да се изтриват само приключени чатове." }, { status: 400 });
  }

  const { error: delErr } = await supabase.from("live_chats").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id });
}
