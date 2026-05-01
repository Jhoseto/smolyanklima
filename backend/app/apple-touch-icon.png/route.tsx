import { ImageResponse } from "next/og";
import { PwaIconJsx } from "@/lib/pwa-icon";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(PwaIconJsx(180), { width: 180, height: 180 });
}
