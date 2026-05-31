/**
 * PDF — аналитичен отчет по продажби (СМОЛЯНКЛИМА admin).
 */
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font, Svg, Rect, Defs, LinearGradient, Stop } from "@react-pdf/renderer";
import { ProtocolPdfBrandMark } from "@/lib/protocol-pdf-brand";
import type { SalesHistoryReport } from "@/lib/admin/computeSalesHistoryReport";
import {
  CHART,
  ComboTrendChart,
  DonutChart,
  GroupedBarChart,
  HorizontalBarChart,
  MarginGauge,
  PDF_FONT,
  shortMonthLabel,
  VerticalBarChart,
} from "@/lib/sales-history-report-pdf-charts";
import { SalesReportAiAnalysisPdf } from "@/lib/sales-history-report-pdf-ai";

const NOTO_REG =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const NOTO_BOLD =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf";

Font.register({
  family: PDF_FONT,
  fonts: [
    { src: NOTO_REG, fontWeight: "normal" },
    { src: NOTO_BOLD, fontWeight: "bold" },
  ],
});

const BR = CHART;
const PAD_X = 26;
const PAD_TOP = 20;
const PAD_BOTTOM = 28;
const FOOTER_H = 18;
const CONTENT_H = 842 - PAD_TOP - PAD_BOTTOM;
const chartW = 595 - PAD_X * 2 - 16;

function fmtEuro(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("bg-BG").format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    fontSize: 8,
    paddingTop: PAD_TOP,
    paddingBottom: PAD_BOTTOM,
    paddingHorizontal: PAD_X,
    color: BR.ink,
    position: "relative",
  },
  topStripe: { position: "absolute", top: 0, left: 0, right: 0, height: 5 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: BR.grid,
  },
  heroHeader: {
    marginBottom: 5,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: BR.grid,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  headerMetaBlock: { alignItems: "flex-end" },
  headerMetaLine: { marginBottom: 2 },
  heroTitle: {
    fontFamily: PDF_FONT,
    fontSize: 13,
    fontWeight: "bold",
    color: BR.orange,
    lineHeight: 1.35,
  },
  heroSub: {
    fontFamily: PDF_FONT,
    fontSize: 8.5,
    fontWeight: "bold",
    color: BR.blue,
    textAlign: "right",
    lineHeight: 1.35,
  },
  heroMeta: {
    fontFamily: PDF_FONT,
    fontSize: 7,
    color: BR.muted,
    textAlign: "right",
    lineHeight: 1.35,
  },
  heroMetaBold: {
    fontFamily: PDF_FONT,
    fontSize: 7,
    fontWeight: "bold",
    color: BR.ink,
    textAlign: "right",
    lineHeight: 1.35,
  },
  miniHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BR.grid,
  },
  miniTitle: { fontFamily: PDF_FONT, fontSize: 11, fontWeight: "bold", color: BR.blue },
  miniMeta: { fontFamily: PDF_FONT, fontSize: 7, color: BR.muted, textAlign: "right", maxWidth: "55%" },
  kpiRow: { flexDirection: "row", gap: 3, marginBottom: 3 },
  kpiCard: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: BR.grid,
    overflow: "hidden",
  },
  kpiAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  kpiOrange: { backgroundColor: BR.orangePale },
  kpiBlue: { backgroundColor: BR.bluePale },
  kpiLabel: { fontFamily: PDF_FONT, fontSize: 5.5, color: BR.muted, textTransform: "uppercase", marginBottom: 2 },
  kpiValue: { fontFamily: PDF_FONT, fontSize: 10, fontWeight: "bold", color: BR.ink },
  kpiSub: { fontFamily: PDF_FONT, fontSize: 6, color: BR.muted, marginTop: 1 },
  statStrip: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: BR.orangePale,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: "#ffd4bc",
    marginBottom: 5,
  },
  statItem: { flex: 1, alignItems: "center" },
  statLabel: { fontFamily: PDF_FONT, fontSize: 5.5, color: BR.muted, marginBottom: 1 },
  statValue: { fontFamily: PDF_FONT, fontSize: 8.5, fontWeight: "bold", color: BR.ink },
  chartCard: {
    borderWidth: 0.5,
    borderColor: BR.grid,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 7,
    backgroundColor: "#fcfdfe",
    marginBottom: 3,
  },
  chartTitle: { fontFamily: PDF_FONT, fontSize: 8.5, fontWeight: "bold", color: BR.blue, marginBottom: 1 },
  chartSubtitle: { fontFamily: PDF_FONT, fontSize: 6.5, color: BR.muted, marginBottom: 3 },
  row: { flexDirection: "row", gap: 4, marginBottom: 3 },
  col: { flex: 1 },
  colWide: { flex: 1.3 },
  colNarrow: { flex: 0.75 },
  notice: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    backgroundColor: "#fff8f4",
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#ffd4bc",
    fontFamily: PDF_FONT,
    fontSize: 6.5,
    color: BR.ink,
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 12,
    left: PAD_X,
    right: PAD_X,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BR.grid,
    paddingTop: 4,
    height: FOOTER_H,
  },
  footerText: { fontFamily: PDF_FONT, fontSize: 6.5, color: BR.muted },
  footerBrand: { fontFamily: PDF_FONT, fontSize: 6.5, fontWeight: "bold", color: BR.orange },
  tableMini: { marginTop: 1 },
  tableRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: BR.grid },
  tableRowDense: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 1, borderBottomWidth: 0.5, borderBottomColor: BR.grid },
  tableHead: { backgroundColor: BR.blue, paddingVertical: 3, paddingHorizontal: 3, borderRadius: 3, marginBottom: 1 },
  tableHeadDense: { backgroundColor: BR.blue, paddingVertical: 2, paddingHorizontal: 3, borderRadius: 3, marginBottom: 1 },
  tableHeadText: { fontFamily: PDF_FONT, fontSize: 6.5, fontWeight: "bold", color: BR.white },
  tableHeadTextDense: { fontFamily: PDF_FONT, fontSize: 6, fontWeight: "bold", color: BR.white },
  tableCell: { fontFamily: PDF_FONT, fontSize: 6.5, color: BR.ink },
  tableCellDense: { fontFamily: PDF_FONT, fontSize: 6, color: BR.ink, lineHeight: 1.25 },
});

type Props = {
  report: SalesHistoryReport;
  sectionLabel?: string;
  filtersHint?: string;
  generatedAt?: string;
  aiAnalysis?: string;
  aiAnalysisGeneratedAt?: string;
};

function PageStripe() {
  return (
    <View style={s.topStripe} fixed>
      <Svg width="595" height="5" viewBox="0 0 595 5">
        <Defs>
          <LinearGradient id="pdfStripeOrange" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={BR.orange} />
            <Stop offset="100%" stopColor={BR.orangeMid} />
          </LinearGradient>
          <LinearGradient id="pdfStripeBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={BR.blue} />
            <Stop offset="100%" stopColor={BR.blueLight} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="297.5" height="5" fill="url(#pdfStripeOrange)" />
        <Rect x="297.5" y="0" width="297.5" height="5" fill="url(#pdfStripeBlue)" />
      </Svg>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerBrand}>СМОЛЯНКЛИМА</Text>
      <Text style={s.footerText}>Аналитичен отчет по продажби</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={s.sectionHeader} minPresenceAhead={60}>
      <Text style={s.miniTitle}>{title}</Text>
      {meta ? <Text style={s.miniMeta}>{meta}</Text> : null}
    </View>
  );
}

/** Динамична височина на тренд графиката — запълва страницата без фиксирани празнини. */
function trendChartHeight(monthCount: number): number {
  const base = monthCount <= 3 ? 118 : monthCount <= 6 ? 138 : monthCount <= 12 ? 158 : 172;
  return Math.min(base, Math.round(CONTENT_H * 0.24));
}

function KpiCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  variant: "orange" | "blue";
}) {
  return (
    <View style={[s.kpiCard, variant === "orange" ? s.kpiOrange : s.kpiBlue]}>
      <View style={[s.kpiAccent, { backgroundColor: variant === "orange" ? BR.orange : BR.blueLight }]} />
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>{title}</Text>
      {subtitle ? <Text style={s.chartSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function MiniMonthTable({
  rows,
}: {
  rows: Array<{ label: string; count: number; revenue: number; margin: number }>;
}) {
  if (rows.length === 0) return null;
  return (
    <View style={s.tableMini}>
      <View style={[s.tableRow, s.tableHead]}>
        <Text style={[s.tableHeadText, { width: "28%" }]}>Месец</Text>
        <Text style={[s.tableHeadText, { width: "16%" }]}>Брой</Text>
        <Text style={[s.tableHeadText, { width: "28%" }]}>Оборот</Text>
        <Text style={[s.tableHeadText, { width: "28%" }]}>Марж</Text>
      </View>
      {rows.map((r, i) => (
        <View key={r.label} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: "#f8fafc" } : {}]}>
          <Text style={[s.tableCell, { width: "28%", fontWeight: "bold" }]}>{r.label}</Text>
          <Text style={[s.tableCell, { width: "16%" }]}>{fmtNum(r.count)}</Text>
          <Text style={[s.tableCell, { width: "28%" }]}>{fmtEuro(r.revenue)}</Text>
          <Text style={[s.tableCell, { width: "28%" }]}>{fmtEuro(r.margin)}</Text>
        </View>
      ))}
    </View>
  );
}

function fmtBgDatePdf(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("bg-BG");
}

/** Фиксирани ширини (pt) — сума ≈ ширината на A4 съдържанието. */
const CLIENT_COL = {
  rank: 14,
  name: 108,
  phone: 68,
  count: 20,
  revenue: 46,
  margin: 42,
  share: 24,
  period: 62,
  mount: 34,
  extra: 121,
} as const;

function TopClientsSummaryStrip({ report, sum }: { report: SalesHistoryReport; sum: SalesHistoryReport["summary"] }) {
  return (
    <View style={s.statStrip}>
      <View style={s.statItem}>
        <Text style={s.statLabel}>Клиенти топ 20</Text>
        <Text style={s.statValue}>{fmtNum(report.topClients.length)}</Text>
      </View>
      <View style={s.statItem}>
        <Text style={s.statLabel}>Уникални общо</Text>
        <Text style={s.statValue}>{fmtNum(sum.uniqueCustomers)}</Text>
      </View>
      <View style={s.statItem}>
        <Text style={s.statLabel}>Оборот топ 20</Text>
        <Text style={s.statValue}>{fmtEuro(sum.topClientsRevenue)}</Text>
      </View>
      <View style={s.statItem}>
        <Text style={s.statLabel}>Дял от оборота</Text>
        <Text style={s.statValue}>{fmtPct(sum.topClientsRevenueSharePercent)}</Text>
      </View>
    </View>
  );
}

function TopClientsTablePdf({ clients }: { clients: SalesHistoryReport["topClients"] }) {
  if (clients.length === 0) {
    return <Text style={s.tableCellDense}>Няма данни за клиенти в избрания период.</Text>;
  }

  const head = (label: string, width: number) => (
    <Text style={[s.tableHeadTextDense, { width }]}>{label}</Text>
  );
  const cell = (width: number, content: string, bold = false) => (
    <Text style={[s.tableCellDense, { width }, bold ? { fontWeight: "bold" } : {}]}>{content}</Text>
  );

  return (
    <View style={s.tableMini}>
      <View style={[s.tableRowDense, s.tableHeadDense]}>
        {head("#", CLIENT_COL.rank)}
        {head("Клиент", CLIENT_COL.name)}
        {head("Телефон", CLIENT_COL.phone)}
        {head("Бр.", CLIENT_COL.count)}
        {head("Оборот", CLIENT_COL.revenue)}
        {head("Марж", CLIENT_COL.margin)}
        {head("Дял", CLIENT_COL.share)}
        {head("Период", CLIENT_COL.period)}
        {head("Монт.", CLIENT_COL.mount)}
        {head("Марка / продукт", CLIENT_COL.extra)}
      </View>
      {clients.map((c, i) => {
        const period =
          c.firstSaleDate === c.lastSaleDate
            ? fmtBgDatePdf(c.firstSaleDate)
            : `${fmtBgDatePdf(c.firstSaleDate)} – ${fmtBgDatePdf(c.lastSaleDate)}`;
        const mount = `${c.completedCount}/${c.pendingMountCount}${c.cancelledCount > 0 ? `/${c.cancelledCount}` : ""}`;
        const marginText =
          c.marginPercent != null ? `${fmtEuro(c.margin)} (${c.marginPercent}%)` : fmtEuro(c.margin);
        const extra = [c.topBrand, c.topProduct].filter(Boolean).join(" · ") || "—";

        return (
          <View key={c.key} style={[s.tableRowDense, i % 2 === 1 ? { backgroundColor: "#f8fafc" } : {}]}>
            {cell(CLIENT_COL.rank, String(i + 1))}
            {cell(CLIENT_COL.name, c.name, true)}
            {cell(CLIENT_COL.phone, c.phone ?? "—")}
            {cell(CLIENT_COL.count, fmtNum(c.count))}
            {cell(CLIENT_COL.revenue, fmtEuro(c.revenue))}
            {cell(CLIENT_COL.margin, marginText)}
            {cell(CLIENT_COL.share, `${c.revenueSharePercent}%`)}
            {cell(CLIENT_COL.period, period)}
            {cell(CLIENT_COL.mount, mount)}
            {cell(CLIENT_COL.extra, extra)}
          </View>
        );
      })}
    </View>
  );
}

export function SalesHistoryReportPDF({
  report,
  sectionLabel = "История на продажби",
  filtersHint = "Без допълнителни филтри",
  generatedAt,
  aiAnalysis,
  aiAnalysisGeneratedAt,
}: Props) {
  const sum = report.summary;
  const now =
    generatedAt ??
    new Date().toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" });

  const hasTopClients = report.topClients.length > 0;
  const hasAiAnalysis = Boolean(aiAnalysis?.trim());

  const monthShortLabels = report.byMonth.map((m) => shortMonthLabel(m.month));
  const monthCounts = report.byMonth.map((m) => m.count);
  const monthRevenues = report.byMonth.map((m) => m.revenue);
  const revShortLabels = report.revenueVsPurchaseMonthly.map((m) => shortMonthLabel(m.month));
  const revSeries = report.revenueVsPurchaseMonthly.map((m) => m.revenue);
  const purchaseSeries = report.revenueVsPurchaseMonthly.map((m) => m.purchase);

  const mountSlices = report.byMountPhase.map((x) => ({ label: x.label, value: x.count }));
  const statusSlices = report.byOperationalStatus.map((x) => ({ label: x.label, value: x.count }));
  const top10Clients = report.topClients.slice(0, 10);
  const trendH = trendChartHeight(report.byMonth.length);

  return (
    <Document title="Аналитичен отчет по продажби" author="СМОЛЯНКЛИМА">
      <Page size="A4" style={s.page} wrap>
        <PageStripe />
        <PageFooter />

        <View style={s.heroHeader}>
          <View style={s.headerTopRow}>
            <ProtocolPdfBrandMark />
            <Text style={s.heroTitle}>Аналитичен отчет</Text>
          </View>
          <View style={s.headerMetaBlock}>
            <View style={s.headerMetaLine}>
              <Text style={s.heroSub}>{sectionLabel}</Text>
            </View>
            <View style={s.headerMetaLine}>
              <Text style={s.heroMeta}>{filtersHint}</Text>
            </View>
            <View style={s.headerMetaLine}>
              <Text style={s.heroMetaBold}>
                {fmtNum(report.totalMatching)} продажби
                {report.truncated ? ` · изборка ${fmtNum(report.sampledCount)}` : ""}
              </Text>
            </View>
            <View style={s.headerMetaLine}>
              <Text style={s.heroMeta}>Генериран: {now}</Text>
            </View>
          </View>
        </View>

        {report.truncated ? (
          <Text style={s.notice}>
            Статистика за първите {fmtNum(report.sampledCount)} от {fmtNum(report.totalMatching)} продажби.
          </Text>
        ) : null}

        <View style={s.kpiRow}>
          <KpiCard label="Продажби" value={fmtNum(sum.saleCount)} variant="orange" />
          <KpiCard label="Оборот" value={fmtEuro(sum.totalRevenue)} sub={`ср. ${fmtEuro(sum.avgSale)}`} variant="blue" />
          <KpiCard
            label="Доставна"
            value={fmtEuro(sum.totalPurchase)}
            sub={sum.avgPurchase != null ? `ср. ${fmtEuro(sum.avgPurchase)}` : undefined}
            variant="blue"
          />
          <KpiCard label="Марж" value={fmtEuro(sum.totalMargin)} sub={fmtPct(sum.marginPercent)} variant="orange" />
        </View>
        <View style={s.kpiRow}>
          <KpiCard label="Клиенти" value={fmtNum(sum.uniqueCustomers)} variant="blue" />
          <KpiCard label="Завършени" value={fmtNum(sum.completedMountCount)} variant="orange" />
          <KpiCard label="Чака монтаж" value={fmtNum(sum.pendingMountCount)} variant="blue" />
          <KpiCard label="Отказани" value={fmtNum(sum.cancelledCount)} variant="orange" />
        </View>

        <View style={s.statStrip}>
          <View style={s.statItem}>
            <Text style={s.statLabel}>С фактура</Text>
            <Text style={s.statValue}>{fmtNum(sum.withInvoiceData)}</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statLabel}>С доставна</Text>
            <Text style={s.statValue}>{fmtNum(sum.withPurchaseData)}</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statLabel}>Мин. продажба</Text>
            <Text style={s.statValue}>{fmtEuro(sum.minSale)}</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statLabel}>Макс. продажба</Text>
            <Text style={s.statValue}>{fmtEuro(sum.maxSale)}</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statLabel}>Ср. марж / бр.</Text>
            <Text style={s.statValue}>{sum.avgMargin != null ? fmtEuro(sum.avgMargin) : "—"}</Text>
          </View>
        </View>

        <ChartCard title="Тренд по месеци" subtitle="Оранжеви стълбчета — брой · Синя линия — оборот €">
          <ComboTrendChart
            labels={monthShortLabels.length ? monthShortLabels : ["—"]}
            counts={monthCounts.length ? monthCounts : [0]}
            revenues={monthRevenues.length ? monthRevenues : [0]}
            width={chartW}
            height={trendH}
          />
        </ChartCard>

        <View style={s.row}>
          <View style={s.col}>
            <ChartCard title="Фаза на монтаж" subtitle="Разпределение">
              <DonutChart
                items={mountSlices.length ? mountSlices : [{ label: "Няма данни", value: 1 }]}
                size={100}
                centerValue={fmtNum(sum.saleCount)}
                centerTitle="общо"
              />
            </ChartCard>
          </View>
          <View style={s.col}>
            <ChartCard title="Оперативен статус" subtitle="Планирани · в процес · изпълнени">
              <DonutChart
                items={statusSlices.length ? statusSlices : [{ label: "Няма данни", value: 1 }]}
                size={100}
                centerValue={fmtNum(sum.saleCount)}
                centerTitle="общо"
              />
            </ChartCard>
          </View>
          <View style={s.colNarrow}>
            <ChartCard title="Марж %" subtitle="Доставна / оборот">
              <MarginGauge percent={sum.marginPercent} width={130} />
            </ChartCard>
          </View>
        </View>

        <SectionHeader
          title="Финансов анализ и класации"
          meta={`${sectionLabel} · ${fmtNum(report.totalMatching)} продажби`}
        />

        <ChartCard title="Оборот срещу доставна цена" subtitle="Месечно сравнение (€)">
          <GroupedBarChart
            labels={revShortLabels.length ? revShortLabels : ["—"]}
            seriesA={revSeries.length ? revSeries : [0]}
            seriesB={purchaseSeries.length ? purchaseSeries : [0]}
            nameA="Оборот"
            nameB="Доставна"
            width={chartW}
            height={Math.min(132, trendH - 10)}
          />
        </ChartCard>

        <View style={s.row}>
          <View style={s.colNarrow}>
            <ChartCard title="Ценови диапазони" subtitle="Брой по €">
              <VerticalBarChart
                labels={report.priceBuckets.length ? report.priceBuckets.map((b) => b.label) : ["—"]}
                values={report.priceBuckets.length ? report.priceBuckets.map((b) => b.count) : [0]}
                width={175}
                height={102}
                color={BR.orange}
              />
            </ChartCard>
          </View>
          <View style={s.colWide}>
            <ChartCard title="Месечна таблица" subtitle="Детайл по месеци">
              <MiniMonthTable rows={report.byMonth} />
            </ChartCard>
          </View>
        </View>

        <View style={s.row}>
          <View style={s.col}>
            <ChartCard title="Топ доставчици" subtitle="По оборот €">
              <HorizontalBarChart
                labels={report.bySupplier.map((x) => x.name)}
                values={report.bySupplier.map((x) => x.revenue)}
                displayValues={report.bySupplier.map((x) => fmtEuro(x.revenue))}
                color={BR.blueLight}
                dense
              />
            </ChartCard>
          </View>
          <View style={s.col}>
            <ChartCard title="Топ марки" subtitle="По оборот €">
              <HorizontalBarChart
                labels={report.byBrand.map((x) => x.name)}
                values={report.byBrand.map((x) => x.revenue)}
                displayValues={report.byBrand.map((x) => fmtEuro(x.revenue))}
                color={BR.orange}
                dense
              />
            </ChartCard>
          </View>
        </View>

        <ChartCard title="Топ продукти" subtitle="По брой продажби">
          <HorizontalBarChart
            labels={report.byProduct.map((x) => x.name)}
            values={report.byProduct.map((x) => x.count)}
            displayValues={report.byProduct.map((x) => `${fmtNum(x.count)} бр.`)}
            color={BR.blue}
            dense
          />
        </ChartCard>

        {hasTopClients ? (
          <>
            <View break />
            <SectionHeader
              title="Топ 20 клиенти"
              meta={`оборот топ 20: ${fmtEuro(sum.topClientsRevenue)}${sum.topClientsRevenueSharePercent != null ? ` (${sum.topClientsRevenueSharePercent}%)` : ""}`}
            />
            <TopClientsSummaryStrip report={report} sum={sum} />

            <ChartCard title="Топ 10 клиенти" subtitle="По оборот € · от най-голям към най-малък">
              <HorizontalBarChart
                labels={top10Clients.map((x) => x.name)}
                values={top10Clients.map((x) => x.revenue)}
                displayValues={top10Clients.map((x) => fmtEuro(x.revenue))}
                color={BR.blueLight}
                dense
              />
            </ChartCard>

            <ChartCard title="Детайлна таблица" subtitle="Пълни имена · оборот · марж · период · марка и продукт">
              <TopClientsTablePdf clients={report.topClients} />
            </ChartCard>
          </>
        ) : null}

        {hasAiAnalysis ? (
          <>
            <View break />
            <SectionHeader
              title="AI аналитичен анализ"
              meta={`${sectionLabel}${aiAnalysisGeneratedAt ? ` · ${aiAnalysisGeneratedAt}` : ""}`}
            />
            <SalesReportAiAnalysisPdf text={aiAnalysis!.trim()} generatedAt={aiAnalysisGeneratedAt} />
          </>
        ) : null}
      </Page>
    </Document>
  );
}
