import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { logAdminActivity } from "@/lib/admin/audit";
import {
  buildUploadFolderPath,
  formatCloudinaryUploadError,
  isCloudinaryConfigured,
  sanitizeMediaFolderSlug,
  uploadImageBuffer,
  type CloudinaryUploadKind,
} from "@/lib/services/cloudinaryService";

export const dynamic = "force-dynamic";

const KINDS: CloudinaryUploadKind[] = ["product", "accessory", "blog"];

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
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
      NextResponse.json({ error: "Невалиден kind (product | accessory | blog)" }, { status: 400 }),
    );
  }
  const kind = kindRaw as CloudinaryUploadKind;
  if (slugRaw.length < 2) {
    return withCors(req, NextResponse.json({ error: "Липсва или е твърде кратък slug за папката в Cloudinary" }, { status: 400 }));
  }

  const safe = sanitizeMediaFolderSlug(slugRaw);
  const folderBase = buildUploadFolderPath(kind, safe);

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/")) {
    return withCors(req, NextResponse.json({ error: "Файлът трябва да е изображение" }, { status: 400 }));
  }

  try {
    const { url, publicId } = await uploadImageBuffer({
      buffer: buf,
      mimeType: mime,
      folderPath: folderBase,
    });
    await logAdminActivity({
      action: "media.upload",
      entityType: "media",
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
