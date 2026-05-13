import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { findPrimaryPhoneConflict } from "@/lib/admin/contactPhoneDuplicate";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/**
 * GET /api/admin/contacts/phone-conflict?phone=...&excludeContactId=...
 * Префлайт за UI: има ли вече контакт със същия основен телефон.
 */
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone")?.trim() ?? "";
  const excludeContactId = req.nextUrl.searchParams.get("excludeContactId")?.trim() || null;
  if (phone.length < 3) {
    return withCors(req, NextResponse.json({ error: "Телефонът трябва да е поне 3 символа." }, { status: 400 }));
  }
  const supabase = await adminDb();
  const conflict = await findPrimaryPhoneConflict(supabase, phone, excludeContactId);
  if (!conflict) {
    return withCors(req, NextResponse.json({ data: { conflict: false as const } }));
  }
  return withCors(
    req,
    NextResponse.json({
      data: {
        conflict: true as const,
        contact: { id: conflict.id, fullName: conflict.full_name, phone: conflict.phone },
      },
    }),
  );
}
