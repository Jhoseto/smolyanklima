import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get("x-chat-session-token");
  if (!token) return withCors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));

  const supabase = createSupabaseServiceRoleClient();

  const { data: chat } = await supabase
    .from("live_chats")
    .select("id, session_token, status")
    .eq("id", id)
    .maybeSingle();

  if (!chat || chat.session_token !== token || chat.status === "closed") {
    return withCors(req, NextResponse.json({ error: "Not Found" }, { status: 404 }));
  }

  await supabase
    .from("live_chats")
    .update({ user_typing_at: new Date().toISOString() })
    .eq("id", id);

  return withCors(req, NextResponse.json({ ok: true }));
}
