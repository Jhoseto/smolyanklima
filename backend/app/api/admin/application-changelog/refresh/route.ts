import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import {
  bootstrapMainBatch,
  getChangelogCount,
  refreshNewFromMain,
} from "@/lib/admin/applicationChangelog/ingestCommit";
import { GithubRateLimitError } from "@/lib/admin/applicationChangelog/githubClient";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  mode: z.enum(["auto", "bootstrap", "incremental"]).optional().default("auto"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  try {
    const session = await adminSession();
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  let body: z.infer<typeof BodySchema> = { page: 1, mode: "auto" };
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (parsed.success) body = parsed.data;
  } catch {
    /* empty body ok */
  }

  try {
    const count = await getChangelogCount();
    const useBootstrap =
      body.mode === "bootstrap" || (body.mode === "auto" && count === 0);

    if (useBootstrap) {
      const result = await bootstrapMainBatch(body.page);
      return withCors(
        req,
        NextResponse.json({
          ok: true,
          mode: "bootstrap" as const,
          ...result,
          nextPage: result.page,
        }),
      );
    }

    const result = await refreshNewFromMain();
    return withCors(
      req,
      NextResponse.json({
        ok: true,
        mode: "incremental" as const,
        ...result,
      }),
    );
  } catch (e) {
    if (e instanceof GithubRateLimitError) {
      return withCors(
        req,
        NextResponse.json(
          { error: e.message, retryAfterMs: e.retryAfterMs, rateLimited: true },
          { status: 429 },
        ),
      );
    }
    const msg = e instanceof Error ? e.message : "Refresh failed";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}
