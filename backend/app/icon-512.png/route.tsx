import { ImageResponse } from "next/og";
import { PwaIconJsx } from "@/lib/pwa-icon";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(PwaIconJsx(512), { width: 512, height: 512 });
}
