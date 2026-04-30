import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  const supabase = createSupabaseServiceRoleClient();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return withCors(req, NextResponse.json({ error: "Липсва файл" }, { status: 400 }));
  }

  const bucket = env.BLOG_IMAGES_BUCKET ?? "blog-images";
  const ext = guessExtension(file.type) ?? "bin";
  const safeName = (file.name || "image").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
  const key = `articles/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName}.${ext}`.replace(/\.([a-z0-9]+)\.([a-z0-9]+)$/i, ".$2");

  const { error: uploadError } = await supabase.storage.from(bucket).upload(key, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    return withCors(req, NextResponse.json({ error: uploadError.message }, { status: 500 }));
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return withCors(req, NextResponse.json({ data: { url: data.publicUrl, path: key } }, { status: 201 }));
}

function guessExtension(mime: string) {
  if (!mime) return null;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return null;
}

