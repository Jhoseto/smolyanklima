import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { corsPreflight, withCors } from "@/lib/http/cors";
import { getEnv } from "@/lib/env";

const GeminiMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const ChatRequestSchema = z.object({
  messages: z.array(GeminiMessageSchema).min(1),
  systemPrompt: z.string().optional(),
  // Client overrides are ignored by default for security/stability.
  // We keep these fields optional only for forward-compatibility.
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

  // Daily rate limit (best-effort, in-memory; good enough for Cloud Run single instance / low traffic)
  const maxDaily = env.AI_MAX_DAILY_REQUESTS ?? 500;
  const clientId = getClientId(req);
  if (!allowDaily(clientId, maxDaily)) {
    return withCors(req, NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 }));
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
    return withCors(
      req,
      NextResponse.json(
        { error: "UPSTREAM_ERROR", status: upstream.status, upstream: upstreamJson },
        { status: upstream.status }
      )
    );
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
const dailyCounts = new Map<string, DailyBucket>();

function dayKeyNow() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function allowDaily(clientId: string, maxDaily: number) {
  const key = `${clientId}`;
  const today = dayKeyNow();
  const existing = dailyCounts.get(key);
  if (!existing || existing.dayKey !== today) {
    dailyCounts.set(key, { dayKey: today, count: 1 });
    return true;
  }
  if (existing.count >= maxDaily) return false;
  existing.count += 1;
  return true;
}

function getClientId(req: NextRequest) {
  // Prefer Cloud Run / proxy headers. Fallbacks are best-effort.
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || forwardedFor;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

