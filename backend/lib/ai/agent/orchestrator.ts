import type { AdminSession } from "@/lib/admin/db";
import { getEnv } from "@/lib/env";
import type { AgentProgressEvent } from "@/lib/ai/agent/agentProgress";
import type { AgentBlock, AgentTurnResult, TokenUsage } from "@/lib/ai/agent/types";
import { blocksFromModelText, finalizeAgentBlocks, parseAgentBlocksFromText } from "@/lib/ai/agent/blockNormalize";
import { enrichBlocksFromPrefetch } from "@/lib/ai/agent/agentBlockEnrich";
import { buildFinalAnalysisPrompt, buildPlainJsonFallbackPrompt, buildAdminGuidePrompt } from "@/lib/ai/agent/agentAnalysisPrompt";
import {
  formatExecutedToolResults,
  formatPrefetchedToolContext,
  planAutoTools,
  requiresToolData,
  toolDataRefusalNudge,
  isAdminGuideQuestion,
  capPrefetchPlans,
  prefetchToolKey,
  postPrefetchToolNudge,
} from "@/lib/ai/agent/agentAutoTools";
import { assembleFallbackBlocksFromPrefetch } from "@/lib/ai/agent/agentBlockAssembler";
import {
  geminiPlanTools,
  mergeToolPlans,
  shouldUseGeminiToolPlanner,
} from "@/lib/ai/agent/agentToolPlanner";
import { buildAgentSystemPrompt } from "@/lib/ai/agent/systemPrompt";
import { loadSupplierRegistry } from "@/lib/ai/agent/supplierRegistry";
import { executeAgentTool, type ToolContext } from "@/lib/ai/agent/agentTools";
import {
  callGeminiAgent,
  extractFunctionCalls,
  extractModelOutputText,
  extractTextFromParts,
  extractUsage,
  getCandidateModelContent,
  getCandidateParts,
  getFinishReason,
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
  const isGuideTurn = isAdminGuideQuestion(userMessage);
  let usePro = requiresToolData(userMessage);

  const prefetchMax = env.AI_AGENT_PREFETCH_MAX ?? 3;
  let autoPlans = isGuideTurn ? [] : capPrefetchPlans(planAutoTools(userMessage), prefetchMax);

  if (!isGuideTurn && shouldUseGeminiToolPlanner(env, autoPlans)) {
    options.onProgress?.({ phase: "start", message: "Избирам подходящи tools…" });
    const geminiPlans = await geminiPlanTools(env, userMessage, options.signal);
    if (geminiPlans.length > 0) {
      autoPlans = mergeToolPlans(autoPlans, geminiPlans, prefetchMax);
    }
  }

  let prefetchedResults: Array<{ name: string; args: Record<string, unknown>; result: Record<string, unknown> }> = [];
  const prefetchedKeys = new Set<string>();

  if (autoPlans.length > 0) {
    options.onProgress?.({
      phase: "tools",
      message: "Извличам данни от системата…",
      tools: autoPlans.map((plan) => plan.name),
    });
    const prefetched = [];
    for (const plan of autoPlans) {
      toolCallsCount += 1;
      prefetchedKeys.add(prefetchToolKey(plan.name, plan.args));
      const result = await executeAgentTool(plan.name, plan.args, toolCtx);
      prefetched.push({ name: plan.name, args: plan.args, result });
    }
    prefetchedResults = prefetched;
    const prefetchText = formatPrefetchedToolContext(prefetched);
    if (prefetchText) {
      contents.push({ role: "user", parts: [{ text: prefetchText }] });
      contents.push({ role: "user", parts: [{ text: postPrefetchToolNudge() }] });
    }
  }

  const postPrefetchRounds = env.AI_AGENT_POST_PREFETCH_TOOL_ROUNDS ?? 2;
  const toolLoopMaxRounds =
    prefetchedResults.length > 0 ? postPrefetchRounds : maxToolRounds;

  if (!isGuideTurn && (toolLoopMaxRounds > 0 || prefetchedResults.length === 0)) {
    for (let round = 0; round < toolLoopMaxRounds; round++) {
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
        const blocks = finalizeAgentBlocks(parseAgentBlocksFromText(text));
        if (blocks.length > 0) {
          if (requiresToolData(userMessage) && toolCallsCount === 0) {
            contents.push({ role: "user", parts: [{ text: toolDataRefusalNudge() }] });
            continue;
          }
          if (requiresToolData(userMessage) && toolCallsCount > 0) {
            break;
          }
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

      const executed = [];
      for (const call of calls) {
        const fc = call.functionCall;
        const key = prefetchToolKey(fc.name, fc.args ?? {});
        if (prefetchedKeys.has(key)) continue;

        toolCallsCount += 1;
        prefetchedKeys.add(key);
        const result = await executeAgentTool(fc.name, fc.args ?? {}, toolCtx);
        executed.push({ name: fc.name, args: fc.args ?? {}, result });
        prefetchedResults.push({ name: fc.name, args: fc.args ?? {}, result });
      }

      if (executed.length === 0) break;

      const modelTurn = getCandidateModelContent(body);
      if (modelTurn) {
        contents.push(modelTurn);
        contents.push({
          role: "user",
          parts: executed.map(({ name, result }) => ({
            functionResponse: { name, response: result },
          })),
        });
      } else {
        const toolText = formatExecutedToolResults(executed);
        if (toolText) {
          contents.push({ role: "user", parts: [{ text: toolText }] });
        }
        const modelText = extractTextFromParts(parts);
        if (modelText) {
          contents.push({ role: "model", parts: [{ text: modelText }] });
        }
      }

      if (toolCallsCount >= escalationThreshold) {
        usePro = true;
      }
    }
  }

  options.onProgress?.({
    phase: "final",
    message: isGuideTurn ? "Подготвям ръководство…" : "Анализирам и формулирам изводи…",
  });

  const finalPrompt = isGuideTurn ? buildAdminGuidePrompt(userMessage) : buildFinalAnalysisPrompt(userMessage);
  contents.push({ role: "user", parts: [{ text: finalPrompt }] });

  // After prefetch-only turns, flash is enough for synthesis.
  const hadPrefetchOnly = prefetchedResults.length > 0 && postPrefetchRounds === 0;
  const finalUsePro = usePro && !hadPrefetchOnly;
  const fallbackModel = env.GEMINI_AGENT_FALLBACK_MODEL ?? "gemini-2.5-flash";

  type FinalGenOpts = {
    usePro: boolean;
    structuredOnly: boolean;
    modelOverride?: string;
    contentsOverride?: GeminiContent[];
  };

  async function runFinalGeneration(opts: FinalGenOpts) {
    return callGeminiAgent(env, opts.contentsOverride ?? contents, {
      usePro: opts.usePro,
      structuredOnly: opts.structuredOnly,
      withTools: false,
      timeoutMs: turnTimeoutMs,
      signal: options.signal,
      systemInstruction: systemPrompt,
      modelOverride: opts.modelOverride,
    });
  }

  function mergeUsage(model: string, usage: ReturnType<typeof extractUsage>) {
    totalUsage = {
      promptTokens: totalUsage.promptTokens + usage.promptTokens,
      completionTokens: totalUsage.completionTokens + usage.completionTokens,
      totalTokens: totalUsage.totalTokens + usage.totalTokens,
      model,
    };
  }

  let { body, model } = await runFinalGeneration({ usePro: finalUsePro, structuredOnly: true });
  mergeUsage(model, extractUsage(body, model));

  let rawText = extractModelOutputText(body);
  let blocks = blocksFromModelText(rawText);
  let finishReason = getFinishReason(body);

  if (blocks.length === 0 && finalUsePro) {
    const retry = await runFinalGeneration({ usePro: false, structuredOnly: true });
    mergeUsage(retry.model, extractUsage(retry.body, retry.model));
    model = retry.model;
    body = retry.body;
    rawText = extractModelOutputText(body);
    blocks = blocksFromModelText(rawText);
    finishReason = getFinishReason(body);
  }

  if (blocks.length === 0) {
    const retry = await runFinalGeneration({
      usePro: false,
      structuredOnly: true,
      modelOverride: fallbackModel,
    });
    mergeUsage(retry.model, extractUsage(retry.body, retry.model));
    model = retry.model;
    body = retry.body;
    rawText = extractModelOutputText(body);
    blocks = blocksFromModelText(rawText);
    finishReason = getFinishReason(body);
  }

  if (blocks.length === 0) {
    const plainContents: GeminiContent[] = [
      ...contents,
      { role: "user", parts: [{ text: buildPlainJsonFallbackPrompt() }] },
    ];
    const plain = await runFinalGeneration({
      usePro: false,
      structuredOnly: false,
      modelOverride: fallbackModel,
      contentsOverride: plainContents,
    });
    mergeUsage(plain.model, extractUsage(plain.body, plain.model));
    model = plain.model;
    body = plain.body;
    rawText = extractModelOutputText(body);
    blocks = blocksFromModelText(rawText);
    finishReason = getFinishReason(body);
  }

  if (blocks.length === 0) {
    const assembled = assembleFallbackBlocksFromPrefetch(userMessage, prefetchedResults);
    if (assembled.length > 0) {
      blocks = assembled;
    }
  }

  if (blocks.length === 0) {
    console.error("[ai-agent] empty final blocks", {
      model,
      finishReason,
      rawLen: rawText.length,
      rawPreview: rawText.slice(0, 200),
    });
    options.onProgress?.({ phase: "done", message: "Готово." });
    return {
      blocks: [
        {
          type: "markdown",
          content: finishReason
            ? `Не успях да формирам структуриран отговор (${finishReason}). Моля, опитайте отново или преформулирайте въпроса.`
            : "Не успях да формирам структуриран отговор. Моля, опитайте отново или преформулирайте въпроса.",
        },
      ],
      usage: totalUsage,
      toolCallsCount,
      model,
    };
  }

  if (!isGuideTurn) {
    blocks = enrichBlocksFromPrefetch(blocks, prefetchedResults, userMessage);
  }

  options.onProgress?.({ phase: "done", message: "Готово." });
  return { blocks, usage: totalUsage, toolCallsCount, model };
}
