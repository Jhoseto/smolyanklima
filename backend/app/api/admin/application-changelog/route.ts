import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { countNeedsAiResummary } from "@/lib/admin/applicationChangelog/ingestCommit";

const QuerySchema = z.object({
  q: z.string().optional(),
  branch: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

  const { q, branch, from, to, page, perPage } = parsed.data;
  const supabase = session.db;

  let query = supabase.from("application_changelog").select("*", { count: "exact" });

  if (q?.trim()) {
    const term = q.trim().replace(/[%_]/g, "");
    query = query.or(
      `title_bg.ilike.%${term}%,summary_bg.ilike.%${term}%,message_original.ilike.%${term}%`,
    );
  }
  if (branch?.trim()) {
    query = query.contains("branches", [branch.trim()]);
  }
  if (from) query = query.gte("committed_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("committed_at", `${to}T23:59:59.999Z`);

  const offset = (page - 1) * perPage;
  const { data, error, count } = await query
    .order("committed_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const { count: failedCount } = await supabase
    .from("application_changelog")
    .select("*", { count: "exact", head: true })
    .eq("sync_status", "failed");

  const needsAiCount = await countNeedsAiResummary();

  return withCors(
    req,
    NextResponse.json({
      data: data ?? [],
      meta: { page, perPage, total: count ?? 0, failedCount: failedCount ?? 0, needsAiCount },
    }),
  );
}
