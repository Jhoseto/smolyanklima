import { getEnv } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HEADERS = "Content-Type, Authorization, X-Chat-Session-Token";

export function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin");
  try {
    const env = getEnv();
    const allowOrigin = origin && origin === env.FRONTEND_ORIGIN ? origin : env.FRONTEND_ORIGIN;

    res.headers.set("Access-Control-Allow-Origin", allowOrigin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    return res;
  } catch {
    res.headers.set("Access-Control-Allow-Origin", origin ?? "*");
    res.headers.set("Vary", "Origin");
    if (origin) res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
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
      "Vary": "Origin",
    };
  } catch {
    return {
      "Access-Control-Allow-Origin": origin ?? "*",
      ...(origin ? { "Access-Control-Allow-Credentials": "true" } : {}),
      "Vary": "Origin",
    };
  }
}
