import { getEnv } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

export function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const env = getEnv();
  const origin = req.headers.get("origin");
  const allowOrigin = origin && origin === env.FRONTEND_ORIGIN ? origin : env.FRONTEND_ORIGIN;

  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  return res;
}

export function corsPreflight(req: NextRequest): NextResponse {
  return withCors(req, new NextResponse(null, { status: 204 }));
}

