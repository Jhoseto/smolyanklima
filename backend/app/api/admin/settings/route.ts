import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const UpsertSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.string().max(5000).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = await adminDb();
  const { data, error } = await supabase.from("settings").select("key,value,description,updated_at").order("key", { ascending: true });
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [] }));
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = UpsertSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("settings")
    .upsert(
      {
        key: parsed.data.key,
        value: parsed.data.value ?? null,
        description: parsed.data.description ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    )
    .select("key,value,description,updated_at")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}

