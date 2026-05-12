import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = await adminDb();
  const { data, error } = await supabase.from("brands").select("id,name").order("name");
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [] }));
}

const CreateBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Името е твърде късо")
    .max(80, "Името е твърде дълго")
    // Поне една буква/цифра — пресекаме „—“, „---“ и подобни.
    .refine((s) => /[A-Za-zА-Яа-я0-9]/.test(s), "Името трябва да съдържа буква или цифра"),
});

/**
 * Създава нова марка ИЛИ връща съществуваща, ако вече има такава с
 * същото име (case-insensitive). Това е safe-by-default: дори ако
 * клиентът натисне два пъти бутона „+ Създай“, второто извикване ще
 * върне същия `id` (без race condition / дубликат).
 *
 * Защитена е от RLS (admin client). Запазва се запис в audit log само
 * при реално създаване.
 */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = CreateBrandSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(
      req,
      NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "INVALID_REQUEST" },
        { status: 400 },
      ),
    );
  }

  const name = parsed.data.name;
  const supabase = await adminDb();

  // 1. Случай „вече съществува“ → idempotent: връщаме съществуващия id.
  //    ilike() за case-insensitive match (PostgreSQL).
  const { data: existing, error: lookupErr } = await supabase
    .from("brands")
    .select("id,name")
    .ilike("name", name)
    .maybeSingle();
  if (lookupErr) {
    return withCors(req, NextResponse.json({ error: lookupErr.message }, { status: 500 }));
  }
  if (existing) {
    return withCors(req, NextResponse.json({ data: existing, created: false }));
  }

  // 2. Реално създаване.
  const { data: inserted, error: insertErr } = await supabase
    .from("brands")
    .insert({ name })
    .select("id,name")
    .single();
  if (insertErr) {
    // 23505 = UNIQUE constraint — възможно е друг клиент паралелно да го е
    // създал точно между нашия SELECT и INSERT. Re-fetch-ваме и връщаме.
    if (insertErr.code === "23505") {
      const { data: retry } = await supabase
        .from("brands")
        .select("id,name")
        .ilike("name", name)
        .maybeSingle();
      if (retry) {
        return withCors(req, NextResponse.json({ data: retry, created: false }));
      }
    }
    return withCors(req, NextResponse.json({ error: insertErr.message }, { status: 500 }));
  }

  await logAdminActivity({
    action: "brand.create",
    entityType: "brand",
    entityId: inserted.id,
    details: { name: inserted.name },
  });

  return withCors(req, NextResponse.json({ data: inserted, created: true }));
}

