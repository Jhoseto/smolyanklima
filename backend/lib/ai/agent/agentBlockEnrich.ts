import type { AgentBlock } from "@/lib/ai/agent/types";
import type { PrefetchedToolResult } from "@/lib/ai/agent/agentAutoTools";
import { needsAnalyticalResponse } from "@/lib/ai/agent/agentAnalysisPrompt";

type ChartSuggestion = {
  chartType?: string;
  title?: string;
  labels?: string[];
  values?: number[];
};

function chartSuggestionToBlock(s: ChartSuggestion): AgentBlock | null {
  const labels = (s.labels ?? []).map(String).filter(Boolean).slice(0, 60);
  const values = (s.values ?? []).map(Number).filter((n) => Number.isFinite(n)).slice(0, 60);
  if (labels.length === 0 || values.length === 0) return null;

  const chartType = s.chartType === "line" || s.chartType === "pie" || s.chartType === "area" ? s.chartType : "bar";
  return {
    type: "chart",
    chartType,
    title: (s.title ?? "Графика").slice(0, 200),
    labels,
    datasets: [{ label: "Стойност", data: values }],
  };
}

function findChartSuggestions(result: Record<string, unknown>): ChartSuggestion[] {
  const out: ChartSuggestion[] = [];
  const direct = result.chartSuggestion;
  if (direct && typeof direct === "object") out.push(direct as ChartSuggestion);

  const summary = result.summary;
  if (summary && typeof summary === "object") {
    const s = summary as Record<string, unknown>;
    const cs = s.chartSuggestion;
    if (cs && typeof cs === "object") out.push(cs as ChartSuggestion);

    for (const key of ["byStatus", "byEvent", "byService", "byAction", "byMonth"] as const) {
      const rows = s[key];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const labels = rows.slice(0, 10).map((r) => String((r as { label?: string; actionLabel?: string }).label ?? (r as { actionLabel?: string }).actionLabel ?? "—"));
      const values = rows.slice(0, 10).map((r) => Number((r as { count?: number; total?: number }).count ?? (r as { total?: number }).total ?? 0));
      if (labels.some(Boolean) && values.some((v) => v > 0)) {
        out.push({
          chartType: key === "byMonth" ? "line" : "bar",
          title: key === "byAction" ? "Активност по действие" : key === "byStatus" ? "По статус" : "Разпределение",
          labels,
          values,
        });
      }
    }
  }

  const byAction = result.byAction;
  if (Array.isArray(byAction) && byAction.length > 0) {
    out.push({
      chartType: "bar",
      title: "Активност в админ панела",
      labels: byAction.slice(0, 10).map((r) => String((r as { actionLabel?: string }).actionLabel ?? "—")),
      values: byAction.slice(0, 10).map((r) => Number((r as { count?: number }).count ?? 0)),
    });
  }

  return out;
}

function insertChartBlock(blocks: AgentBlock[], chart: AgentBlock): AgentBlock[] {
  const insertAt = blocks.findIndex(
    (b) => b.type === "markdown" && /###\s*(Аномалии|Препоръки)/i.test(b.content),
  );
  if (insertAt >= 0) return [...blocks.slice(0, insertAt), chart, ...blocks.slice(insertAt)];
  return [...blocks, chart];
}

/** Ensure analysis answers include charts from real tool chartSuggestion data. */
export function enrichBlocksFromPrefetch(
  blocks: AgentBlock[],
  prefetched: PrefetchedToolResult[],
  userMessage: string,
): AgentBlock[] {
  if (!needsAnalyticalResponse(userMessage)) return blocks;
  if (blocks.some((b) => b.type === "chart")) return blocks;

  for (const entry of prefetched) {
    for (const suggestion of findChartSuggestions(entry.result)) {
      const chart = chartSuggestionToBlock(suggestion);
      if (chart) return insertChartBlock(blocks, chart);
    }
  }

  return blocks;
}
