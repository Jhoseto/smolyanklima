import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/chat/[id] — full chat with messages */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await adminDb().catch(() => null);
  if (!supabase) return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });

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
  const supabase = await adminDb().catch(() => null);
  if (!supabase) return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });

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
