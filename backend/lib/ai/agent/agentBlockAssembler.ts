import type { AgentBlock } from "@/lib/ai/agent/types";
import type { PrefetchedToolResult } from "@/lib/ai/agent/agentAutoTools";
import { enrichBlocksFromPrefetch } from "@/lib/ai/agent/agentBlockEnrich";
import { needsAnalyticalResponse } from "@/lib/ai/agent/agentAnalysisPrompt";

/** Server-side minimum viable response when Gemini JSON parsing fails entirely. */
export function assembleFallbackBlocksFromPrefetch(
  userMessage: string,
  prefetched: PrefetchedToolResult[],
): AgentBlock[] {
  if (prefetched.length === 0) return [];

  const snippets: string[] = [];
  for (const entry of prefetched) {
    if (entry.result.error) continue;
    const summary = entry.result.summary;
    if (summary && typeof summary === "object") {
      snippets.push(`**${entry.name}**: ${JSON.stringify(summary).slice(0, 400)}`);
    } else if (entry.result.note && typeof entry.result.note === "string") {
      snippets.push(`**${entry.name}**: ${entry.result.note}`);
    }
  }

  const base: AgentBlock[] = [
    {
      type: "markdown",
      content: [
        "### Резюме",
        "Отговорът беше частично формиран от системата на база реални данни от tools.",
        "",
        "### Данни от системата",
        snippets.length > 0 ? snippets.join("\n\n") : "Има заредени tool results — опитайте regenerate за пълен анализ.",
        "",
        "### Препоръки",
        "Натиснете **Regenerate** или задайте по-конкретен въпрос.",
      ].join("\n"),
    },
  ];

  if (needsAnalyticalResponse(userMessage)) {
    return enrichBlocksFromPrefetch(base, prefetched, userMessage);
  }
  return base;
}
