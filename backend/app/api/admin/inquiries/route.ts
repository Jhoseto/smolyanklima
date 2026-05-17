import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import {
  INQUIRY_ADMIN_SELECT,
  INQUIRY_ADMIN_SELECT_BASE,
  type InquiryAdminRow,
  withDefaultIncludeInstallation,
} from "@/lib/inquiry/inquiryAdminSelect";
import { attachProductsToInquiries } from "@/lib/inquiry/inquiryProducts";

const QuerySchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const supabase = await adminDb();
  const { page, perPage } = parsed.data;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const runListQuery = (selectFields: string) => {
    let query = supabase.from("inquiries").select(selectFields, { count: "exact" });
    if (parsed.data.status) query = query.eq("status", parsed.data.status);
    if (parsed.data.source) query = query.eq("source", parsed.data.source);
    if (parsed.data.q) {
      const q = parsed.data.q.trim();
      if (q) {
        query = query.or(
          [
            `customer_name.ilike.%${q}%`,
            `customer_phone.ilike.%${q}%`,
            `customer_email.ilike.%${q}%`,
            `message.ilike.%${q}%`,
          ].join(","),
        );
      }
    }
    return query.order("created_at", { ascending: false }).range(from, to);
  };

  let { data, error, count } = await runListQuery(INQUIRY_ADMIN_SELECT);
  if (error && isPostgrestMissingColumn(error, "include_installation")) {
    ({ data, error, count } = await runListQuery(INQUIRY_ADMIN_SELECT_BASE));
  }

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  const rows = withDefaultIncludeInstallation((data ?? []) as unknown as InquiryAdminRow[]);

  let enriched: Awaited<ReturnType<typeof attachProductsToInquiries>>;
  try {
    enriched = await attachProductsToInquiries(supabase, rows);
  } catch (attachErr: unknown) {
    const msg = attachErr instanceof Error ? attachErr.message : String(attachErr);
    return withCors(
      req,
      NextResponse.json({
        data: rows.map((row) => ({ ...row, products: [] })),
        meta: { page, perPage, total: count ?? 0 },
        warning: `Продуктите по запитвания не се заредиха: ${msg}`,
      }),
    );
  }

  return withCors(
    req,
    NextResponse.json({
      data: enriched,
      meta: { page, perPage, total: count ?? 0 },
    }),
  );
}

