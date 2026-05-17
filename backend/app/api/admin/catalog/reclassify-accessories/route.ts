import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { reclassifyMisplacedProductsToAccessories } from "@/lib/import/bulclima/reclassifyMisplacedToAccessories";

export const maxDuration = 120;

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(
      req,
      NextResponse.json({ error: "Само офис персонал може да премества продукти в аксесоари." }, { status: 403 }),
    );
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const supabase = createSupabaseServiceRoleClient();

  try {
    const summary = await reclassifyMisplacedProductsToAccessories(supabase, { dryRun });

    if (!dryRun) {
      await logAdminActivity({
        action: "catalog.reclassify_accessories",
        entityType: "products",
        entityId: null,
        details: summary,
      });
    }

    return withCors(req, NextResponse.json({ data: summary }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
