import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { fetchNewInquiriesCount } from "@/lib/admin/inquiries-new-count";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** GET /api/admin/inquiries/count — само брой нови запитвания (леко за nav badge). */
export async function GET(req: NextRequest) {
  try {
    const supabase = await adminDb();
    const newCount = await fetchNewInquiriesCount(supabase);
    return withCors(req, NextResponse.json({ newCount }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Грешка";
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
