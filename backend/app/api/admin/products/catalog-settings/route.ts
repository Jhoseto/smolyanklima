import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const PutSchema = z.object({
  defaultMountNewEur: z.number().nonnegative(),
  defaultMountUsedEur: z.number().nonnegative(),
});

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff", "service_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const { data, error } = await session.db
    .from("product_catalog_settings")
    .select("default_mount_new_eur,default_mount_used_eur,updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  const row = data as {
    default_mount_new_eur?: number | null;
    default_mount_used_eur?: number | null;
    updated_at?: string | null;
  } | null;

  return withCors(
    req,
    NextResponse.json({
      data: {
        defaultMountNewEur: row?.default_mount_new_eur ?? null,
        defaultMountUsedEur: row?.default_mount_used_eur ?? null,
        updatedAt: row?.updated_at ?? null,
      },
    }),
  );
}

export async function PUT(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin");
  } catch {
    return withCors(req, NextResponse.json({ error: "Само главен администратор може да променя тези настройки." }, { status: 403 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  const { defaultMountNewEur, defaultMountUsedEur } = parsed.data;

  const { error: upErr } = await session.db
    .from("product_catalog_settings")
    .upsert(
      {
        id: 1,
        default_mount_new_eur: defaultMountNewEur,
        default_mount_used_eur: defaultMountUsedEur,
      },
      { onConflict: "id" },
    );

  if (upErr) return withCors(req, NextResponse.json({ error: upErr.message }, { status: 500 }));

  await logAdminActivity({
    action: "product_catalog.settings_update",
    entityType: "product_catalog_settings",
    entityId: null,
    details: {
      defaultMountNewEur,
      defaultMountUsedEur,
    },
  });

  return withCors(
    req,
    NextResponse.json({
      data: {
        defaultMountNewEur,
        defaultMountUsedEur,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
}
