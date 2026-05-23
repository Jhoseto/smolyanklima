import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { logAdminActivity } from "@/lib/admin/audit";
import { adminSession, requireRole } from "@/lib/admin/db";
import { detectImageMime } from "@/lib/security/imageMagicBytes";
import {
  buildUploadFolderPath,
  formatCloudinaryUploadError,
  isCloudinaryConfigured,
  sanitizeMediaFolderSlug,
  uploadImageBuffer,
  type CloudinaryUploadKind,
} from "@/lib/services/cloudinaryService";

export const dynamic = "force-dynamic";

const KINDS: CloudinaryUploadKind[] = ["product", "accessory", "blog", "staff"];

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  if (!isCloudinaryConfigured()) {
    return withCors(
      req,
      NextResponse.json(
        {
          error:
            "Cloudinary не е конфигуриран. Добави CLOUDINARY_URL в .env.local (виж .env.example).",
        },
        { status: 503 },
      ),
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return withCors(req, NextResponse.json({ error: "Липсва файл" }, { status: 400 }));
  }

  const kindRaw = String(form?.get("kind") ?? "").trim();
  const slugRaw = String(form?.get("slug") ?? "").trim();
  if (!KINDS.includes(kindRaw as (typeof KINDS)[number])) {
    return withCors(
      req,
      NextResponse.json({ error: "Невалиден kind (product | accessory | blog | staff)" }, { status: 400 }),
    );
  }
  const kind = kindRaw as CloudinaryUploadKind;

  if (kind === "staff") {
    const idParse = z.string().uuid().safeParse(slugRaw);
    if (!idParse.success) {
      return withCors(req, NextResponse.json({ error: "Невалиден служител (UUID)" }, { status: 400 }));
    }
    const isSelfAvatar = slugRaw === session.userId;
    if (!isSelfAvatar) {
      try {
        requireRole(session, "master_admin");
      } catch {
        return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
      }
    }
    const { data: exists, error: exErr } = await session.db
      .from("admin_users")
      .select("id")
      .eq("id", slugRaw)
      .maybeSingle();
    if (exErr) return withCors(req, NextResponse.json({ error: exErr.message }, { status: 500 }));
    if (!exists) {
      return withCors(req, NextResponse.json({ error: "Служителят не е намерен" }, { status: 404 }));
    }
  }

  if (slugRaw.length < 2) {
    return withCors(req, NextResponse.json({ error: "Липсва или е твърде кратък slug за папката в Cloudinary" }, { status: 400 }));
  }

  const safe = sanitizeMediaFolderSlug(slugRaw);
  const folderBase = buildUploadFolderPath(kind, safe);

  const buf = Buffer.from(await file.arrayBuffer());
  const maxBytes = kind === "staff" ? 6 * 1024 * 1024 : 12 * 1024 * 1024;
  if (buf.length > maxBytes) {
    const mb = maxBytes / (1024 * 1024);
    return withCors(
      req,
      NextResponse.json({ error: `Файлът е прекалено голям (макс. ${mb} MB)` }, { status: 400 }),
    );
  }
  const detectedMime = detectImageMime(buf);
  if (!detectedMime) {
    return withCors(req, NextResponse.json({ error: "Файлът не е валидно изображение" }, { status: 400 }));
  }
  const mime = detectedMime;

  try {
    const { url, publicId } = await uploadImageBuffer({
      buffer: buf,
      mimeType: mime,
      folderPath: folderBase,
    });
    await logAdminActivity({
      action: "media.upload",
      entityType: kind === "staff" ? "admin_user" : "media",
      entityId: kind === "staff" ? slugRaw : undefined,
      details: {
        kind,
        slug: safe,
        folder: folderBase,
        publicId,
        url,
      },
    });
    return withCors(req, NextResponse.json({ data: { url, publicId, folder: folderBase } }, { status: 201 }));
  } catch (e: unknown) {
    const msg = formatCloudinaryUploadError(e);
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}
