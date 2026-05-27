import { createHash } from "crypto";
import type { getEnv } from "@/lib/env";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type CacheEntry = {
  name: string;
  expiresAt: number;
};

const cacheByKey = new Map<string, CacheEntry>();

function cacheKey(model: string, systemInstruction: string): string {
  const hash = createHash("sha256").update(systemInstruction).digest("hex").slice(0, 20);
  return `${model}:${hash}`;
}

/** Explicit Gemini cachedContents for agent system prompt (fallback: inline systemInstruction). */
export async function resolveAgentCachedContent(
  env: ReturnType<typeof getEnv>,
  model: string,
  systemInstruction: string,
): Promise<string | null> {
  if (process.env.AI_AGENT_USE_CONTEXT_CACHE === "false") return null;
  if (!env.GEMINI_API_KEY || !systemInstruction.trim()) return null;

  const key = cacheKey(model, systemInstruction);
  const existing = cacheByKey.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.name;
  }

  const ttlSec = env.AI_AGENT_CONTEXT_CACHE_TTL_S ?? 3600;
  const url = `${GEMINI_API_BASE}/cachedContents?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        displayName: `smolyan-agent-${key.slice(-24)}`,
        ttl: `${ttlSec}s`,
      }),
    });

    if (!res.ok) return null;

    const body = (await res.json()) as { name?: string };
    if (!body.name) return null;

    cacheByKey.set(key, {
      name: body.name,
      expiresAt: Date.now() + ttlSec * 1000 - 60_000,
    });
    return body.name;
  } catch {
    return null;
  }
}
