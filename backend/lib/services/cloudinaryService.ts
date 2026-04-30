import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary — сервизен модул.
 * CLOUDINARY_URL или CLOUDINARY_CLOUD_NAME + API_KEY + API_SECRET.
 * Оптимизация за web: f_auto + q_auto в delivery URL.
 */

const CLOUDINARY_UPLOAD_MARKER = "/image/upload/";

/** Редът на трансформациите след upload/ — формат + качество (препоръка Cloudinary). */
const WEB_AUTO_TRANSFORM = "f_auto,q_auto";

export type CloudinaryUploadKind = "product" | "accessory" | "blog";

export type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

/** Конзолата понякога показва placeholder `<...>`; не са част от ключа/secret. */
function stripPlaceholderBrackets(segment: string): string {
  const t = segment.trim();
  if (t.length >= 2 && t.startsWith("<") && t.endsWith(">")) return t.slice(1, -1).trim();
  return t;
}

function parseCloudinaryUrl(raw: string): CloudinaryCredentials | null {
  const u = raw.trim();
  const m = u.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/i);
  if (!m) return null;
  return {
    apiKey: stripPlaceholderBrackets(decodeURIComponent(m[1])),
    apiSecret: stripPlaceholderBrackets(decodeURIComponent(m[2])),
    cloudName: stripPlaceholderBrackets(decodeURIComponent(m[3])),
  };
}

/** Чете само Cloudinary-related env (без да изисква целия app getEnv). */
export function getCloudinaryCredentials(): CloudinaryCredentials | null {
  const urlRaw = process.env.CLOUDINARY_URL?.trim();
  const fromUrl = urlRaw ? parseCloudinaryUrl(urlRaw) : null;
  if (fromUrl?.cloudName && fromUrl.apiKey && fromUrl.apiSecret) return fromUrl;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
  return null;
}

export function isCloudinaryConfigured(): boolean {
  return getCloudinaryCredentials() != null;
}

let sdkConfigured = false;

function ensureSdkConfigured(): CloudinaryCredentials {
  const c = getCloudinaryCredentials();
  if (!c) throw new Error("CLOUDINARY_NOT_CONFIGURED");
  if (!sdkConfigured) {
    cloudinary.config({
      cloud_name: c.cloudName,
      api_key: c.apiKey,
      api_secret: c.apiSecret,
      secure: true,
    });
    sdkConfigured = true;
  }
  return c;
}

/** Сегмент за път в Cloudinary folder: само a-z 0-9 тире, до 80 символа. */
export function sanitizeMediaFolderSlug(raw: string): string {
  const s = (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return s || "item";
}

/** Пълен folder за upload според вида медия (климатици / аксесоари / блог). */
export function buildUploadFolderPath(kind: CloudinaryUploadKind, slugSanitized: string): string {
  const segment = kind === "product" ? "klimatici" : kind === "accessory" ? "aksesoari" : "blog";
  return `smolyanklima/${segment}/${slugSanitized}`;
}

/**
 * Вмъква автоматични трансформации за доставка (f_auto, q_auto) в Cloudinary image URL.
 * Не променя външни URL-и и не дублира, ако вече има f_auto + q_auto.
 */
export function withCloudinaryWebOptimization(url: string | null | undefined): string {
  if (url == null || url === "") return url ?? "";
  if (!url.includes("res.cloudinary.com")) return url;
  const lower = url.toLowerCase();
  if (!lower.includes(CLOUDINARY_UPLOAD_MARKER)) return url;
  if (/\/f_auto,q_auto\//i.test(url) || /\/q_auto,f_auto\//i.test(url)) return url;

  const idx = url.indexOf(CLOUDINARY_UPLOAD_MARKER);
  const prefix = url.slice(0, idx + CLOUDINARY_UPLOAD_MARKER.length);
  const rest = url.slice(idx + CLOUDINARY_UPLOAD_MARKER.length);
  return `${prefix}${WEB_AUTO_TRANSFORM}/${rest}`;
}

export function optimizeImageRowUrls<T extends { url: string }>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).map((row) => ({ ...row, url: withCloudinaryWebOptimization(row.url) }));
}

/** Публични статии: оптимизира featured_image, seo.ogImage, images[], schema.image[]. */
export function optimizeArticlePayloadForWeb<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  if (typeof out.featured_image === "string" && out.featured_image) {
    out.featured_image = withCloudinaryWebOptimization(out.featured_image);
  }
  if (out.seo && typeof out.seo === "object") {
    const seo = { ...(out.seo as Record<string, unknown>) };
    if (typeof seo.ogImage === "string" && seo.ogImage) {
      seo.ogImage = withCloudinaryWebOptimization(seo.ogImage);
    }
    out.seo = seo;
  }
  if (Array.isArray(out.images)) {
    out.images = out.images.map((u) => (typeof u === "string" ? withCloudinaryWebOptimization(u) : u));
  }
  if (out.schema && typeof out.schema === "object") {
    const schema = { ...(out.schema as Record<string, unknown>) };
    if (Array.isArray(schema.image)) {
      schema.image = schema.image.map((u) => (typeof u === "string" ? withCloudinaryWebOptimization(u) : u));
    }
    out.schema = schema;
  }
  return out as T;
}

/** Четимо съобщение от Cloudinary / мрежова грешка (за JSON към админ UI). */
export function formatCloudinaryUploadError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null) {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message) return o.message;
    const nested = o.error;
    if (typeof nested === "object" && nested !== null) {
      const m = (nested as { message?: string }).message;
      if (typeof m === "string" && m) return m;
    }
  }
  return "Качването се провали";
}

/**
 * Качва байтове в Cloudinary под зададен folder (stream — без огромен data URI за големи файлове).
 * В Postgres се пази само secure_url.
 */
export async function uploadImageBuffer(opts: {
  buffer: Buffer;
  mimeType: string;
  /** Пълен folder, напр. smolyanklima/klimatici/daikin-perfera-25 */
  folderPath: string;
}): Promise<{ url: string; publicId: string }> {
  if (!opts.buffer?.length) {
    throw new Error("Файлът е празен");
  }
  ensureSdkConfigured();

  return await new Promise((resolve, reject) => {
    // Cloudinary Node v2 adapter: upload_stream(options, callback) → вътрешно се подава (cb, opts) към v1 upload.
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folderPath,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (err: Error | undefined, result?: { secure_url?: string; public_id?: string }) => {
        if (err) {
          reject(err);
          return;
        }
        if (!result?.secure_url) {
          reject(new Error("Cloudinary върна празен отговор"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id ?? "" });
      },
    );

    Readable.from(opts.buffer)
      .on("error", reject)
      .pipe(uploadStream)
      .on("error", reject);
  });
}
