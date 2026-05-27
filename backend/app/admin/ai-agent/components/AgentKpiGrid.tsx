"use client";

import { TrendingDown, TrendingUp, Minus, BarChart3, Users, Package, Wrench, MessageSquare } from "lucide-react";
import type { AgentBlock } from "@/lib/ai/agent/types";

type KpiBlock = Extract<AgentBlock, { type: "kpi" }>;

const ACCENTS = [
  { bg: "from-blue-500/10 to-blue-600/5", ring: "ring-blue-500/20", icon: BarChart3, iconColor: "text-blue-600" },
  { bg: "from-violet-500/10 to-violet-600/5", ring: "ring-violet-500/20", icon: Users, iconColor: "text-violet-600" },
  { bg: "from-cyan-500/10 to-cyan-600/5", ring: "ring-cyan-500/20", icon: Package, iconColor: "text-cyan-600" },
  { bg: "from-emerald-500/10 to-emerald-600/5", ring: "ring-emerald-500/20", icon: Wrench, iconColor: "text-emerald-600" },
  { bg: "from-orange-500/10 to-orange-600/5", ring: "ring-orange-500/20", icon: MessageSquare, iconColor: "text-orange-600" },
];

function trendIcon(value: string) {
  const n = parseFloat(value.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n === 0) return Minus;
  return n > 0 ? TrendingUp : TrendingDown;
}

function KpiCard({ block, index }: { block: KpiBlock; index: number }) {
  const accent = ACCENTS[index % ACCENTS.length];
  const Icon = accent.icon;
  const TrendIcon = trendIcon(block.value);

  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-gradient-to-br ${accent.bg} px-4 py-3.5 min-w-[140px] shadow-sm ring-1 ${accent.ring} overflow-hidden`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 leading-snug pr-6">{block.label}</span>
        <div className={`absolute top-3 right-3 p-1.5 rounded-lg bg-white/70 ${accent.iconColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="flex items-end gap-2 mt-2">
        <span className="text-2xl font-black text-slate-900 tabular-nums leading-none">{block.value}</span>
        <TrendIcon className="w-4 h-4 text-slate-400 mb-0.5 shrink-0" />
      </div>
      {block.hint && <span className="text-[10px] text-slate-500 mt-2 leading-snug">{block.hint}</span>}
    </div>
  );
}

export function AgentKpiGrid({ blocks }: { blocks: KpiBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
      {blocks.map((block, i) => (
        <KpiCard key={`${block.label}-${i}`} block={block} index={i} />
      ))}
    </div>
  );
}
