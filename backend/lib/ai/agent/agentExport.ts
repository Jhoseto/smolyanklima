import type { AgentBlock } from "@/lib/ai/agent/types";
import { blocksToPlainText } from "@/lib/ai/agent/blocksText";

export function blocksToMarkdown(blocks: AgentBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "markdown":
        parts.push(b.content);
        break;
      case "table": {
        parts.push(`| ${b.columns.join(" | ")} |`);
        parts.push(`| ${b.columns.map(() => "---").join(" | ")} |`);
        for (const row of b.rows) parts.push(`| ${row.join(" | ")} |`);
        break;
      }
      case "kpi":
        parts.push(`**${b.label}:** ${b.value}${b.hint ? ` _(${b.hint})_` : ""}`);
        break;
      case "link":
        parts.push(`[${b.label}](${b.href})`);
        break;
      case "chart":
        parts.push(`### ${b.title}\n${b.labels.map((l, i) => `- ${l}: ${b.datasets.map((d) => `${d.label}=${d.data[i] ?? 0}`).join(", ")}`).join("\n")}`);
        break;
      default:
        break;
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}

export function threadToMarkdown(
  title: string,
  messages: Array<{ role: string; content: { text?: string; blocks?: AgentBlock[] }; created_at: string }>,
): string {
  const lines = [`# ${title}`, "", `_Експорт: ${new Date().toLocaleString("bg-BG")}_`, ""];
  for (const m of messages) {
    const ts = new Date(m.created_at).toLocaleString("bg-BG");
    if (m.role === "user") {
      lines.push(`## 👤 Вие (${ts})`, "", m.content.text ?? "", "");
    } else if (m.role === "assistant") {
      lines.push(`## 🤖 AI Agent (${ts})`, "", blocksToMarkdown(m.content.blocks ?? []), "");
    }
  }
  return lines.join("\n");
}
