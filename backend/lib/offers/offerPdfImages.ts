import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPANY_INFO } from "@/lib/company/companyInfo";
import { withCloudinaryPdfFormat } from "@/lib/services/cloudinaryService";
import type { OfferItemRow } from "@/lib/offers/offerTypes";

export type OfferItemPdfRow = OfferItemRow & {
  pdf_image_src?: string | null;
};

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 4 * 1024 * 1024;

const PDF_IMAGE_MIMES = new Set(["image/jpeg", "image/png"]);

function resolveAbsoluteOfferImageUrl(url: string | null | undefined): string | null {
  const t = (url ?? "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return withCloudinaryPdfFormat(t);
  if (t.startsWith("//")) return withCloudinaryPdfFormat(`https:${t}`);
  const base = COMPANY_INFO.websiteUrl.replace(/\/$/, "");
  const absolute = t.startsWith("/") ? `${base}${t}` : `${base}/${t}`;
  return withCloudinaryPdfFormat(absolute);
}

function pickMainImageUrl(rows: Array<{ url: string; sort_order?: number | null; is_main?: boolean | null }>): string | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const main = sorted.find((img) => img.is_main)?.url ?? sorted[0]?.url;
  return main?.trim() || null;
}

function detectImageMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    if (!res.body) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BYTES) {
        reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }

    const buffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    let mime = detectImageMime(buffer);
    if (!mime) {
      const headerMime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (headerMime === "image/jpg") mime = "image/jpeg";
      else if (PDF_IMAGE_MIMES.has(headerMime)) mime = headerMime;
    }
    if (!mime || !PDF_IMAGE_MIMES.has(mime)) return null;

    return `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadProductImageUrls(
  db: SupabaseClient,
  productIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (productIds.length === 0) return map;

  const { data, error } = await db
    .from("product_images")
    .select("product_id,url,sort_order,is_main")
    .in("product_id", productIds);
  if (error || !data?.length) return map;

  const byProduct = new Map<string, Array<{ url: string; sort_order?: number | null; is_main?: boolean | null }>>();
  for (const row of data) {
    const pid = row.product_id as string;
    const arr = byProduct.get(pid) ?? [];
    arr.push({
      url: row.url as string,
      sort_order: row.sort_order as number | null,
      is_main: row.is_main as boolean | null,
    });
    byProduct.set(pid, arr);
  }

  for (const [pid, images] of byProduct) {
    const url = pickMainImageUrl(images);
    if (url) map.set(pid, url);
  }
  return map;
}

/** Вгражда снимки като data URL преди react-pdf (надеждно JPEG/PNG). */
export async function enrichOfferItemsForPdf(
  db: SupabaseClient,
  items: OfferItemRow[],
): Promise<OfferItemPdfRow[]> {
  const missingProductIds = [
    ...new Set(
      items
        .filter((item) => !(item.image_url ?? "").trim() && item.product_id)
        .map((item) => item.product_id as string),
    ),
  ];
  const imageUrlByProductId = await loadProductImageUrls(db, missingProductIds);
  const dataUrlCache = new Map<string, string | null>();

  return Promise.all(
    items.map(async (item) => {
      const raw =
        (item.image_url ?? "").trim() ||
        (item.product_id ? imageUrlByProductId.get(item.product_id) ?? "" : "");
      const fetchUrl = resolveAbsoluteOfferImageUrl(raw);
      if (!fetchUrl) return { ...item, pdf_image_src: null };

      if (dataUrlCache.has(fetchUrl)) {
        return { ...item, pdf_image_src: dataUrlCache.get(fetchUrl) ?? null };
      }

      const dataUrl = await fetchImageDataUrl(fetchUrl);
      dataUrlCache.set(fetchUrl, dataUrl);
      return { ...item, pdf_image_src: dataUrl };
    }),
  );
}
