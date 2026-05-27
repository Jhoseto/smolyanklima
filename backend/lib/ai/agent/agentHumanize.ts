import { humanizeAdminDisplayText } from "@/lib/admin/activityLogLabels";
import type { AgentBlock } from "@/lib/ai/agent/types";

const TECHNICAL_CODE = /^[a-z][a-z0-9_.]*$/i;

function humanizeText(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return part;
      if (TECHNICAL_CODE.test(trimmed) && (trimmed.includes(".") || trimmed.includes("_"))) {
        return humanizeAdminDisplayText(trimmed);
      }
      return humanizeAdminDisplayText(part);
    })
    .join("");
}

function humanizeMarkdown(content: string): string {
  return content
    .replace(/`([a-z][a-z0-9_.]+)`/gi, (_, code: string) => humanizeAdminDisplayText(code))
    .replace(/\b([a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]+)+)\b/gi, (match) => humanizeAdminDisplayText(match))
    .replace(/\b(in_progress|out_of_stock|in_stock|on_order|pending_mount|work_items?)\b/gi, (match) =>
      humanizeAdminDisplayText(match),
    );
}

export function humanizeAgentBlocks(blocks: AgentBlock[]): AgentBlock[] {
  return blocks.map((block) => {
    switch (block.type) {
      case "markdown":
        return { ...block, content: humanizeMarkdown(block.content) };
      case "table":
        return {
          ...block,
          columns: block.columns.map((col) => humanizeText(col)),
          rows: block.rows.map((row) => row.map((cell) => humanizeText(cell))),
        };
      case "chart":
        return {
          ...block,
          title: humanizeText(block.title),
          labels: block.labels.map((label) => humanizeText(label)),
          datasets: block.datasets.map((ds) => ({
            ...ds,
            label: humanizeText(ds.label),
          })),
        };
      case "kpi":
        return {
          ...block,
          label: humanizeText(block.label),
          value: humanizeText(block.value),
          ...(block.hint ? { hint: humanizeText(block.hint) } : {}),
        };
      case "link":
        return { ...block, label: humanizeText(block.label) };
      default:
        return block;
    }
  });
}
