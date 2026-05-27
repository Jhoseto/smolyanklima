import type { AdminSession } from "@/lib/admin/db";
import { getEnv } from "@/lib/env";
import type { AgentProgressEvent } from "@/lib/ai/agent/agentProgress";
import { AgentResponseSchema, type AgentBlock, type AgentTurnResult, type TokenUsage } from "@/lib/ai/agent/types";
import { buildAgentSystemPrompt } from "@/lib/ai/agent/systemPrompt";
import { loadSupplierRegistry } from "@/lib/ai/agent/supplierRegistry";
import { executeAgentTool, type ToolContext } from "@/lib/ai/agent/agentTools";
import {
  callGeminiAgent,
  extractFunctionCalls,
  extractJsonFromText,
  extractTextFromParts,
  extractUsage,
  getCandidateParts,
  type GeminiContent,
} from "@/lib/ai/agent/geminiAgentClient";

export type RunAgentTurnOptions = {
  signal?: AbortSignal;
  onProgress?: (event: AgentProgressEvent) => void;
  onTextDelta?: (chunk: string) => void;
};

export async function runAgentTurn(
  session: AdminSession,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
  options: RunAgentTurnOptions = {},
): Promise<AgentTurnResult> {
  const env = getEnv();
  if (env.AI_ENABLED === false) {
    throw new Error("AI_DISABLED");
  }
  if (!env.GEMINI_API_KEY) {
    throw new Error("AI_MISCONFIGURED");
  }

  const maxToolRounds = env.AI_AGENT_MAX_TOOL_ROUNDS ?? 8;
  const escalationThreshold = env.AI_AGENT_ESCALATION_THRESHOLD ?? 4;
  const turnTimeoutMs = env.AI_AGENT_TURN_TIMEOUT_MS ?? 120000;

  options.onProgress?.({ phase: "start", message: "Анализирам въпроса…" });

  const suppliers = await loadSupplierRegistry(session.db);
  const systemPrompt = buildAgentSystemPrompt(suppliers);

  const contents: GeminiContent[] = [];

  for (const h of history.slice(-10)) {
    contents.push({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    });
  }

  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const toolCtx: ToolContext = {
    db: session.db,
    env,
    suppliers,
    supplierWebCallsThisTurn: { count: 0 },
    adminUserId: session.userId,
  };

  let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: "" };
  let toolCallsCount = 0;
  let usePro = false;

  for (let round = 0; round < maxToolRounds; round++) {
    if (options.signal?.aborted) throw new Error("AI заявката беше отменена.");

    const { body, model } = await callGeminiAgent(env, contents, {
      usePro,
      withTools: true,
      timeoutMs: turnTimeoutMs,
      signal: options.signal,
      systemInstruction: systemPrompt,
    });
    const usage = extractUsage(body, model);
    totalUsage = {
      promptTokens: totalUsage.promptTokens + usage.promptTokens,
      completionTokens: totalUsage.completionTokens + usage.completionTokens,
      totalTokens: totalUsage.totalTokens + usage.totalTokens,
      model,
    };

    const parts = getCandidateParts(body);
    const calls = extractFunctionCalls(parts);

    if (calls.length === 0) {
      const text = extractTextFromParts(parts);
      const blocks = parseBlocksFromText(text);
      if (blocks.length > 0) {
        options.onProgress?.({ phase: "done", message: "Готово." });
        return { blocks, usage: totalUsage, toolCallsCount, model };
      }
      break;
    }

    const toolNames = calls.map((c) => c.functionCall.name);
    options.onProgress?.({
      phase: "tools",
      message: "Извличам данни от системата…",
      tools: toolNames,
    });

    contents.push({ role: "model", parts });

    const responseParts: Array<Record<string, unknown>> = [];
    for (const call of calls) {
      toolCallsCount += 1;
      const fc = call.functionCall;
      const result = await executeAgentTool(fc.name, fc.args ?? {}, toolCtx);
      responseParts.push({
        functionResponse: {
          name: fc.name,
          id: fc.id,
          response: result,
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });

    if (toolCallsCount >= escalationThreshold) {
      usePro = true;
    }
  }

  options.onProgress?.({ phase: "final", message: "Формулирам структуриран отговор…" });

  const finalPrompt =
    'На база на всички tool results по-горе, генерирай финален отговор САМО като JSON: {"blocks":[...]}. Без markdown fences.';
  contents.push({ role: "user", parts: [{ text: finalPrompt }] });

  const { body, model } = await callGeminiAgent(env, contents, {
    usePro,
    structuredOnly: true,
    withTools: false,
    timeoutMs: turnTimeoutMs,
    signal: options.signal,
    onTextDelta: options.onTextDelta,
  });
  const usage = extractUsage(body, model);
  totalUsage = {
    promptTokens: totalUsage.promptTokens + usage.promptTokens,
    completionTokens: totalUsage.completionTokens + usage.completionTokens,
    totalTokens: totalUsage.totalTokens + usage.totalTokens,
    model,
  };

  const parts = getCandidateParts(body);
  const text = extractTextFromParts(parts);
  const blocks = parseBlocksFromText(text);

  if (blocks.length === 0) {
    options.onProgress?.({ phase: "done", message: "Готово." });
    return {
      blocks: [
        {
          type: "markdown",
          content: "Не успях да формирам структуриран отговор. Моля, опитайте отново или преформулирайте въпроса.",
        },
      ],
      usage: totalUsage,
      toolCallsCount,
      model,
    };
  }

  options.onProgress?.({ phase: "done", message: "Готово." });
  return { blocks, usage: totalUsage, toolCallsCount, model };
}

function parseBlocksFromText(text: string): AgentBlock[] {
  const jsonStr = extractJsonFromText(text);
  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    const validated = AgentResponseSchema.safeParse(parsed);
    if (validated.success) return validated.data.blocks;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { blocks?: unknown }).blocks)) {
      const partial = AgentResponseSchema.safeParse({ blocks: (parsed as { blocks: unknown }).blocks });
      if (partial.success) return partial.data.blocks;
    }
  } catch {
    /* fall through */
  }
  if (text.trim()) {
    return [{ type: "markdown", content: text.trim() }];
  }
  return [];
}
