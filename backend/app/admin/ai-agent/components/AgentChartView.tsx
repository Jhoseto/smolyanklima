"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { AgentBlock } from "@/lib/ai/agent/types";

type ChartBlock = Extract<AgentBlock, { type: "chart" }>;

const PALETTE = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#ea580c", "#db2777", "#4f46e5", "#0d9488"];

const TOOLTIP: EChartsOption["tooltip"] = {
  trigger: "axis",
  backgroundColor: "rgba(255,255,255,0.96)",
  borderColor: "#e2e8f0",
  borderWidth: 1,
  padding: [10, 14],
  textStyle: { color: "#334155", fontSize: 12 },
  extraCssText: "border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,0.12);",
  axisPointer: {
    type: "shadow",
    shadowStyle: { color: "rgba(37,99,235,0.06)" },
  },
};

const PIE_TOOLTIP: EChartsOption["tooltip"] = {
  trigger: "item",
  backgroundColor: "rgba(255,255,255,0.96)",
  borderColor: "#e2e8f0",
  borderWidth: 1,
  padding: [10, 14],
  textStyle: { color: "#334155", fontSize: 12 },
  extraCssText: "border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,0.12);",
  formatter: "{b}: <b>{c}</b> ({d}%)",
};

function buildPieOption(block: ChartBlock): EChartsOption {
  const ds = block.datasets[0];
  const data = block.labels.map((label, i) => ({
    name: label,
    value: ds?.data[i] ?? 0,
  }));

  return {
    color: PALETTE,
    tooltip: PIE_TOOLTIP,
    legend: {
      type: "scroll",
      bottom: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#64748b", fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { show: true, fontWeight: 600, fontSize: 12 },
        },
        data,
      },
    ],
  };
}

function buildCartesianOption(block: ChartBlock): EChartsOption {
  const series = block.datasets.map((ds, i) => {
    const color = PALETTE[i % PALETTE.length];
    const base = {
      name: ds.label,
      data: ds.data,
      emphasis: { focus: "series" as const },
    };

    if (block.chartType === "line") {
      return {
        ...base,
        type: "line" as const,
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 3, color },
        itemStyle: { color, borderWidth: 2, borderColor: "#fff" },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}33` },
              { offset: 1, color: `${color}05` },
            ],
          },
        },
      };
    }

    if (block.chartType === "area") {
      return {
        ...base,
        type: "line" as const,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2.5, color },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}55` },
              { offset: 1, color: `${color}08` },
            ],
          },
        },
      };
    }

    return {
      ...base,
      type: "bar" as const,
      barMaxWidth: 44,
      itemStyle: {
        borderRadius: [8, 8, 0, 0],
        color: {
          type: "linear" as const,
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color },
            { offset: 1, color: `${color}bb` },
          ],
        },
      },
    };
  });

  return {
    color: PALETTE,
    tooltip: TOOLTIP,
    legend:
      block.datasets.length > 1
        ? {
            top: 0,
            right: 0,
            icon: "roundRect",
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { color: "#64748b", fontSize: 11 },
          }
        : undefined,
    grid: { left: 8, right: 12, top: block.datasets.length > 1 ? 36 : 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: block.labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#64748b",
        fontSize: 11,
        interval: 0,
        rotate: block.labels.some((l) => l.length > 14) ? 24 : 0,
        formatter: (v: string) => (v.length > 22 ? `${v.slice(0, 20)}…` : v),
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#94a3b8", fontSize: 11 },
    },
    series,
    animationDuration: 700,
    animationEasing: "cubicOut",
  };
}

function buildOption(block: ChartBlock): EChartsOption {
  if (block.chartType === "pie") return buildPieOption(block);
  return buildCartesianOption(block);
}

export function AgentChartView({ block }: { block: ChartBlock }) {
  const option = useMemo(() => buildOption(block), [block]);
  const height = block.chartType === "pie" ? 300 : 280;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/80 p-4 shadow-sm overflow-hidden">
      {block.title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-800 tracking-tight">{block.title}</p>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {block.chartType === "pie" ? "Разпределение" : block.chartType === "line" ? "Тренд" : block.chartType === "area" ? "Обем" : "Сравнение"}
          </span>
        </div>
      )}
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}
