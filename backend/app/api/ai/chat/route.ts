import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { corsPreflight, withCors } from "@/lib/http/cors";
import { getEnv } from "@/lib/env";

const GeminiMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000), // max ~500 tokens per message
});

const ChatRequestSchema = z.object({
  messages: z.array(GeminiMessageSchema).min(1).max(20), // max 20 turns
  // Layered prompt + каталогни откъси лесно надхвърлят 4k символа; горна граница срещу злоупотреба.
  systemPrompt: z.string().max(24000).optional(),
  // Client overrides are ignored for security/stability.
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().min(1).max(8192).optional(),
});

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function toGeminiContents(messages: Array<z.infer<typeof GeminiMessageSchema>>) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  return postImpl(req);
}

async function postImpl(req: NextRequest) {
  const env = getEnv();

  if (env.AI_ENABLED === false) {
    return withCors(req, NextResponse.json({ error: "AI_DISABLED" }, { status: 403 }));
  }
  if (!env.GEMINI_API_KEY) {
    return withCors(req, NextResponse.json({ error: "AI_MISCONFIGURED" }, { status: 503 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "INVALID_REQUEST", details: parsed.error.flatten() }, { status: 400 }));
  }

  const { messages, systemPrompt } = parsed.data;

  // ── Rate limiting ─────────────────────────────────────────────────────────
  // 1. Per-IP: max 8 requests per minute (burst protection)
  // 2. Per-IP: daily cap (env-configurable, default 100)
  // 3. Global: hard daily ceiling across all IPs (default 300)
  const maxDaily = env.AI_MAX_DAILY_REQUESTS ?? 100;
  const clientId = getClientId(req);

  if (!allowPerMinute(clientId)) {
    return withCors(req, NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 }));
  }
  if (!allowDaily(clientId, maxDaily)) {
    return withCors(req, NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 }));
  }
  if (!allowGlobalDaily(300)) {
    return withCors(req, NextResponse.json({ error: "SERVICE_BUSY" }, { status: 503 }));
  }

  const finalModel = env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const finalTemperature = env.GEMINI_TEMPERATURE ?? 0.7;
  const finalMaxOutputTokens = env.AI_MAX_OUTPUT_TOKENS ?? 2000;

  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(finalModel)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const requestBody = {
    contents: toGeminiContents(messages),
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: {
      temperature: finalTemperature,
      maxOutputTokens: finalMaxOutputTokens,
      topP: 0.95,
      topK: 40,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const upstreamJson = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    // Sanitized error — never leak upstream details to clients
    const status = upstream.status === 429 ? 429 : 502;
    const error  = upstream.status === 429 ? "RATE_LIMIT_EXCEEDED" : "AI_UNAVAILABLE";
    return withCors(req, NextResponse.json({ error }, { status }));
  }

  const data = upstreamJson as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const usage = data.usageMetadata ?? {};

  return withCors(
    req,
    NextResponse.json({
      content,
      finishReason: data.candidates?.[0]?.finishReason ?? "STOP",
      model: finalModel,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      },
    })
  );
}

type DailyBucket = { dayKey: string; count: number };
const dailyCounts  = new Map<string, DailyBucket>();
const globalDaily  = new Map<string, DailyBucket>();

// Sliding-window per-minute counter (simple token bucket)
type MinuteBucket = { windowStart: number; count: number };
const minuteCounts = new Map<string, MinuteBucket>();

function dayKeyNow() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Max 8 requests per IP per 60-second window */
function allowPerMinute(clientId: string): boolean {
  const MAX_PER_MIN = 8;
  const now = Date.now();
  const existing = minuteCounts.get(clientId);
  if (!existing || now - existing.windowStart > 60_000) {
    minuteCounts.set(clientId, { windowStart: now, count: 1 });
    return true;
  }
  if (existing.count >= MAX_PER_MIN) return false;
  existing.count += 1;
  return true;
}

function allowDaily(clientId: string, maxDaily: number): boolean {
  const today = dayKeyNow();
  const existing = dailyCounts.get(clientId);
  if (!existing || existing.dayKey !== today) {
    dailyCounts.set(clientId, { dayKey: today, count: 1 });
    return true;
  }
  if (existing.count >= maxDaily) return false;
  existing.count += 1;
  return true;
}

/** Hard global daily cap across all IPs */
function allowGlobalDaily(maxGlobal: number): boolean {
  const today = dayKeyNow();
  const existing = globalDaily.get("__global__");
  if (!existing || existing.dayKey !== today) {
    globalDaily.set("__global__", { dayKey: today, count: 1 });
    return true;
  }
  if (existing.count >= maxGlobal) return false;
  existing.count += 1;
  return true;
}

function getClientId(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || forwardedFor;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

