/**
 * PDF — аналитичен отчет по продажби (СМОЛЯНКЛИМА admin).
 */
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
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
const PAD_X = 28;
const PAD_TOP = 22;
const PAD_BOTTOM = 34;
const FOOTER_H = 20;
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
  topStripe: { position: "absolute", top: 0, left: 0, right: 0, height: 5, flexDirection: "row" },
  stripeOrange: { flex: 1, backgroundColor: BR.orange },
  stripeBlue: { flex: 1, backgroundColor: BR.blue },
  heroHeader: {
    marginBottom: 6,
    paddingBottom: 6,
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
  kpiRow: { flexDirection: "row", gap: 4, marginBottom: 4 },
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
    paddingVertical: 5,
    paddingHorizontal: 7,
    backgroundColor: "#fcfdfe",
    marginBottom: 4,
  },
  chartTitle: { fontFamily: PDF_FONT, fontSize: 8.5, fontWeight: "bold", color: BR.blue, marginBottom: 1 },
  chartSubtitle: { fontFamily: PDF_FONT, fontSize: 6.5, color: BR.muted, marginBottom: 3 },
  row: { flexDirection: "row", gap: 5, marginBottom: 4 },
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
  tableRow: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: BR.grid },
  tableHead: { backgroundColor: BR.blue, paddingVertical: 3, paddingHorizontal: 4, borderRadius: 3, marginBottom: 1 },
  tableHeadText: { fontFamily: PDF_FONT, fontSize: 6.5, fontWeight: "bold", color: BR.white },
  tableCell: { fontFamily: PDF_FONT, fontSize: 6.5, color: BR.ink },
  summaryBand: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  summaryTile: { width: "32%", paddingVertical: 6, paddingHorizontal: 7, borderRadius: 5, borderWidth: 0.5 },
  summaryTileLabel: { fontFamily: PDF_FONT, fontSize: 5.5, color: BR.muted, marginBottom: 2, textTransform: "uppercase" },
  summaryTileValue: { fontFamily: PDF_FONT, fontSize: 10, fontWeight: "bold" },
  page1Summary: {
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  page1SummaryTile: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 0.5,
    alignItems: "center",
  },
  page1SummaryLabel: { fontFamily: PDF_FONT, fontSize: 6, color: BR.muted, marginBottom: 3, textTransform: "uppercase" },
  page1SummaryValue: { fontFamily: PDF_FONT, fontSize: 11, fontWeight: "bold" },
});

type Props = {
  report: SalesHistoryReport;
  sectionLabel?: string;
  filtersHint?: string;
  generatedAt?: string;
};

function PageStripe() {
  return (
    <View style={s.topStripe}>
      <View style={s.stripeOrange} />
      <View style={s.stripeBlue} />
    </View>
  );
}

function PageFooter({ page, total }: { page: number; total: number }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerBrand}>СМОЛЯНКЛИМА</Text>
      <Text style={s.footerText}>Аналитичен отчет по продажби</Text>
      <Text style={s.footerText}>
        {page} / {total}
      </Text>
    </View>
  );
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

const TOTAL_PAGES = 2;

export function SalesHistoryReportPDF({
  report,
  sectionLabel = "История на продажби",
  filtersHint = "Без допълнителни филтри",
  generatedAt,
}: Props) {
  const sum = report.summary;
  const now =
    generatedAt ??
    new Date().toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" });

  const monthShortLabels = report.byMonth.map((m) => shortMonthLabel(m.month));
  const monthCounts = report.byMonth.map((m) => m.count);
  const monthRevenues = report.byMonth.map((m) => m.revenue);
  const revShortLabels = report.revenueVsPurchaseMonthly.map((m) => shortMonthLabel(m.month));
  const revSeries = report.revenueVsPurchaseMonthly.map((m) => m.revenue);
  const purchaseSeries = report.revenueVsPurchaseMonthly.map((m) => m.purchase);

  const mountSlices = report.byMountPhase.map((x) => ({ label: x.label, value: x.count }));
  const statusSlices = report.byOperationalStatus.map((x) => ({ label: x.label, value: x.count }));

  return (
    <Document title="Аналитичен отчет по продажби" author="СМОЛЯНКЛИМА">
      <Page size="A4" style={s.page}>
        <PageStripe />

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
            height={205}
          />
        </ChartCard>

        <View style={s.row}>
          <View style={s.col}>
            <ChartCard title="Фаза на монтаж" subtitle="Разпределение">
              <DonutChart
                items={mountSlices.length ? mountSlices : [{ label: "Няма данни", value: 1 }]}
                size={112}
                centerValue={fmtNum(sum.saleCount)}
                centerTitle="общо"
              />
            </ChartCard>
          </View>
          <View style={s.col}>
            <ChartCard title="Оперативен статус" subtitle="Планирани · в процес · изпълнени">
              <DonutChart
                items={statusSlices.length ? statusSlices : [{ label: "Няма данни", value: 1 }]}
                size={112}
                centerValue={fmtNum(sum.saleCount)}
                centerTitle="общо"
              />
            </ChartCard>
          </View>
          <View style={s.colNarrow}>
            <ChartCard title="Марж %" subtitle="Доставна / оборот">
              <MarginGauge percent={sum.marginPercent} width={138} />
            </ChartCard>
          </View>
        </View>

        <View style={s.page1Summary}>
          <View style={[s.page1SummaryTile, { backgroundColor: BR.orangePale, borderColor: "#ffd4bc" }]}>
            <Text style={s.page1SummaryLabel}>Общ оборот</Text>
            <Text style={[s.page1SummaryValue, { color: BR.orange }]}>{fmtEuro(sum.totalRevenue)}</Text>
          </View>
          <View style={[s.page1SummaryTile, { backgroundColor: BR.bluePale, borderColor: "#b8ecf8" }]}>
            <Text style={s.page1SummaryLabel}>Обща доставна</Text>
            <Text style={[s.page1SummaryValue, { color: BR.blue }]}>{fmtEuro(sum.totalPurchase)}</Text>
          </View>
          <View style={[s.page1SummaryTile, { backgroundColor: BR.orangePale, borderColor: "#ffd4bc" }]}>
            <Text style={s.page1SummaryLabel}>Нетен марж</Text>
            <Text style={[s.page1SummaryValue, { color: BR.orange }]}>{fmtEuro(sum.totalMargin)}</Text>
          </View>
        </View>

        <PageFooter page={1} total={TOTAL_PAGES} />
      </Page>

      <Page size="A4" style={s.page}>
        <PageStripe />

        <View style={s.miniHeader}>
          <Text style={s.miniTitle}>Финансов анализ и класации</Text>
          <Text style={s.miniMeta}>
            {sectionLabel} · {fmtNum(report.totalMatching)} продажби
          </Text>
        </View>

        <ChartCard title="Оборот срещу доставна цена" subtitle="Месечно сравнение (€)">
          <GroupedBarChart
            labels={revShortLabels.length ? revShortLabels : ["—"]}
            seriesA={revSeries.length ? revSeries : [0]}
            seriesB={purchaseSeries.length ? purchaseSeries : [0]}
            nameA="Оборот"
            nameB="Доставна"
            width={chartW}
            height={148}
          />
        </ChartCard>

        <View style={s.row}>
          <View style={s.colNarrow}>
            <ChartCard title="Ценови диапазони" subtitle="Брой по €">
              <VerticalBarChart
                labels={report.priceBuckets.length ? report.priceBuckets.map((b) => b.label) : ["—"]}
                values={report.priceBuckets.length ? report.priceBuckets.map((b) => b.count) : [0]}
                width={175}
                height={115}
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
          />
        </ChartCard>

        <View style={s.summaryBand}>
          <View style={[s.summaryTile, { backgroundColor: BR.orangePale, borderColor: "#ffd4bc" }]}>
            <Text style={s.summaryTileLabel}>Общ оборот</Text>
            <Text style={[s.summaryTileValue, { color: BR.orange }]}>{fmtEuro(sum.totalRevenue)}</Text>
          </View>
          <View style={[s.summaryTile, { backgroundColor: BR.bluePale, borderColor: "#b8ecf8" }]}>
            <Text style={s.summaryTileLabel}>Обща доставна</Text>
            <Text style={[s.summaryTileValue, { color: BR.blue }]}>{fmtEuro(sum.totalPurchase)}</Text>
          </View>
          <View style={[s.summaryTile, { backgroundColor: BR.orangePale, borderColor: "#ffd4bc" }]}>
            <Text style={s.summaryTileLabel}>Нетен марж</Text>
            <Text style={[s.summaryTileValue, { color: BR.orange }]}>{fmtEuro(sum.totalMargin)}</Text>
          </View>
          <View style={[s.summaryTile, { backgroundColor: BR.bluePale, borderColor: "#b8ecf8" }]}>
            <Text style={s.summaryTileLabel}>Марж %</Text>
            <Text style={[s.summaryTileValue, { color: BR.blue }]}>{fmtPct(sum.marginPercent)}</Text>
          </View>
          <View style={[s.summaryTile, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
            <Text style={s.summaryTileLabel}>Завършени монтажи</Text>
            <Text style={[s.summaryTileValue, { color: "#15803d" }]}>{fmtNum(sum.completedMountCount)}</Text>
          </View>
          <View style={[s.summaryTile, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
            <Text style={s.summaryTileLabel}>Отказани</Text>
            <Text style={[s.summaryTileValue, { color: "#b91c1c" }]}>{fmtNum(sum.cancelledCount)}</Text>
          </View>
        </View>

        <PageFooter page={2} total={TOTAL_PAGES} />
      </Page>
    </Document>
  );
}
