/**
 * Клиентска компресия на снимка (от <input type="file" capture>).
 *
 * Цел:
 *  - Намаля upload времето и трафика през 4G мрежи в склада.
 *  - Запази достатъчно резолюция за AI vision (Gemini 2.5 Flash чете
 *    текст добре при ~1500-2000 px по дългата страна).
 *
 * Връща обект с готов base64 (без `data:…;base64,` префикса) — точно
 * това, което Gemini API очаква в `inlineData.data`.
 */

export type CompressedImage = {
  base64: string;
  mimeType: "image/jpeg" | "image/webp";
  width: number;
  height: number;
  /** Размер на base64 низа (брой характери ≈ байтове в JSON payload). */
  base64Bytes: number;
};

export type CompressOptions = {
  /** Максимална дължина по дългата страна на изображението. По default 2048 px. */
  maxLongEdge?: number;
  /** JPEG/WebP качество 0..1. По default 0.85. */
  quality?: number;
  /** Изходен формат. WebP е по-малък, но JPEG е универсално съвместим. */
  output?: "jpeg" | "webp";
};

const DEFAULT_MAX_LONG_EDGE = 2048;
const DEFAULT_QUALITY = 0.85;

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<CompressedImage> {
  const maxLongEdge = opts.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE;
  const quality = opts.quality ?? DEFAULT_QUALITY;
  const outputFormat = opts.output ?? "jpeg";
  const mimeType = outputFormat === "webp" ? "image/webp" : "image/jpeg";

  const bitmap = await loadBitmap(file);
  const { width, height } = scaleToLongEdge(bitmap.width, bitmap.height, maxLongEdge);

  // OffscreenCanvas където е достъпен → не блокира main thread.
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Браузърът не поддържа 2D canvas.");
  }
  // White background — JPEG няма прозрачност, така че черен PNG → чист бял JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvasToBlob(canvas, mimeType, quality);
  const base64 = await blobToBase64(blob);
  return {
    base64,
    mimeType,
    width,
    height,
    base64Bytes: base64.length,
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap respect-ва EXIF orientation от модерни браузъри.
  return await createImageBitmap(file, { imageOrientation: "from-image" });
}

function scaleToLongEdge(srcW: number, srcH: number, maxEdge: number) {
  const longEdge = Math.max(srcW, srcH);
  if (longEdge <= maxEdge) return { width: srcW, height: srcH };
  const ratio = maxEdge / longEdge;
  return {
    width: Math.round(srcW * ratio),
    height: Math.round(srcH * ratio),
  };
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

async function canvasToBlob(canvas: AnyCanvas, mimeType: string, quality: number): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return await canvas.convertToBlob({ type: mimeType, quality });
  }
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Конверсията на canvas → blob се провали."))),
      mimeType,
      quality,
    );
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Chunk encoding — избягва call-stack overflow при големи масиви.
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}
