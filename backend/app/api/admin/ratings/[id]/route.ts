import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { logAdminActivity } from "@/lib/admin/audit";
import { authErrorResponse, requireMasterAdminSession } from "@/lib/admin/authGuard";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireMasterAdminSession();
  } catch (e) {
    const err = authErrorResponse(e);
    return withCors(req, NextResponse.json({ error: err.message }, { status: err.status }));
  }
  const { id } = await ctx.params;
  const supabase = session.db;
  const { error } = await supabase.from("product_ratings").delete().eq("id", id);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  await logAdminActivity({
    action: "rating.delete",
    entityType: "product_rating",
    entityId: id,
  });
  return withCors(req, NextResponse.json({ ok: true }));
}
