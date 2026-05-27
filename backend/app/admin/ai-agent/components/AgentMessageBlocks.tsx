"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgentBlock } from "@/lib/ai/agent/types";

const CHART_COLORS = ["#2563eb", "#f97316", "#10b981", "#8b5cf6", "#ef4444"];

function AdminDeepLink({ href, children }: { href: string; children: React.ReactNode }) {
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
  return (
    <div className="prose prose-sm prose-slate max-w-none prose-headings:text-slate-900 prose-a:text-brand-blue-600 prose-strong:text-slate-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function buildChartRows(block: Extract<AgentBlock, { type: "chart" }>) {
  return block.labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const ds of block.datasets) {
      row[ds.label] = ds.data[i] ?? 0;
    }
    return row;
  });
}

function ChartBlock({ block }: { block: Extract<AgentBlock, { type: "chart" }> }) {
  const rows = buildChartRows(block);
  const seriesKeys = block.datasets.map((d) => d.label);

  if (block.chartType === "pie") {
    const ds = block.datasets[0];
    const pieData = block.labels.map((label, i) => ({
      name: label,
      value: ds?.data[i] ?? 0,
    }));
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        {block.title && <p className="text-xs font-bold text-slate-700 mb-2">{block.title}</p>}
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {pieData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const ChartComponent =
    block.chartType === "line" ? LineChart : block.chartType === "area" ? AreaChart : BarChart;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {block.title && <p className="text-xs font-bold text-slate-700 mb-2">{block.title}</p>}
      <ResponsiveContainer width="100%" height={240}>
        <ChartComponent data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {seriesKeys.map((key, i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length];
            if (block.chartType === "line") {
              return <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={{ r: 3 }} />;
            }
            if (block.chartType === "area") {
              return (
                <Area key={key} type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
              );
            }
            return <Bar key={key} dataKey={key} fill={color} radius={[4, 4, 0, 0]} />;
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

function TableBlock({ block }: { block: Extract<AgentBlock, { type: "table" }> }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {block.columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-bold text-slate-700 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => {
            const link = block.links?.find((l) => l.row === ri);
            return (
              <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[240px] truncate">
                    {link && ci === 0 ? <AdminDeepLink href={link.href}>{cell}</AdminDeepLink> : cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AgentMessageBlocks({ blocks }: { blocks: AgentBlock[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "markdown":
            return <SafeMarkdown key={i} content={block.content} />;
          case "table":
            return <TableBlock key={i} block={block} />;
          case "chart":
            return <ChartBlock key={i} block={block} />;
          case "kpi":
            return (
              <div
                key={i}
                className="inline-flex flex-col rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3 min-w-[140px]"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{block.label}</span>
                <span className="text-xl font-black text-slate-900 mt-0.5">{block.value}</span>
                {block.hint && <span className="text-[10px] text-slate-400 mt-1">{block.hint}</span>}
              </div>
            );
          case "link":
            return (
              <div key={i}>
                <AdminDeepLink href={block.href}>{block.label}</AdminDeepLink>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
