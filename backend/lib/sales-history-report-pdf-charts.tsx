/**
 * Графики за PDF отчет — SVG само за фигури; кирилица в Text (NotoSans).
 */
import React from "react";
import { View, Text, Svg, Path, Circle, Rect, Line, G, Defs, LinearGradient, Stop, StyleSheet } from "@react-pdf/renderer";

export const CHART = {
  orange: "#FF4D00",
  orangeMid: "#FF6A00",
  orangeLight: "#ff9c5d",
  blue: "#0077B6",
  blueLight: "#00B4D8",
  bluePale: "#e6f9fd",
  orangePale: "#fff3ed",
  ink: "#0f172a",
  muted: "#64748b",
  grid: "#e2e8f0",
  white: "#ffffff",
};

export const PDF_FONT = "NotoSans";

export const PIE_PALETTE = [
  CHART.orange,
  CHART.blueLight,
  CHART.orangeMid,
  CHART.blue,
  CHART.orangeLight,
  "#0096b8",
  "#E64500",
  "#2cc1e6",
];

const cs = StyleSheet.create({
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  legendDot: { width: 8, height: 8, borderRadius: 2, marginRight: 4 },
  legendText: { fontFamily: PDF_FONT, fontSize: 7, color: CHART.ink },
  axisLabel: { fontFamily: PDF_FONT, fontSize: 6, color: CHART.muted, textAlign: "center" },
  chartLegend: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginBottom: 3 },
  chartLegendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  chartLegendText: { fontFamily: PDF_FONT, fontSize: 7, color: CHART.ink },
  hBarRow: { marginBottom: 5 },
  hBarRowDense: { marginBottom: 2 },
  hBarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hBarLabel: { fontFamily: PDF_FONT, fontSize: 7, fontWeight: "bold", color: CHART.ink, flex: 1, paddingRight: 6 },
  hBarLabelDense: { fontFamily: PDF_FONT, fontSize: 6.5, fontWeight: "bold", color: CHART.ink, flex: 1, paddingRight: 4 },
  hBarValue: { fontFamily: PDF_FONT, fontSize: 7, color: CHART.muted },
  hBarTrack: { height: 7, backgroundColor: CHART.grid, borderRadius: 3, marginTop: 2 },
  hBarFill: { height: 7, borderRadius: 3 },
  donutWrap: { alignItems: "center" },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenterVal: { fontFamily: PDF_FONT, fontSize: 12, fontWeight: "bold", color: CHART.orange, lineHeight: 1.2 },
  donutCenterLbl: { fontFamily: PDF_FONT, fontSize: 6.5, color: CHART.muted, marginTop: 2, lineHeight: 1.2 },
  gaugeCenter: { alignItems: "center", marginTop: 4 },
  gaugeVal: { fontFamily: PDF_FONT, fontSize: 12, fontWeight: "bold", color: CHART.orange, lineHeight: 1.3 },
  gaugeLbl: { fontFamily: PDF_FONT, fontSize: 7, color: CHART.muted, marginTop: 3, lineHeight: 1.2 },
  xLabelsRow: { flexDirection: "row", marginTop: 2 },
  vBarLabels: { flexDirection: "row", marginTop: 3 },
  vBarLabel: { fontFamily: PDF_FONT, fontSize: 5.5, color: CHART.muted, textAlign: "center" },
});

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegment(cx: number, cy: number, rOut: number, rIn: number, start: number, end: number) {
  if (end - start >= 359.99) end = start + 359.99;
  const so = polar(cx, cy, rOut, start);
  const eo = polar(cx, cy, rOut, end);
  const si = polar(cx, cy, rIn, end);
  const ei = polar(cx, cy, rIn, start);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${so.x.toFixed(2)} ${so.y.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${eo.x.toFixed(2)} ${eo.y.toFixed(2)}`,
    `L ${si.x.toFixed(2)} ${si.y.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${ei.x.toFixed(2)} ${ei.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export type ChartSlice = { label: string; value: number };

export function DonutChart({
  items,
  size = 110,
  centerTitle,
  centerValue,
}: {
  items: ChartSlice[];
  size?: number;
  centerTitle?: string;
  centerValue?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rOut = size / 2 - 3;
  const rIn = rOut * 0.58;
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
  let angle = 0;
  const segments: React.ReactNode[] = [];

  items.forEach((item, i) => {
    const sweep = (item.value / total) * 360;
    if (item.value <= 0 || sweep < 0.5) return;
    const end = angle + sweep;
    segments.push(
      <Path
        key={`seg-${i}`}
        d={donutSegment(cx, cy, rOut, rIn, angle, end)}
        fill={PIE_PALETTE[i % PIE_PALETTE.length]}
      />,
    );
    angle = end;
  });

  return (
    <View style={cs.donutWrap}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={cx} cy={cy} r={rOut + 1} fill={CHART.white} stroke={CHART.grid} strokeWidth={0.5} />
          {segments}
        </Svg>
        {(centerValue || centerTitle) && (
          <View style={[cs.donutCenter, { height: size }]}>
            <View style={{ alignItems: "center" }}>
              {centerValue ? <Text style={cs.donutCenterVal}>{centerValue}</Text> : null}
              {centerTitle ? <Text style={cs.donutCenterLbl}>{centerTitle}</Text> : null}
            </View>
          </View>
        )}
      </View>
      <View style={{ width: "100%", marginTop: 4 }}>
        {items.map((item, i) => (
          <View key={item.label} style={cs.legendRow}>
            <View style={[cs.legendDot, { backgroundColor: PIE_PALETTE[i % PIE_PALETTE.length] }]} />
            <Text style={cs.legendText}>
              {item.label} ({item.value})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function MarginGauge({ percent, width = 140 }: { percent: number | null; width?: number }) {
  const height = 68;
  const cx = width / 2;
  const cy = height - 4;
  const r = width / 2 - 10;
  const clamped = percent != null ? Math.min(100, Math.max(0, percent)) : 0;
  const needleAngle = 180 + (clamped / 100) * 180;
  const needle = polar(cx, cy, r - 6, needleAngle);
  const bgArc = donutSegment(cx, cy, r, r - 12, 180, 360);
  const valArc = donutSegment(cx, cy, r, r - 12, 180, 180 + (clamped / 100) * 180);

  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={CHART.orangeLight} />
            <Stop offset="50%" stopColor={CHART.orangeMid} />
            <Stop offset="100%" stopColor={CHART.orange} />
          </LinearGradient>
        </Defs>
        <Path d={bgArc} fill={CHART.grid} />
        <Path d={valArc} fill="url(#gaugeGrad)" />
        <Line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={CHART.ink} strokeWidth={1.5} />
        <Circle cx={cx} cy={cy} r={4} fill={CHART.orange} />
      </Svg>
      <View style={cs.gaugeCenter}>
        <Text style={cs.gaugeVal}>{percent != null ? `${percent.toFixed(1)}%` : "—"}</Text>
        <Text style={cs.gaugeLbl}>Марж %</Text>
      </View>
    </View>
  );
}

export function ComboTrendChart({
  labels,
  counts,
  revenues,
  width = 520,
  height = 185,
}: {
  labels: string[];
  counts: number[];
  revenues: number[];
  width?: number;
  height?: number;
}) {
  const padL = 32;
  const padR = 36;
  const padT = 8;
  const padB = 6;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxCount = Math.max(...counts, 1);
  const maxRev = Math.max(...revenues, 1);
  const n = Math.max(labels.length, 1);
  const slot = chartW / n;
  const barW = Math.min(12, slot * 0.38);

  const revPoints = revenues.map((v, i) => {
    const x = padL + slot * i + slot / 2;
    const y = padT + chartH - (v / maxRev) * chartH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPath =
    revPoints.length > 0
      ? `M ${padL + slot / 2},${padT + chartH} L ${revPoints.join(" L ")} L ${padL + slot * (n - 1) + slot / 2},${padT + chartH} Z`
      : "";
  const linePath = revPoints.length > 0 ? `M ${revPoints.join(" L ")}` : "";

  return (
    <View>
      <View style={cs.chartLegend}>
        <View style={cs.chartLegendItem}>
          <View style={{ width: 8, height: 8, backgroundColor: CHART.orange, borderRadius: 1 }} />
          <Text style={cs.chartLegendText}>Брой продажби</Text>
        </View>
        <View style={cs.chartLegendItem}>
          <View style={{ width: 8, height: 3, backgroundColor: CHART.blue, marginTop: 2 }} />
          <Text style={cs.chartLegendText}>Оборот €</Text>
        </View>
      </View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={CHART.blueLight} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={CHART.blueLight} stopOpacity={0.05} />
          </LinearGradient>
        </Defs>
        {[0, 0.5, 1].map((t) => {
          const y = padT + chartH * (1 - t);
          return <Line key={t} x1={padL} y1={y} x2={width - padR} y2={y} stroke={CHART.grid} strokeWidth={0.5} />;
        })}
        {areaPath ? <Path d={areaPath} fill="url(#areaGrad)" /> : null}
        {linePath ? <Path d={linePath} stroke={CHART.blue} strokeWidth={1.5} fill="none" /> : null}
        {counts.map((c, i) => {
          const h = (c / maxCount) * chartH;
          const x = padL + slot * i + slot / 2 - barW / 2;
          return <Rect key={i} x={x} y={padT + chartH - h} width={barW} height={h} rx={2} fill={CHART.orange} />;
        })}
        {revenues.map((_, i) => {
          const x = padL + slot * i + slot / 2;
          const y = padT + chartH - (revenues[i] / maxRev) * chartH;
          return <Circle key={`d-${i}`} cx={x} cy={y} r={2.5} fill={CHART.blue} />;
        })}
      </Svg>
      <View style={cs.xLabelsRow}>
        {labels.map((lbl, i) => (
          <Text key={`${lbl}-${i}`} style={[cs.axisLabel, { width: `${100 / n}%` }]}>
            {lbl}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function GroupedBarChart({
  labels,
  seriesA,
  seriesB,
  nameA,
  nameB,
  width = 520,
  height = 155,
}: {
  labels: string[];
  seriesA: number[];
  seriesB: number[];
  nameA: string;
  nameB: string;
  width?: number;
  height?: number;
}) {
  const padL = 34;
  const padR = 8;
  const padT = 6;
  const padB = 4;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxVal = Math.max(...seriesA, ...seriesB, 1);
  const n = Math.max(labels.length, 1);
  const slot = chartW / n;
  const groupW = slot * 0.7;
  const barW = groupW / 2 - 2;

  return (
    <View>
      <View style={cs.chartLegend}>
        <View style={cs.chartLegendItem}>
          <View style={{ width: 8, height: 8, backgroundColor: CHART.orange, borderRadius: 1 }} />
          <Text style={cs.chartLegendText}>{nameA}</Text>
        </View>
        <View style={cs.chartLegendItem}>
          <View style={{ width: 8, height: 8, backgroundColor: CHART.blueLight, borderRadius: 1 }} />
          <Text style={cs.chartLegendText}>{nameB}</Text>
        </View>
      </View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((t) => {
          const y = padT + chartH * (1 - t);
          return <Line key={t} x1={padL} y1={y} x2={padL + chartW} y2={y} stroke={CHART.grid} strokeWidth={0.5} />;
        })}
        {labels.map((_, i) => {
          const gx = padL + slot * i + (slot - groupW) / 2;
          const ha = (seriesA[i] / maxVal) * chartH;
          const hb = (seriesB[i] / maxVal) * chartH;
          return (
            <G key={i}>
              <Rect x={gx} y={padT + chartH - ha} width={barW} height={ha} rx={2} fill={CHART.orange} />
              <Rect x={gx + barW + 3} y={padT + chartH - hb} width={barW} height={hb} rx={2} fill={CHART.blueLight} />
            </G>
          );
        })}
      </Svg>
      <View style={cs.xLabelsRow}>
        {labels.map((lbl, i) => (
          <Text key={`${lbl}-${i}`} style={[cs.axisLabel, { width: `${100 / n}%` }]}>
            {lbl}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function VerticalBarChart({
  labels,
  values,
  width = 200,
  height = 130,
  color = CHART.blueLight,
}: {
  labels: string[];
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const padL = 22;
  const padR = 4;
  const padT = 6;
  const padB = 2;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxVal = Math.max(...values, 1);
  const n = Math.max(values.length, 1);
  const slot = chartW / n;
  const barW = Math.min(20, slot * 0.6);

  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke={CHART.grid} strokeWidth={0.5} />
        <Line x1={padL} y1={padT + chartH} x2={width - padR} y2={padT + chartH} stroke={CHART.grid} strokeWidth={0.5} />
        {values.map((v, i) => {
          const h = (v / maxVal) * chartH;
          const x = padL + slot * i + slot / 2 - barW / 2;
          const y = padT + chartH - h;
          return (
            <G key={i}>
              <Rect x={x} y={y} width={barW} height={h} rx={2} fill={color} />
            </G>
          );
        })}
      </Svg>
      <View style={cs.vBarLabels}>
        {labels.map((lbl, i) => (
          <Text key={`${lbl}-${i}`} style={[cs.vBarLabel, { width: `${100 / n}%` }]}>
            {lbl}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", marginTop: 1 }}>
        {values.map((v, i) => (
          <Text key={i} style={[cs.vBarLabel, { width: `${100 / n}%`, fontWeight: "bold", color: CHART.ink }]}>
            {v}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function HorizontalBarChart({
  labels,
  values,
  displayValues,
  color = CHART.orange,
  dense = false,
}: {
  labels: string[];
  values: number[];
  displayValues?: string[];
  color?: string;
  /** По-компактни редове — за топ клиенти и дълги списъци. */
  dense?: boolean;
}) {
  const rows = labels
    .map((label, i) => ({
      label: label?.trim() || "—",
      value: values[i] ?? 0,
      display: displayValues?.[i],
    }))
    .filter((row) => row.label !== "—" || row.value > 0);

  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  return (
    <View>
      {rows.map((row, i) => {
        const pct = Math.max(4, (row.value / maxVal) * 100);
        return (
          <View key={`${i}-${row.label}`} style={dense ? cs.hBarRowDense : cs.hBarRow}>
            <View style={cs.hBarTop}>
              <Text style={dense ? cs.hBarLabelDense : cs.hBarLabel}>
                {i + 1}. {row.label}
              </Text>
              <Text style={cs.hBarValue}>{row.display ?? String(row.value)}</Text>
            </View>
            <View style={cs.hBarTrack}>
              <View style={[cs.hBarFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Кратък месечен етикет: 2026-01 → 01.26 */
export function shortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  if (!y || !m) return monthKey;
  return `${m}.${y.slice(-2)}`;
}
