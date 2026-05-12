/**
 * Real-time AI enhancement на продуктови снимки.
 *
 * Изпраща локална снимка (Blob или File) към `/api/admin/ai` с task
 * `product_photo_enhance` и получава нова, преобразувана версия (бял
 * фон, soft shadow, lighting normalization).
 *
 * Поведение:
 *  - Винаги real-time (НЕ batch). Очаквай 5-15s response time.
 *  - Snimkite НЕ се пазят персистентно — само за инстантна обработка.
 *  - При успех връща нов Blob с image/png (default от Nano Banana).
 *  - При неуспех хвърля Error с описание (UI може да fallback-не на оригинала).
 *
 * Цена: ~$0.039 на снимка (Gemini 2.5 Flash Image / „Nano Banana“).
 */

const ALLOWED_MIME: Array<"image/jpeg" | "image/png" | "image/webp"> = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export type EnhanceResult = {
  blob: Blob;
  mimeType: string;
  base64: string;
};

/**
 * Чете локален Blob/File и го праща към AI endpoint-а.
 *
 * @param source — снимка от local storage (преди upload) ИЛИ свалена
 *   от Cloudinary (за редактиране на стара качена снимка).
 * @param signal — optional AbortSignal за cancellation от UI.
 */
export async function enhancePhotoViaAI(
  source: Blob | File,
  signal?: AbortSignal,
): Promise<EnhanceResult> {
  if (!source || source.size === 0) {
    throw new Error("Празна снимка — нищо за обработка.");
  }

  // Detect MIME — Cloudinary URL-ите често връщат „image/jpeg“, а локални
  // снимки могат да са png/webp.
  const mimeRaw = (source.type || "image/jpeg").toLowerCase();
  const mime = ALLOWED_MIME.includes(mimeRaw as (typeof ALLOWED_MIME)[number])
    ? (mimeRaw as (typeof ALLOWED_MIME)[number])
    : "image/jpeg";

  const base64 = await blobToBase64NoPrefix(source);

  const res = await fetch("/api/admin/ai", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      task: "product_photo_enhance",
      input: {
        imageBase64: base64,
        imageMimeType: mime,
        style: "auto",
      },
    }),
  });

  const json: {
    data?: { imageBase64?: string; imageMimeType?: string };
    error?: string;
  } = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || `AI грешка (HTTP ${res.status})`);
  }

  const outBase64 = json.data?.imageBase64;
  const outMime = json.data?.imageMimeType || "image/png";
  if (!outBase64) {
    throw new Error("AI не върна изображение.");
  }

  const outBlob = base64ToBlob(outBase64, outMime);
  return { blob: outBlob, mimeType: outMime, base64: outBase64 };
}

/**
 * Сваля Cloudinary (или произволен) image URL и го връща като Blob.
 * Полезен за enhance на ВЕЧЕ качени снимки в edit режим.
 *
 * ВАЖНО: Cloudinary URL-ите са public, така че нямаме нужда от CORS
 * proxy. fetch() от browser работи директно.
 */
export async function fetchImageAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Не успях да сваля снимката (HTTP ${res.status}).`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("Файлът от URL-а не е изображение.");
  }
  return blob;
}

async function blobToBase64NoPrefix(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
