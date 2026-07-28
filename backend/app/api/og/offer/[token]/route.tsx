import { fetchPublicOfferShare } from "@/lib/offers/publicOfferShare";
import { renderOfferOgJpeg } from "@/lib/offers/renderOfferOgImage";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await fetchPublicOfferShare(token);
  const jpeg = await renderOfferOgJpeg(offer);

  return new Response(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpeg.length),
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
