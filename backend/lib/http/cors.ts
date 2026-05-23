import { getEnv } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HEADERS = "Content-Type, Authorization, X-Chat-Session-Token";

function applyCorsHeaders(req: NextRequest, res: NextResponse, allowOrigin: string): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  return res;
}

export function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin");
  try {
    const env = getEnv();
    const allowOrigin = origin && origin === env.FRONTEND_ORIGIN ? origin : env.FRONTEND_ORIGIN;
    return applyCorsHeaders(req, res, allowOrigin);
  } catch {
    // Fail closed — do not reflect arbitrary origins when env is misconfigured.
    return res;
  }
}

export function corsPreflight(req: NextRequest): NextResponse {
  return withCors(req, new NextResponse(null, { status: 204 }));
}

/** CORS headers for raw Response (SSE) */
export function sseCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  try {
    const env = getEnv();
    const allowOrigin = origin && origin === env.FRONTEND_ORIGIN ? origin : env.FRONTEND_ORIGIN;
    return {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    };
  } catch {
    return { Vary: "Origin" };
  }
}
