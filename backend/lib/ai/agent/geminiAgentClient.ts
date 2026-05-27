import type { getEnv } from "@/lib/env";
import { AGENT_FUNCTION_DECLARATIONS } from "@/lib/ai/agent/agentTools";
import { resolveAgentCachedContent } from "@/lib/ai/agent/agentContextCache";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiContent = {
  role: "user" | "model";
  parts: Array<Record<string, unknown>>;
};

export type GeminiCallResult = {
  body: Record<string, unknown>;
  model: string;
};

export type GeminiCallOptions = {
  usePro?: boolean;
  withTools?: boolean;
  structuredOnly?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  systemInstruction?: string;
  cachedContent?: string | null;
  onTextDelta?: (chunk: string) => void;
};

function resolveThinkingBudget(env: ReturnType<typeof getEnv>, options: GeminiCallOptions): number {
  if (options.structuredOnly) return 0;
  if (options.usePro) return env.AI_AGENT_THINKING_BUDGET_PRO ?? 8192;
  return env.AI_AGENT_THINKING_BUDGET ?? 4096;
}

function pickModel(env: ReturnType<typeof getEnv>, usePro: boolean): string {
  if (usePro) {
    return env.GEMINI_AGENT_PRO_MODEL ?? "gemini-3.1-pro-preview-customtools";
  }
  return env.GEMINI_AGENT_MODEL ?? env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AbortError") || msg.includes("отменена") || msg.includes("надхвърли времето")) return true;
  if (/Gemini 429/.test(msg)) return true;
  if (/Gemini 5\d\d/.test(msg)) return true;
  if (/fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg)) return true;
  return false;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("AI заявката беше отменена.");
}

async function callGeminiOnce(
  env: ReturnType<typeof getEnv>,
  contents: GeminiContent[],
  options: GeminiCallOptions,
  model: string,
  thinkingOverride?: number,
): Promise<GeminiCallResult> {
  throwIfAborted(options.signal);

  const useStream = Boolean(options.onTextDelta) && options.structuredOnly;
  const endpoint = useStream ? "streamGenerateContent" : "generateContent";
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:${endpoint}?key=${encodeURIComponent(env.GEMINI_API_KEY!)}${useStream ? "&alt=sse" : ""}`;

  const thinkingBudget = thinkingOverride ?? resolveThinkingBudget(env, options);
  const generationConfig: Record<string, unknown> = {
    temperature: 0.25,
    maxOutputTokens: Math.min(env.AI_MAX_OUTPUT_TOKENS ?? 8192, 8192),
    thinkingConfig: { thinkingBudget },
  };

  if (options.structuredOnly) {
    generationConfig.responseMimeType = "application/json";
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  let cachedContent = options.cachedContent;
  if (!cachedContent && options.systemInstruction) {
    cachedContent = await resolveAgentCachedContent(env, model, options.systemInstruction);
  }

  if (cachedContent) {
    payload.cachedContent = cachedContent;
  } else if (options.systemInstruction) {
    payload.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  if (options.withTools !== false && !options.structuredOnly) {
    payload.tools = [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }];
    payload.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? env.AI_AGENT_TURN_TIMEOUT_MS ?? 120000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onParentAbort);

  try {
    if (useStream && options.onTextDelta) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 400)}`);
      }
      if (!res.body) throw new Error("Gemini stream empty body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let mergedText = "";
      let lastBody: Record<string, unknown> = {};

      while (true) {
        throwIfAborted(options.signal);
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const chunk = JSON.parse(jsonStr) as Record<string, unknown>;
            lastBody = chunk;
            const parts = getCandidateParts(chunk);
            const delta = extractTextFromParts(parts);
            if (delta) {
              mergedText += delta;
              options.onTextDelta(delta);
            }
          } catch {
            /* skip partial */
          }
        }
      }

      return {
        body: { ...lastBody, candidates: [{ content: { parts: [{ text: mergedText }] } }] },
        model,
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
    }
    return { body, model };
  } catch (e) {
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.message.includes("отменена"));
    throw new Error(isAbort ? "AI заявката беше отменена." : e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(t);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}

export async function callGeminiAgent(
  env: ReturnType<typeof getEnv>,
  contents: GeminiContent[],
  options: GeminiCallOptions,
): Promise<GeminiCallResult> {
  const primary = pickModel(env, options.usePro ?? false);

  try {
    return await callGeminiOnce(env, contents, options, primary);
  } catch (primaryErr) {
    if (options.signal?.aborted) throw primaryErr;
    const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    if (/thinking|thinkingConfig/i.test(msg) && resolveThinkingBudget(env, options) > 0) {
      try {
        return await callGeminiOnce(env, contents, options, primary, 0);
      } catch {
        /* fall through to fallback model */
      }
    }
    const fallback = env.GEMINI_AGENT_FALLBACK_MODEL ?? "gemini-2.5-flash";
    if (fallback !== primary && isRetryableGeminiError(primaryErr)) {
      try {
        return await callGeminiOnce(env, contents, options, fallback);
      } catch {
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
}

export function extractUsage(body: Record<string, unknown>, model: string) {
  const u = (body.usageMetadata ?? {}) as Record<string, number | undefined>;
  return {
    promptTokens: u.promptTokenCount ?? 0,
    completionTokens: u.candidatesTokenCount ?? 0,
    totalTokens: u.totalTokenCount ?? 0,
    model,
  };
}

export type FunctionCallPart = {
  functionCall: { name: string; args: Record<string, unknown>; id?: string };
};

export function getCandidateParts(body: Record<string, unknown>): Array<Record<string, unknown>> {
  const candidates = body.candidates as Array<{ content?: { parts?: Array<Record<string, unknown>> } }> | undefined;
  return candidates?.[0]?.content?.parts ?? [];
}

export function extractTextFromParts(parts: Array<Record<string, unknown>>): string {
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

export function extractFunctionCalls(parts: Array<Record<string, unknown>>): FunctionCallPart[] {
  return parts.filter((p) => p.functionCall && typeof p.functionCall === "object") as FunctionCallPart[];
}

export function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}
