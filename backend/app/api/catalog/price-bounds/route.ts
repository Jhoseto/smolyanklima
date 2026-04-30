import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";

const QuerySchema = z.object({
  cond: z.enum(["new", "used"]).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));

  const { cond } = parsed.data;
  const supabase = createSupabaseServiceRoleClient();
  const run = (withCondition: boolean) =>
    Promise.all([
      (withCondition && cond
        ? supabase.from("products").select("price").eq("is_active", true).eq("product_condition", cond)
        : supabase.from("products").select("price").eq("is_active", true))
        .order("price", { ascending: true })
        .limit(1),
      (withCondition && cond
        ? supabase.from("products").select("price").eq("is_active", true).eq("product_condition", cond)
        : supabase.from("products").select("price").eq("is_active", true))
        .order("price", { ascending: false })
        .limit(1),
    ]);

  let [asc, desc] = await run(true);
  const missingConditionColumn =
    cond &&
    ((asc.error &&
      (String((asc.error as any).code ?? "") === "42703" ||
        String((asc.error as any).message ?? "").includes("product_condition"))) ||
      (desc.error &&
        (String((desc.error as any).code ?? "") === "42703" ||
          String((desc.error as any).message ?? "").includes("product_condition"))));
  if (missingConditionColumn) {
    [asc, desc] = await run(false);
  }
  if (asc.error) return withCors(req, NextResponse.json({ error: asc.error.message }, { status: 500 }));
  if (desc.error) return withCors(req, NextResponse.json({ error: desc.error.message }, { status: 500 }));
  const min = Number(asc.data?.[0]?.price ?? 0);
  const max = Number(desc.data?.[0]?.price ?? 0);
  return withCors(req, NextResponse.json({ min, max }));
}
