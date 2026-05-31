"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  BarChart3,
  ChevronDown,
  TrendingUp,
  ShoppingBag,
  Users,
  Percent,
  Wallet,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Sparkles,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { Button } from "../ui";
import type { SalesHistoryReport, SalesReportClientRow } from "@/lib/admin/computeSalesHistoryReport";
import {
  loadSalesReportAnalysisCache,
  saveSalesReportAnalysisCache,
} from "./salesReportAnalysisCache";
import {
  analysisEmptyHint,
  analysisLoadingMessage,
  analysisSubtitleHint,
  inferAnalysisProfile,
} from "@/lib/admin/salesReportAiAnalysis";

/** Точни brand цветове — съвпадат с tailwind brand-orange / brand-blue */
const C = {
  orange: "#FF4D00",
  orangeMid: "#FF6A00",
  orangeLight: "#ff9c5d",
  orangePale: "#fff3ed",
  blue: "#00B4D8",
  blueDeep: "#0077B6",
  blueLight: "#2cc1e6",
  bluePale: "#e6f9fd",
  ink: "#0f172a",
  muted: "#64748b",
};

const PIE_COLORS = [C.orange, C.blue, C.orangeMid, C.blueDeep, C.orangeLight, C.blueLight, "#E64500", "#0096b8"];

const TOOLTIP: EChartsOption["tooltip"] = {
  trigger: "axis",
  backgroundColor: "rgba(255,255,255,0.97)",
  borderColor: "rgba(0,180,216,0.35)",
  borderWidth: 1,
  padding: [12, 16],
  textStyle: { color: C.ink, fontSize: 12, fontWeight: 500 },
  extraCssText:
    "border-radius:16px;box-shadow:0 20px 50px rgba(0,119,182,0.12), 0 8px 24px rgba(255,77,0,0.08);backdrop-filter:blur(8px);",
  axisPointer: {
    type: "cross",
    crossStyle: { color: C.blue, opacity: 0.35 },
    lineStyle: { color: C.blue, type: "dashed" },
  },
};

const PIE_TOOLTIP: EChartsOption["tooltip"] = {
  trigger: "item",
  backgroundColor: "rgba(255,255,255,0.97)",
  borderColor: "rgba(255,77,0,0.25)",
  borderWidth: 1,
  padding: [12, 16],
  textStyle: { color: C.ink, fontSize: 12 },
  extraCssText: "border-radius:16px;box-shadow:0 20px 50px rgba(255,77,0,0.1);",
  formatter: "{b}<br/><span style='color:#FF4D00;font-weight:800'>{c}</span> <span style='color:#64748b'>({d}%)</span>",
};

function gradOrangeV(): object {
  return {
    type: "linear",
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: C.orange },
      { offset: 1, color: C.orangeLight },
    ],
  };
}

function gradBlueH(): object {
  return {
    type: "linear",
    x: 0,
    y: 0,
    x2: 1,
    y2: 0,
    colorStops: [
      { offset: 0, color: C.blueDeep },
      { offset: 1, color: C.blue },
    ],
  };
}

function gradOrangeH(): object {
  return {
    type: "linear",
    x: 0,
    y: 0,
    x2: 1,
    y2: 0,
    colorStops: [
      { offset: 0, color: C.orange },
      { offset: 1, color: C.orangeMid },
    ],
  };
}

/** Две половини — оранжев и син gradient отделно, без смесване в „ръждив“ тон. */
function BrandSplitStripe({ className = "h-1" }: { className?: string }) {
  return (
    <div className={`flex overflow-hidden ${className}`}>
      <div className="flex-1 bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D]" />
      <div className="flex-1 bg-gradient-to-r from-[#0077B6] via-[#00B4D8] to-[#2cc1e6]" />
    </div>
  );
}

function fmtEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `€${n.toLocaleString("bg-BG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("bg-BG");
}

function AutoFitValue({ value, tone }: { value: string; tone: "orange" | "blue" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [fontPx, setFontPx] = useState(20);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      const maxPx = 20;
      const minPx = 10;
      let size = maxPx;
      text.style.fontSize = `${size}px`;

      while (size > minPx && text.scrollWidth > container.clientWidth) {
        size -= 0.5;
        text.style.fontSize = `${size}px`;
      }
      setFontPx(size);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div ref={containerRef} className="mt-1 min-w-0 flex-1 overflow-hidden pr-0.5">
      <p
        ref={textRef}
        className={`whitespace-nowrap font-black tabular-nums leading-tight ${tone === "orange" ? "text-[#FF4D00]" : "text-[#0077B6]"}`}
        style={{ fontSize: fontPx }}
      >
        {value}
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  variant: "orange" | "blue";
}) {
  const isOrange = variant === "orange";
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl p-[1px] shadow-lg transition-transform duration-300 hover:-translate-y-0.5 ${
        isOrange ? "shadow-brand-orange-500/20" : "shadow-brand-blue-500/20"
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${isOrange ? "from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D]" : "from-[#0077B6] via-[#00B4D8] to-[#2cc1e6]"}`}
      />
      <div className="relative flex h-full items-start justify-between gap-1.5 rounded-[15px] bg-white/95 p-3.5 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <AutoFitValue value={value} tone={variant} />
          {sub && <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{sub}</p>}
        </div>
        <div
          className={`shrink-0 rounded-xl p-2.5 text-white shadow-md ${
            isOrange
              ? "bg-gradient-to-br from-[#FF4D00] to-[#FF6A00] shadow-[#FF4D00]/30"
              : "bg-gradient-to-br from-[#0077B6] to-[#00B4D8] shadow-[#0077B6]/30"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  accent,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  accent: "orange" | "blue";
  children: React.ReactNode;
  className?: string;
}) {
  const bar = accent === "orange" ? "from-[#FF4D00] to-[#FF6A00]" : "from-[#0077B6] to-[#00B4D8]";
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_8px_32px_rgba(0,119,182,0.06)] backdrop-blur-sm ${className}`}
    >
      <div className={`h-1 bg-gradient-to-r ${bar}`} />
      <div className="p-3.5 md:p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-800">{title}</p>
            {subtitle && <p className="mt-0.5 text-[10px] font-medium text-slate-500">{subtitle}</p>}
          </div>
          <Sparkles className={`h-3.5 w-3.5 shrink-0 ${accent === "orange" ? "text-[#FF4D00]" : "text-[#00B4D8]"}`} />
        </div>
        {children}
      </div>
    </div>
  );
}

function buildTrendOption(report: SalesHistoryReport): EChartsOption {
  const labels = report.byMonth.map((m) => m.label);
  return {
    animationDuration: 900,
    animationEasing: "cubicOut",
    tooltip: TOOLTIP,
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: C.muted, fontWeight: 600 },
    },
    grid: { left: 8, right: 12, top: 40, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.muted, fontSize: 10, rotate: labels.length > 6 ? 32 : 0 },
    },
    yAxis: [
      {
        type: "value",
        splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
      },
      {
        type: "value",
        splitLine: { show: false },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
      },
    ],
    series: [
      {
        name: "Продажби",
        type: "bar",
        data: report.byMonth.map((m) => m.count),
        itemStyle: { borderRadius: [10, 10, 2, 2], color: gradOrangeV() },
        barMaxWidth: 32,
        emphasis: { itemStyle: { shadowBlur: 16, shadowColor: "rgba(255,77,0,0.35)" } },
      },
      {
        name: "Оборот €",
        type: "line",
        yAxisIndex: 1,
        smooth: 0.35,
        symbol: "circle",
        symbolSize: 8,
        data: report.byMonth.map((m) => m.revenue),
        lineStyle: { width: 3, color: C.blueDeep, shadowColor: "rgba(0,180,216,0.5)", shadowBlur: 8 },
        itemStyle: { color: C.blue, borderWidth: 3, borderColor: "#fff" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(0,180,216,0.35)" },
              { offset: 1, color: "rgba(0,119,182,0.02)" },
            ],
          },
        },
      },
    ],
  };
}

function buildPieOption(items: { label: string; count: number }[], centerValue?: string): EChartsOption {
  return {
    color: PIE_COLORS,
    animationDuration: 800,
    tooltip: PIE_TOOLTIP,
    legend: {
      bottom: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 10, color: C.muted, fontWeight: 500 },
    },
    series: [
      {
        type: "pie",
        radius: ["52%", "78%"],
        center: ["50%", "46%"],
        padAngle: 2,
        itemStyle: { borderRadius: 10, borderColor: "#fff", borderWidth: 3 },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: { shadowBlur: 20, shadowColor: "rgba(255,77,0,0.25)" },
        },
        data: items.map((i) => ({ name: i.label, value: i.count })),
      },
    ],
    ...(centerValue
      ? {
          graphic: [
            {
              type: "text",
              left: "center",
              top: "40%",
              style: { text: centerValue, fill: C.orange, fontSize: 26, fontWeight: 900 },
            },
            {
              type: "text",
              left: "center",
              top: "50%",
              style: { text: "общо", fill: C.muted, fontSize: 10, fontWeight: 600 },
            },
          ],
        }
      : {}),
  };
}

function fmtBgDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("bg-BG");
}

function buildTopClientsChart(clients: SalesReportClientRow[]): EChartsOption {
  const top10 = [...clients].slice(0, 10);
  return buildHBarOption(
    top10.map((c) => ({ name: c.name, revenue: c.revenue, count: c.count })),
    "revenue",
    "blue",
    { fullLabels: true },
  );
}

function TopClientsTable({ clients }: { clients: SalesReportClientRow[] }) {
  if (clients.length === 0) {
    return (
      <p className="py-8 text-center text-sm font-semibold text-slate-500">Няма данни за клиенти в избрания период.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="min-w-[980px] w-full text-left text-[11px]">
        <thead>
          <tr className="bg-gradient-to-r from-[#0077B6] to-[#00B4D8] text-white">
            <th className="px-2.5 py-2 font-bold">#</th>
            <th className="px-2.5 py-2 font-bold">Клиент</th>
            <th className="px-2.5 py-2 font-bold">Телефон</th>
            <th className="px-2.5 py-2 font-bold text-right">Продажби</th>
            <th className="px-2.5 py-2 font-bold text-right">Оборот</th>
            <th className="px-2.5 py-2 font-bold text-right">Марж</th>
            <th className="px-2.5 py-2 font-bold text-right">Ср. продажба</th>
            <th className="px-2.5 py-2 font-bold text-right">Дял</th>
            <th className="px-2.5 py-2 font-bold">Първа / последна</th>
            <th className="px-2.5 py-2 font-bold">Монтаж</th>
            <th className="px-2.5 py-2 font-bold">Топ марка</th>
            <th className="px-2.5 py-2 font-bold">Топ продукт</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c, idx) => (
            <tr
              key={c.key}
              className={`border-t border-slate-100 ${idx % 2 === 1 ? "bg-slate-50/80" : "bg-white"} hover:bg-[#e6f9fd]/40 transition-colors`}
            >
              <td className="px-2.5 py-2 font-black text-slate-400 tabular-nums">{idx + 1}</td>
              <td className="px-2.5 py-2 font-bold text-slate-900 whitespace-normal break-words min-w-[140px]">
                {c.name}
              </td>
              <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">{c.phone ?? "—"}</td>
              <td className="px-2.5 py-2 text-right font-bold text-slate-800 tabular-nums">{fmtNum(c.count)}</td>
              <td className="px-2.5 py-2 text-right font-black text-[#0077B6] tabular-nums">{fmtEuro(c.revenue)}</td>
              <td className="px-2.5 py-2 text-right tabular-nums">
                <span className="font-bold text-[#FF4D00]">{fmtEuro(c.margin)}</span>
                {c.marginPercent != null ? (
                  <span className="ml-1 text-[10px] font-semibold text-slate-400">({c.marginPercent}%)</span>
                ) : null}
              </td>
              <td className="px-2.5 py-2 text-right font-semibold text-slate-700 tabular-nums">{fmtEuro(c.avgSale)}</td>
              <td className="px-2.5 py-2 text-right font-bold text-slate-600 tabular-nums">{c.revenueSharePercent}%</td>
              <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">
                {fmtBgDate(c.firstSaleDate)}
                <span className="text-slate-300"> · </span>
                {fmtBgDate(c.lastSaleDate)}
              </td>
              <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">
                <span className="text-emerald-700 font-semibold">{c.completedCount}</span>
                <span className="text-slate-300"> / </span>
                <span className="text-[#0077B6] font-semibold">{c.pendingMountCount}</span>
                {c.cancelledCount > 0 ? (
                  <>
                    <span className="text-slate-300"> / </span>
                    <span className="text-red-600 font-semibold">{c.cancelledCount}</span>
                  </>
                ) : null}
              </td>
              <td className="px-2.5 py-2 text-slate-600 whitespace-normal break-words min-w-[100px]">
                {c.topBrand ?? "—"}
              </td>
              <td className="px-2.5 py-2 text-slate-600 whitespace-normal break-words min-w-[120px]">
                {c.topProduct ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildHBarOption(
  items: { name: string; revenue: number; count: number }[],
  valueKey: "revenue" | "count",
  grad: "orange" | "blue",
  options?: { fullLabels?: boolean },
): EChartsOption {
  const sorted = [...items].reverse();
  const g = grad === "orange" ? gradOrangeH() : gradBlueH();
  const fullLabels = options?.fullLabels === true;
  return {
    animationDuration: 800,
    tooltip: {
      ...PIE_TOOLTIP,
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(0,180,216,0.08)" } },
      formatter: (params: unknown) => {
        const p = (Array.isArray(params) ? params[0] : params) as { dataIndex?: number };
        const row = sorted[p?.dataIndex ?? 0];
        if (!row) return "";
        return `<span style="font-weight:800;color:${C.ink}">${row.name}</span><br/>${
          valueKey === "revenue"
            ? `<span style="color:${C.orange};font-weight:700">${fmtEuro(row.revenue)}</span>`
            : `<span style="color:${C.blueDeep};font-weight:700">${row.count} бр.</span>`
        }<br/><span style="color:#94a3b8">${row.count} продажби</span>`;
      },
    },
    grid: { left: fullLabels ? 12 : 4, right: 20, top: 8, bottom: 4, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 },
    },
    yAxis: {
      type: "category",
      data: sorted.map((i) => i.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: fullLabels
        ? { color: "#475569", fontSize: 10, overflow: "none" }
        : { color: "#475569", fontSize: 10, width: 92, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: sorted.map((i) => (valueKey === "revenue" ? i.revenue : i.count)),
        itemStyle: { borderRadius: [0, 10, 10, 0], color: g },
        barMaxWidth: 20,
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,119,182,0.3)" } },
      },
    ],
  };
}

function buildRevenuePurchaseOption(report: SalesHistoryReport): EChartsOption {
  const labels = report.revenueVsPurchaseMonthly.map((m) => m.label);
  return {
    animationDuration: 900,
    tooltip: TOOLTIP,
    legend: { top: 0, right: 0, textStyle: { fontSize: 10, fontWeight: 600, color: C.muted } },
    grid: { left: 8, right: 12, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.muted, fontSize: 10, rotate: labels.length > 5 ? 28 : 0 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 },
    },
    series: [
      {
        name: "Оборот",
        type: "bar",
        data: report.revenueVsPurchaseMonthly.map((m) => m.revenue),
        itemStyle: { borderRadius: [8, 8, 2, 2], color: gradOrangeV() },
        barMaxWidth: 28,
      },
      {
        name: "Доставна",
        type: "bar",
        data: report.revenueVsPurchaseMonthly.map((m) => m.purchase),
        itemStyle: { borderRadius: [8, 8, 2, 2], color: gradBlueH() },
        barMaxWidth: 28,
      },
      {
        name: "Марж",
        type: "line",
        smooth: 0.35,
        data: report.byMonth.map((m) => m.margin),
        lineStyle: {
          width: 3,
          color: C.orange,
          type: "dashed",
        },
        itemStyle: { color: C.orange, borderWidth: 2, borderColor: "#fff" },
        symbolSize: 7,
      },
    ],
  };
}

function buildPriceBucketsOption(report: SalesHistoryReport): EChartsOption {
  return {
    animationDuration: 800,
    tooltip: PIE_TOOLTIP,
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: report.priceBuckets.map((b) => b.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.muted, fontSize: 9 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 },
    },
    series: [
      {
        type: "bar",
        data: report.priceBuckets.map((b, i) => ({
          value: b.count,
          itemStyle: {
            borderRadius: [10, 10, 2, 2],
            color: i % 2 === 0 ? gradOrangeV() : gradBlueH(),
          },
        })),
        barMaxWidth: 40,
      },
    ],
  };
}

function buildMarginGauge(marginPercent: number | null): EChartsOption {
  const v = marginPercent ?? 0;
  return {
    animationDuration: 1200,
    series: [
      {
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 60,
        splitNumber: 4,
        radius: "92%",
        center: ["50%", "56%"],
        axisLine: {
          lineStyle: {
            width: 16,
            color: [[1, "#e2e8f0"]],
          },
        },
        progress: {
          show: true,
          width: 16,
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 1,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: C.orangeLight },
                { offset: 0.5, color: C.orangeMid },
                { offset: 1, color: C.orange },
              ],
            },
          },
        },
        pointer: {
          show: true,
          length: "55%",
          width: 6,
          itemStyle: {
            color: C.orange,
            shadowBlur: 8,
            shadowColor: "rgba(255,77,0,0.4)",
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: "#94a3b8", fontSize: 9, distance: -36 },
        detail: {
          valueAnimation: true,
          formatter: marginPercent != null ? "{value}%" : "—",
          fontSize: 28,
          fontWeight: 900,
          color: C.orange,
          offsetCenter: [0, "28%"],
        },
        data: [{ value: Math.min(60, Math.max(0, v)) }],
      },
    ],
  };
}

export function SalesHistoryReportPanel({
  open,
  onClose,
  queryString,
  sectionLabel,
  filtersHint,
  generateToken,
}: {
  open: boolean;
  onClose: () => void;
  queryString: string;
  sectionLabel: string;
  filtersHint: string;
  /** Увеличи стойността, за да се генерира/презареди отчетът. */
  generateToken: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SalesHistoryReport | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisGeneratedAt, setAnalysisGeneratedAt] = useState<string | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  const reportDateRange = useMemo(() => {
    const sp = new URLSearchParams(queryString);
    return {
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    };
  }, [queryString]);

  const analysisProfile = useMemo(() => {
    const stubReport = report ?? ({ byMonth: [] } as Pick<SalesHistoryReport, "byMonth">);
    return inferAnalysisProfile({
      report: stubReport as SalesHistoryReport,
      filtersHint,
      dateFrom: reportDateRange.from,
      dateTo: reportDateRange.to,
    });
  }, [report, filtersHint, reportDateRange.from, reportDateRange.to]);

  useEffect(() => {
    const cached = loadSalesReportAnalysisCache(queryString);
    if (cached) {
      setAnalysisText(cached.text);
      setAnalysisGeneratedAt(cached.generatedAt);
      setAnalysisError(null);
    } else {
      setAnalysisText(null);
      setAnalysisGeneratedAt(null);
      setAnalysisError(null);
    }
  }, [queryString]);

  const exportPdf = useCallback(async () => {
    setPdfExporting(true);
    try {
      const reportParams = Object.fromEntries(new URLSearchParams(queryString).entries());
      const res = await fetch("/api/admin/work-items/sales-report/pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...reportParams,
          sectionLabel,
          filtersHint,
          generatedAt: generatedAt ?? undefined,
          aiAnalysis: analysisText?.trim() || undefined,
          aiAnalysisGeneratedAt: analysisGeneratedAt ?? undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || "Грешка при PDF експорт");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `otchet-prodazhbi-${stamp}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setPdfExporting(false);
    }
  }, [queryString, sectionLabel, filtersHint, generatedAt, analysisText, analysisGeneratedAt]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/sales-report?${queryString}`, { credentials: "include" });
      const json = await res.json();
      if (!json.data) throw new Error((json as { error?: string }).error || "Грешка при зареждане на отчета");
      setReport(json.data as SalesHistoryReport);
      setGeneratedAt(new Date().toLocaleString("bg-BG"));
      setExpanded(true);
      const cached = loadSalesReportAnalysisCache(queryString);
      if (cached) {
        setAnalysisText(cached.text);
        setAnalysisGeneratedAt(cached.generatedAt);
      }
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const generateAnalysis = useCallback(async () => {
    if (!report || report.summary.saleCount === 0) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/admin/work-items/sales-report/analysis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report,
          sectionLabel,
          filtersHint,
          dateFrom: reportDateRange.from,
          dateTo: reportDateRange.to,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при AI анализ");
      const text = String((json as { data?: { text?: string } }).data?.text ?? "").trim();
      if (!text) throw new Error("AI не върна текст");
      const at = new Date().toLocaleString("bg-BG");
      setAnalysisText(text);
      setAnalysisGeneratedAt(at);
      saveSalesReportAnalysisCache(queryString, text, at);
    } catch (e: unknown) {
      setAnalysisError(String(e instanceof Error ? e.message : e));
      setAnalysisText(null);
    } finally {
      setAnalysisLoading(false);
    }
  }, [report, sectionLabel, filtersHint, queryString, reportDateRange.from, reportDateRange.to]);

  useEffect(() => {
    if (!open || generateToken <= 0) return;
    void fetchReport();
  }, [open, generateToken, fetchReport]);

  const chartOptions = useMemo(() => {
    if (!report) return null;
    return {
      trend: buildTrendOption(report),
      mount: buildPieOption(report.byMountPhase, fmtNum(report.summary.saleCount)),
      status: buildPieOption(report.byOperationalStatus),
      suppliers: buildHBarOption(report.bySupplier, "revenue", "blue"),
      brands: buildHBarOption(report.byBrand, "revenue", "orange"),
      products: buildHBarOption(report.byProduct, "count", "blue", { fullLabels: true }),
      revPurchase: buildRevenuePurchaseOption(report),
      buckets: buildPriceBucketsOption(report),
      marginGauge: buildMarginGauge(report.summary.marginPercent),
      topClients: buildTopClientsChart(report.topClients),
    };
  }, [report]);

  if (!open) return null;

  const s = report?.summary;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/60 shadow-[0_24px_64px_rgba(0,119,182,0.12),0_8px_32px_rgba(255,77,0,0.06)]">
      {/* Mesh background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,#e6f9fd_0%,transparent_50%),radial-gradient(ellipse_at_100%_0%,#fff3ed_0%,transparent_45%),radial-gradient(ellipse_at_50%_100%,#f8fafc_0%,#ffffff_70%)]" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#FF4D00]/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#00B4D8]/10 blur-3xl" />

      {/* Header */}
      <div className="relative border-b border-white/70 bg-white/50 px-4 py-4 backdrop-blur-md md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] p-[1px] shadow-lg shadow-[#FF4D00]/25">
              <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white/95">
                <BarChart3 className="h-6 w-6 text-[#FF4D00]" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-base font-black tracking-tight md:text-lg">
                <span className="bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] bg-clip-text text-transparent">
                  Аналитичен
                </span>{" "}
                <span className="bg-gradient-to-r from-[#0077B6] via-[#00B4D8] to-[#2cc1e6] bg-clip-text text-transparent">
                  отчет
                </span>
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-600">{sectionLabel}</p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{filtersHint}</p>
              {generatedAt && report && (
                <p className="mt-1 text-[10px] font-bold text-[#0077B6]">
                  {fmtNum(report.totalMatching)} продажби
                  {report.truncated ? ` · анализирани ${fmtNum(report.sampledCount)}` : ""}
                  {" · "}
                  {generatedAt}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {report && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 border-[#FF4D00]/25 bg-white/80 text-[#FF4D00] hover:bg-[#fff3ed]"
                  disabled={loading || pdfExporting}
                  onClick={() => void exportPdf()}
                >
                  <FileDown className={`h-3.5 w-3.5 ${pdfExporting ? "animate-pulse" : ""}`} />
                  {pdfExporting ? "PDF…" : "PDF"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 border-[#00B4D8]/30 bg-white/80 text-[#0077B6] hover:bg-[#e6f9fd]"
                  disabled={loading}
                  onClick={() => void fetchReport()}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Обнови
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-500 transition hover:border-[#00B4D8]/40 hover:text-[#0077B6]"
              title={expanded ? "Свий съдържанието" : "Разгъни"}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-500 transition hover:border-[#FF4D00]/40 hover:text-[#FF4D00]"
              title="Затвори отчета"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="relative px-3 pb-5 pt-4 md:px-5 md:pb-6">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="relative h-14 w-14">
                <div className="absolute inset-0 animate-spin rounded-full bg-gradient-to-r from-[#0077B6] to-[#00B4D8] opacity-30 blur-sm" />
                <div className="absolute inset-1 flex items-center justify-center rounded-full bg-white">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0077B6]" />
                </div>
              </div>
              <p className="text-sm font-bold text-[#0077B6]">Генериране на отчета…</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-[#FF4D00]/25 bg-gradient-to-r from-[#fff3ed] to-white px-4 py-3 text-sm font-semibold text-[#c63b00]">
              {error}
            </div>
          )}

          {!loading && !error && !report && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <BarChart3 className="h-12 w-12 text-[#00B4D8]/40" />
              <p className="text-sm font-semibold text-slate-600">Натиснете „Създай отчет“ за генериране.</p>
            </div>
          )}

          {!loading && !error && report && s && chartOptions && (
            <div className="space-y-4">
              {report.truncated && (
                <p className="rounded-2xl border border-[#FF6A00]/25 bg-[#fff3ed]/90 px-4 py-2.5 text-[11px] font-semibold text-slate-700">
                  Статистика за първите {fmtNum(report.sampledCount)} от {fmtNum(report.totalMatching)} продажби по избраните критерии.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8 md:gap-2.5">
                <KpiCard label="Продажби" value={fmtNum(s.saleCount)} icon={<ShoppingBag className="h-4 w-4" />} variant="orange" />
                <KpiCard label="Оборот" value={fmtEuro(s.totalRevenue)} sub={`ср. ${fmtEuro(s.avgSale)}`} icon={<TrendingUp className="h-4 w-4" />} variant="blue" />
                <KpiCard label="Доставна" value={fmtEuro(s.totalPurchase)} sub={s.avgPurchase != null ? `ср. ${fmtEuro(s.avgPurchase)}` : undefined} icon={<Wallet className="h-4 w-4" />} variant="blue" />
                <KpiCard label="Марж" value={fmtEuro(s.totalMargin)} sub={s.marginPercent != null ? `${s.marginPercent}%` : undefined} icon={<Percent className="h-4 w-4" />} variant="orange" />
                <KpiCard label="Клиенти" value={fmtNum(s.uniqueCustomers)} icon={<Users className="h-4 w-4" />} variant="blue" />
                <KpiCard label="Завършени" value={fmtNum(s.completedMountCount)} icon={<CheckCircle2 className="h-4 w-4" />} variant="orange" />
                <KpiCard label="Чака монтаж" value={fmtNum(s.pendingMountCount)} icon={<Clock className="h-4 w-4" />} variant="blue" />
                <KpiCard label="Отказани" value={fmtNum(s.cancelledCount)} icon={<XCircle className="h-4 w-4" />} variant="orange" />
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <ChartCard title="Тренд по месеци" subtitle="Брой продажби и оборот €" accent="orange" className="xl:col-span-2">
                  <ReactECharts option={chartOptions.trend} style={{ height: 300 }} opts={{ renderer: "svg" }} />
                </ChartCard>
                <ChartCard title="Марж" subtitle="Процент от оборота" accent="blue">
                  <ReactECharts option={chartOptions.marginGauge} style={{ height: 300 }} opts={{ renderer: "svg" }} />
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ChartCard title="Статус монтаж" accent="orange">
                  <ReactECharts option={chartOptions.mount} style={{ height: 268 }} opts={{ renderer: "svg" }} />
                </ChartCard>
                <ChartCard title="Оперативен статус" accent="blue">
                  <ReactECharts option={chartOptions.status} style={{ height: 268 }} opts={{ renderer: "svg" }} />
                </ChartCard>
                <ChartCard title="Ценови диапазони" subtitle="Продажна цена" accent="orange">
                  <ReactECharts option={chartOptions.buckets} style={{ height: 268 }} opts={{ renderer: "svg" }} />
                </ChartCard>
                <ChartCard title="Обобщение" subtitle="Ключови показатели" accent="blue">
                  <div className="flex h-[268px] flex-col justify-center gap-2.5">
                    <div className="rounded-xl border border-slate-100 bg-gradient-to-r from-white to-[#f8fafc] px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Мин. / макс.</p>
                      <p className="mt-1 font-black text-slate-900">
                        {fmtEuro(s.minSale)} – {fmtEuro(s.maxSale)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#00B4D8]/20 bg-gradient-to-br from-[#e6f9fd]/80 to-white px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#0077B6]">С фактура</p>
                      <p className="mt-1 font-black text-[#0077B6]">
                        {fmtNum(s.withInvoiceData)} <span className="text-xs font-semibold opacity-70">/ {fmtNum(s.saleCount)}</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#FF4D00]/20 bg-gradient-to-br from-[#fff3ed]/90 to-white px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#FF4D00]">С доставна</p>
                      <p className="mt-1 font-black text-[#FF4D00]">
                        {fmtNum(s.withPurchaseData)} <span className="text-xs font-semibold opacity-70">/ {fmtNum(s.saleCount)}</span>
                      </p>
                    </div>
                  </div>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <ChartCard title="Оборот · доставна · марж" subtitle="По месеци" accent="blue">
                  <ReactECharts option={chartOptions.revPurchase} style={{ height: 290 }} opts={{ renderer: "svg" }} />
                </ChartCard>
                <ChartCard title="Топ доставчици" subtitle="По оборот €" accent="orange">
                  <ReactECharts option={chartOptions.suppliers} style={{ height: 290 }} opts={{ renderer: "svg" }} />
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ChartCard title="Топ марки" subtitle="По оборот €" accent="blue">
                  <ReactECharts option={chartOptions.brands} style={{ height: 290 }} opts={{ renderer: "svg" }} />
                </ChartCard>
                <ChartCard title="Топ продукти" subtitle="По брой продажби" accent="orange" className="md:col-span-2 xl:col-span-2">
                  <ReactECharts option={chartOptions.products} style={{ height: 290 }} opts={{ renderer: "svg" }} />
                </ChartCard>
              </div>

              <ChartCard
                title="Топ 20 клиенти"
                subtitle={
                  s.topClientsRevenueSharePercent != null
                    ? `По оборот € · топ 20 = ${fmtEuro(s.topClientsRevenue)} (${s.topClientsRevenueSharePercent}% от оборота)`
                    : "По оборот € · детайлна статистика"
                }
                accent="blue"
              >
                <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-xl border border-[#00B4D8]/20 bg-gradient-to-br from-[#e6f9fd]/80 to-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#0077B6]">Клиенти в топ 20</p>
                    <p className="mt-1 font-black text-[#0077B6]">{fmtNum(report.topClients.length)}</p>
                  </div>
                  <div className="rounded-xl border border-[#FF4D00]/20 bg-gradient-to-br from-[#fff3ed]/90 to-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#FF4D00]">Оборот топ 20</p>
                    <p className="mt-1 font-black text-[#FF4D00]">{fmtEuro(s.topClientsRevenue)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Дял от оборота</p>
                    <p className="mt-1 font-black text-slate-900">
                      {s.topClientsRevenueSharePercent != null ? `${s.topClientsRevenueSharePercent}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Уникални клиенти</p>
                    <p className="mt-1 font-black text-slate-900">{fmtNum(s.uniqueCustomers)}</p>
                  </div>
                </div>

                {report.topClients.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Топ 10 по оборот</p>
                    <ReactECharts
                      option={chartOptions.topClients}
                      style={{ height: Math.max(300, Math.min(report.topClients.length, 10) * 36) }}
                      opts={{ renderer: "svg" }}
                    />
                  </div>
                )}

                <p className="mb-2 text-[10px] font-semibold text-slate-500">
                  Монтаж: <span className="text-emerald-700">завършени</span> / <span className="text-[#0077B6]">чакащи</span> / <span className="text-red-600">отказани</span>
                </p>
                <TopClientsTable clients={report.topClients} />
              </ChartCard>

              <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_8px_32px_rgba(0,119,182,0.06)] backdrop-blur-sm">
                <BrandSplitStripe />
                <div className="p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-800">
                        AI аналитичен текст
                      </p>
                      <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">
                        {analysisSubtitleHint(analysisProfile)}
                      </p>
                      {analysisGeneratedAt ? (
                        <p className="mt-1 text-[10px] font-semibold text-[#0077B6]">Генериран: {analysisGeneratedAt}</p>
                      ) : null}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5 border-[#FF4D00]/25 bg-gradient-to-r from-[#fff3ed] to-white text-[#FF4D00] hover:bg-[#fff3ed]"
                      disabled={analysisLoading || loading}
                      onClick={() => void generateAnalysis()}
                    >
                      {analysisLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {analysisLoading ? "Генериране…" : analysisText ? "Прегенерирай анализ" : "Генерирай AI анализ"}
                    </Button>
                  </div>

                  {analysisError ? (
                    <div className="mt-4 rounded-xl border border-[#FF4D00]/25 bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#c63b00]">
                      {analysisError}
                    </div>
                  ) : null}

                  {!analysisText && !analysisLoading && !analysisError ? (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
                      <Sparkles className="mx-auto h-8 w-8 text-[#FF4D00]/35" />
                      <p className="mt-2 text-sm font-semibold text-slate-600">{analysisEmptyHint(analysisProfile)}</p>
                    </div>
                  ) : null}

                  {analysisLoading ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#00B4D8]/20 bg-[#e6f9fd]/50 px-4 py-6">
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#0077B6]" />
                      <p className="text-sm font-semibold text-[#0077B6]">{analysisLoadingMessage(analysisProfile)}</p>
                    </div>
                  ) : null}

                  {analysisText && !analysisLoading ? (
                    <div className="prose prose-sm prose-slate mt-4 max-w-none rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 px-4 py-4 md:px-5 md:py-5 prose-headings:font-black prose-headings:tracking-tight prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-base prose-h2:text-[#0077B6] prose-p:leading-relaxed prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                        {analysisText}
                      </ReactMarkdown>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {!loading && !error && report && s?.saleCount === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Package className="h-10 w-10 text-[#00B4D8]/35" />
              <p className="text-sm font-semibold text-slate-600">Няма продажби за избраните филтри и период.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
