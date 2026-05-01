import { ImageResponse } from "next/og";
import { PwaIconJsx } from "@/lib/pwa-icon";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(PwaIconJsx(192), { width: 192, height: 192 });
}
