"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { AgentBlock } from "@/lib/ai/agent/types";
import { repairAgentBlocks, coerceBlocksInput, parseAgentBlocksFromText, isRawAgentJsonText } from "@/lib/ai/agent/blockNormalize";
import { AgentKpiGrid } from "./AgentKpiGrid";

const AgentChartView = dynamic(() => import("./AgentChartView").then((m) => m.AgentChartView), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-4 min-h-[280px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-brand-blue-500 animate-spin" />
        <span className="text-xs font-medium">Зареждане на графика…</span>
      </div>
    </div>
  ),
});

const markdownComponents: Components = {
  p: ({ children }) => {
    const childArray = Array.isArray(children) ? children : [children];
    const hasBlockChild = childArray.some((child) => {
      if (!child || typeof child !== "object" || !("type" in child)) return false;
      const type = (child as { type?: unknown }).type;
      if (typeof type === "string") {
        return ["div", "table", "ul", "ol", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"].includes(type);
      }
      return true;
    });
    if (hasBlockChild) return <div className="mb-2 last:mb-0">{children}</div>;
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
};

function useClientReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

function AdminDeepLink({ href, children }: { href: string; children: ReactNode }) {
  const isInternal = href.startsWith("/admin/");
  if (isInternal) {
    return (
      <Link href={href} className="text-brand-blue-600 hover:underline inline-flex items-center gap-0.5 font-semibold">
        {children}
        <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-blue-600 hover:underline inline-flex items-center gap-0.5 font-semibold"
    >
      {children}
      <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
    </a>
  );
}

function SafeMarkdown({ content }: { content: string }) {
  const ready = useClientReady();
  if (!ready) {
    return (
      <div className="prose prose-sm prose-slate max-w-none">
        <p className="text-sm text-slate-700 whitespace-pre-wrap mb-0">{content}</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-headings:tracking-tight prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-a:text-brand-blue-600 prose-strong:text-slate-900 prose-p:text-[13.5px] prose-p:leading-relaxed prose-li:text-[13.5px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function TableBlock({ block }: { block: Extract<AgentBlock, { type: "table" }> }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm bg-white">
      {block.title && (
        <div className="px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          {block.title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200">
              {block.columns.map((col, ci) => (
                <th key={`col-${ci}`} className="px-4 py-2.5 text-left font-bold text-slate-600 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => {
              const link = block.links?.find((l) => l.row === ri);
              return (
                <tr
                  key={ri}
                  className="border-b border-slate-100 last:border-0 odd:bg-white even:bg-slate-50/40 hover:bg-brand-blue-50/40 transition-colors"
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-slate-700 whitespace-nowrap max-w-[280px] truncate">
                      {link && ci === 0 ? <AdminDeepLink href={link.href}>{cell}</AdminDeepLink> : cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AgentMessageBlocks({ blocks }: { blocks: AgentBlock[] | unknown }) {
  let displayBlocks = repairAgentBlocks(blocks);

  // Last resort: never render raw JSON in chat
  if (displayBlocks.length === 1 && displayBlocks[0].type === "markdown" && isRawAgentJsonText(displayBlocks[0].content)) {
    const repaired = parseAgentBlocksFromText(displayBlocks[0].content);
    if (repaired.length > 0) displayBlocks = repaired;
  }

  const nodes: ReactNode[] = [];
  let kpiBuffer: Extract<AgentBlock, { type: "kpi" }>[] = [];

  function flushKpis() {
    if (kpiBuffer.length === 0) return;
    nodes.push(<AgentKpiGrid key={`kpi-${nodes.length}`} blocks={kpiBuffer} />);
    kpiBuffer = [];
  }

  for (let i = 0; i < displayBlocks.length; i++) {
    const block = displayBlocks[i];
    if (block.type === "kpi") {
      kpiBuffer.push(block);
      continue;
    }
    flushKpis();
    switch (block.type) {
      case "markdown":
        if (isRawAgentJsonText(block.content)) {
          const inner = parseAgentBlocksFromText(block.content);
          for (let j = 0; j < inner.length; j++) {
            const ib = inner[j];
            if (ib.type === "markdown") nodes.push(<SafeMarkdown key={`md-${i}-${j}`} content={ib.content} />);
            else if (ib.type === "chart") nodes.push(<AgentChartView key={`chart-${i}-${j}`} block={ib} />);
            else if (ib.type === "table") nodes.push(<TableBlock key={`tbl-${i}-${j}`} block={ib} />);
            else if (ib.type === "kpi") kpiBuffer.push(ib);
            else if (ib.type === "link") {
              nodes.push(
                <div key={`link-${i}-${j}`}>
                  <AdminDeepLink href={ib.href}>{ib.label}</AdminDeepLink>
                </div>,
              );
            }
          }
        } else {
          nodes.push(<SafeMarkdown key={`md-${i}`} content={block.content} />);
        }
        break;
      case "table":
        nodes.push(<TableBlock key={`tbl-${i}`} block={block} />);
        break;
      case "chart":
        nodes.push(<AgentChartView key={`chart-${i}`} block={block} />);
        break;
      case "link":
        nodes.push(
          <div key={`link-${i}`}>
            <AdminDeepLink href={block.href}>{block.label}</AdminDeepLink>
          </div>,
        );
        break;
      default:
        break;
    }
  }
  flushKpis();

  return <div className="flex flex-col gap-4 min-w-0">{nodes}</div>;
}
