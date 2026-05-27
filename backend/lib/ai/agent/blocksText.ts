import type { AgentBlock } from "@/lib/ai/agent/types";

export function blocksToPlainText(
  blocks: Array<{ type: string; content?: string; label?: string; value?: string }>,
): string {
  return blocks
    .map((b) => {
      if (b.type === "markdown" && b.content) return b.content;
      if (b.type === "kpi" && b.label) return `${b.label}: ${b.value ?? ""}`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);
}

export function messageCopyText(msg: {
  role: string;
  content: { text?: string; blocks?: AgentBlock[] };
}): string {
  if (msg.role === "user") return msg.content.text ?? "";
  return blocksToPlainText(msg.content.blocks ?? []);
}
