import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { CHART, PDF_FONT } from "@/lib/sales-history-report-pdf-charts";

const BR = CHART;

const ai = StyleSheet.create({
  hero: {
    borderWidth: 0.5,
    borderColor: "#ffd4bc",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 4,
    backgroundColor: "#fff8f4",
  },
  heroTitle: {
    fontFamily: PDF_FONT,
    fontSize: 9,
    fontWeight: "bold",
    color: BR.orange,
    marginBottom: 1,
  },
  heroSub: {
    fontFamily: PDF_FONT,
    fontSize: 6.5,
    color: BR.muted,
    lineHeight: 1.3,
  },
  section: {
    marginBottom: 4,
    paddingLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: BR.blueLight,
  },
  sectionOrange: {
    borderLeftColor: BR.orange,
  },
  h2: {
    fontFamily: PDF_FONT,
    fontSize: 8.5,
    fontWeight: "bold",
    color: BR.blue,
    marginBottom: 2,
  },
  h2Orange: {
    color: BR.orange,
  },
  paragraph: {
    fontFamily: PDF_FONT,
    fontSize: 7,
    color: BR.ink,
    lineHeight: 1.35,
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 1.5,
    paddingRight: 4,
  },
  bulletDot: {
    fontFamily: PDF_FONT,
    fontSize: 7.5,
    color: BR.orange,
    width: 10,
    lineHeight: 1.45,
  },
  bulletText: {
    fontFamily: PDF_FONT,
    fontSize: 7.5,
    color: BR.ink,
    flex: 1,
    lineHeight: 1.45,
  },
  numberedIndex: {
    fontFamily: PDF_FONT,
    fontSize: 7.5,
    fontWeight: "bold",
    color: BR.blue,
    width: 12,
    lineHeight: 1.45,
  },
});

type MdBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "numbered"; text: string; n: number };

function stripMdInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

export function parseSalesReportAnalysisMarkdown(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  for (const rawLine of md.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: stripMdInline(line.slice(3)) });
    } else if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: stripMdInline(line.slice(4)) });
    } else if (/^[-*•]\s+/.test(line)) {
      blocks.push({ kind: "bullet", text: stripMdInline(line.replace(/^[-*•]\s+/, "")) });
    } else if (/^\d+[.)]\s+/.test(line)) {
      const m = line.match(/^(\d+)[.)]\s+(.*)$/);
      blocks.push({
        kind: "numbered",
        n: m ? Number(m[1]) : blocks.filter((b) => b.kind === "numbered").length + 1,
        text: stripMdInline(m?.[2] ?? line),
      });
    } else {
      blocks.push({ kind: "p", text: stripMdInline(line) });
    }
  }
  return blocks;
}

export function SalesReportAiAnalysisPdf({
  text,
  generatedAt,
}: {
  text: string;
  generatedAt?: string;
}) {
  const blocks = parseSalesReportAnalysisMarkdown(text);
  let sectionIndex = 0;

  const nodes: React.ReactNode[] = [];
  let buffer: MdBlock[] = [];

  const flushSection = () => {
    if (!buffer.length) return;
    const isOrange = sectionIndex % 2 === 1;
    sectionIndex += 1;
    nodes.push(
      <View key={`sec-${nodes.length}`} style={[ai.section, isOrange ? ai.sectionOrange : {}]}>
        {buffer.map((b, i) => {
          if (b.kind === "h2" || b.kind === "h3") {
            return (
              <Text key={i} style={[ai.h2, isOrange ? ai.h2Orange : {}]}>
                {b.text}
              </Text>
            );
          }
          if (b.kind === "bullet") {
            return (
              <View key={i} style={ai.bulletRow}>
                <Text style={ai.bulletDot}>•</Text>
                <Text style={ai.bulletText}>{b.text}</Text>
              </View>
            );
          }
          if (b.kind === "numbered") {
            return (
              <View key={i} style={ai.bulletRow}>
                <Text style={ai.numberedIndex}>{b.n}.</Text>
                <Text style={ai.bulletText}>{b.text}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={ai.paragraph}>
              {b.text}
            </Text>
          );
        })}
      </View>,
    );
    buffer = [];
  };

  for (const b of blocks) {
    if (b.kind === "h2") {
      flushSection();
      buffer.push(b);
    } else {
      buffer.push(b);
    }
  }
  flushSection();

  return (
    <View>
      <View style={ai.hero}>
        <Text style={ai.heroTitle}>AI аналитичен текст</Text>
        <Text style={ai.heroSub}>
          Интерпретации и препоръки — без повторение на KPI от графиките.
          {generatedAt ? ` Генериран: ${generatedAt}.` : ""}
        </Text>
      </View>
      {nodes}
    </View>
  );
}
