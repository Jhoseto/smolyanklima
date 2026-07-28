import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { PublicOfferShare } from "@/lib/offers/publicOfferShare";
import { OfferOgImageJsx, OFFER_OG_SIZE } from "@/lib/offers/offerOgImage";
import { PwaIconJsx } from "@/lib/pwa-icon";

const FETCH_TIMEOUT_MS = 5000;

/** Viber изисква HTTPS изображение с Content-Length (без chunked transfer). */
export async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64 || buf.length > 4_000_000) return null;
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function resolveOfferProductImage(offer: PublicOfferShare): Promise<string | null> {
  const url = offer.items.find((it) => it.image_url)?.image_url ?? null;
  if (!url) return null;
  return fetchImageDataUri(url);
}

/** JPEG 1200×630 — по-малък от PNG, по-надежден в Viber/WhatsApp. */
export async function renderOfferOgJpeg(offer: PublicOfferShare | null): Promise<Buffer> {
  const productImageDataUri = offer ? await resolveOfferProductImage(offer) : null;

  const pngRes = new ImageResponse(
    offer ? OfferOgImageJsx(offer, productImageDataUri) : PwaIconJsx(512),
    offer ? OFFER_OG_SIZE : { width: 512, height: 512 },
  );
  const png = Buffer.from(await pngRes.arrayBuffer());

  return sharp(png)
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}
