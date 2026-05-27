import type { getEnv } from "@/lib/env";
import { getAgentFunctionDeclarations } from "@/lib/ai/agent/agentTools";
import { AGENT_RESPONSE_JSON_SCHEMA } from "@/lib/ai/agent/agentResponseSchema";

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
  onTextDelta?: (chunk: string) => void;
  modelOverride?: string;
};

type PayloadBuildFlags = {
  includeSchema: boolean;
  includeThinking: boolean;
};

function isGemini3Model(model: string): boolean {
  return /gemini-3/i.test(model);
}

function resolveThinkingBudget(env: ReturnType<typeof getEnv>, options: GeminiCallOptions): number {
  if (options.structuredOnly) return 0;
  if (options.usePro) return env.AI_AGENT_THINKING_BUDGET_PRO ?? 8192;
  return env.AI_AGENT_THINKING_BUDGET ?? 4096;
}

function buildThinkingConfig(
  env: ReturnType<typeof getEnv>,
  options: GeminiCallOptions,
  model: string,
): Record<string, unknown> | undefined {
  if (isGemini3Model(model)) {
    if (options.structuredOnly) return { thinkingLevel: "MINIMAL" };
    if (options.usePro) return { thinkingLevel: "HIGH" };
    return { thinkingLevel: "LOW" };
  }

  const budget = resolveThinkingBudget(env, options);
  if (/flash-lite/i.test(model) && budget === 0) {
    return { thinkingBudget: 0 };
  }
  return { thinkingBudget: budget };
}

function pickModel(env: ReturnType<typeof getEnv>, usePro: boolean): string {
  if (usePro) {
    return env.GEMINI_AGENT_PRO_MODEL ?? "gemini-3.1-pro-preview-customtools";
  }
  return env.GEMINI_AGENT_MODEL ?? env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
}

function isGeminiInvalidArgumentError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Gemini 400|INVALID_ARGUMENT|invalid argument/i.test(msg);
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AbortError") || msg.includes("отменена") || msg.includes("надхвърли времето")) return true;
  if (/Gemini 429/.test(msg)) return true;
  if (/Gemini 400|INVALID_ARGUMENT/i.test(msg)) return true;
  if (/Gemini 5\d\d/.test(msg)) return true;
  if (/fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg)) return true;
  return false;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("AI заявката беше отменена.");
}

function buildGeminiPayload(
  env: ReturnType<typeof getEnv>,
  contents: GeminiContent[],
  options: GeminiCallOptions,
  model: string,
  flags: PayloadBuildFlags,
): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.25,
    maxOutputTokens: Math.min(env.AI_MAX_OUTPUT_TOKENS ?? 8192, 8192),
  };

  if (flags.includeThinking) {
    const thinkingConfig = buildThinkingConfig(env, options, model);
    if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig;
  }

  if (options.structuredOnly) {
    generationConfig.responseMimeType = "application/json";
    if (flags.includeSchema) {
      generationConfig.responseSchema = AGENT_RESPONSE_JSON_SCHEMA;
    }
  }

  const useTools = options.withTools !== false && !options.structuredOnly;

  const payload: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  if (options.systemInstruction) {
    payload.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }
  if (useTools) {
    payload.tools = [{ functionDeclarations: getAgentFunctionDeclarations(env) }];
    payload.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  return payload;
}

function buildPayloadVariants(
  env: ReturnType<typeof getEnv>,
  contents: GeminiContent[],
  options: GeminiCallOptions,
  model: string,
): PayloadBuildFlags[] {
  const variants: PayloadBuildFlags[] = [{ includeSchema: true, includeThinking: true }];

  if (options.structuredOnly) {
    variants.push({ includeSchema: false, includeThinking: true });
    variants.push({ includeSchema: true, includeThinking: false });
    variants.push({ includeSchema: false, includeThinking: false });
  } else if (isGemini3Model(model)) {
    variants.push({ includeSchema: false, includeThinking: false });
  }

  const seen = new Set<string>();
  return variants.filter((v) => {
    const key = `${v.includeSchema}:${v.includeThinking}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function callGeminiOnce(
  env: ReturnType<typeof getEnv>,
  contents: GeminiContent[],
  options: GeminiCallOptions,
  model: string,
): Promise<GeminiCallResult> {
  throwIfAborted(options.signal);

  const useStream = Boolean(options.onTextDelta) && !options.structuredOnly;
  const endpoint = useStream ? "streamGenerateContent" : "generateContent";
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:${endpoint}?key=${encodeURIComponent(env.GEMINI_API_KEY!)}${useStream ? "&alt=sse" : ""}`;

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? env.AI_AGENT_TURN_TIMEOUT_MS ?? 120000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onParentAbort);

  const executeRequest = async (body: Record<string, unknown>): Promise<GeminiCallResult> => {
    if (useStream && options.onTextDelta) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(body),
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
      body: JSON.stringify(body),
    });
    const responseBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${JSON.stringify(responseBody).slice(0, 400)}`);
    }
    return { body: responseBody, model };
  };

  try {
    const variants = buildPayloadVariants(env, contents, options, model);
    let lastErr: unknown;

    for (const flags of variants) {
      try {
        const payload = buildGeminiPayload(env, contents, options, model, flags);
        return await executeRequest(payload);
      } catch (e) {
        lastErr = e;
        if (!isGeminiInvalidArgumentError(e)) throw e;
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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
  const primary = options.modelOverride ?? pickModel(env, options.usePro ?? false);

  try {
    return await callGeminiOnce(env, contents, options, primary);
  } catch (primaryErr) {
    if (options.signal?.aborted) throw primaryErr;
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

export function getCandidateModelContent(body: Record<string, unknown>): GeminiContent | null {
  const candidate = (body.candidates as Array<{ content?: GeminiContent }> | undefined)?.[0];
  if (!candidate?.content?.parts?.length) return null;
  return { role: "model", parts: candidate.content.parts };
}

export function extractTextFromParts(parts: Array<Record<string, unknown>>): string {
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

/** Full model text from a generateContent response (non-streaming). */
export function extractModelOutputText(body: Record<string, unknown>): string {
  const parts = getCandidateParts(body);
  const joined = extractTextFromParts(parts);
  if (joined) return joined;

  const finish = getFinishReason(body);
  if (finish && finish !== "STOP") {
    return "";
  }
  return joined;
}

export function getFinishReason(body: Record<string, unknown>): string | undefined {
  return (body.candidates as Array<{ finishReason?: string }> | undefined)?.[0]?.finishReason;
}

export function extractFunctionCalls(parts: Array<Record<string, unknown>>): FunctionCallPart[] {
  return parts.filter((p) => p.functionCall && typeof p.functionCall === "object") as FunctionCallPart[];
}

export { extractJsonFromText } from "@/lib/ai/agent/blockNormalize";
