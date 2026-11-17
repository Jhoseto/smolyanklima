import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ProtocolPdfBrandMark } from "@/lib/protocol-pdf-brand";
import { REPAIR_PROTOCOL_STEPS, repairProtocolStepRows } from "@/lib/repair-protocol-steps";
import {
  repairProtocolDisplayStage, repairProtocolDocumentParts, type RepairProtocolDocument,
} from "@/lib/repair-protocol-presentation";

const FONT_BASE = "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans";
Font.register({
  family: "NotoSans",
  fonts: [
    { src: `${FONT_BASE}/NotoSans-Regular.ttf`, fontWeight: "normal" },
    { src: `${FONT_BASE}/NotoSans-Bold.ttf`, fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSans", fontSize: 9, color: "#172535",
    paddingTop: 22, paddingHorizontal: 30, paddingBottom: 38, lineHeight: 1.25,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 1, borderColor: "#31465b", paddingBottom: 8, marginBottom: 9,
  },
  title: { fontSize: 14, fontWeight: "bold" },
  docNumber: { fontSize: 9, marginTop: 2, textAlign: "right" },
  phase: { fontSize: 13, fontWeight: "bold", color: "#075985", marginBottom: 6 },
  section: { marginBottom: 5 },
  sectionTitle: {
    backgroundColor: "#eaf2f7", color: "#16445e", fontWeight: "bold",
    paddingHorizontal: 6, paddingVertical: 3, marginBottom: 3, fontSize: 9,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "33.33%", paddingHorizontal: 6, paddingBottom: 4 },
  notes: { width: "100%", paddingHorizontal: 6, paddingBottom: 4 },
  label: { fontSize: 7.5, color: "#475569", marginBottom: 1 },
  value: { fontSize: 9 },
  signature: { marginTop: 6, width: 180, borderBottomWidth: 0.6, borderColor: "#64748b", paddingBottom: 3 },
  signatureImage: { height: 33, width: 174, objectFit: "contain" },
  footer: {
    position: "absolute", left: 30, right: 30, top: 814,
    textAlign: "center",
    borderTopWidth: 0.5, borderColor: "#cbd5e1", paddingTop: 4,
    fontSize: 7, color: "#475569",
  },
});

export function RepairProtocolPDF({ data }: { data: RepairProtocolDocument }) {
  const stage = repairProtocolDisplayStage(data);
  const parts = repairProtocolDocumentParts(data);
  return (
    <Document title={`Сервизен протокол № ${data.protocol_number}`} author="Смолян Клима ЕООД">
      {parts.map(({ title, data: phase }, partIndex) => (
        <Page key={title} size="A4" style={s.page}>
          <View fixed style={s.header}>
            <ProtocolPdfBrandMark />
            <View>
              <Text style={s.title}>Сервизен протокол</Text>
              <Text style={s.docNumber}>№ {data.protocol_number}</Text>
            </View>
          </View>
          <Text style={s.phase} fixed>
            {title}{(stage === "intake" || (stage === "issuing" && partIndex === 1)) ? " · Чернова" : ""}
          </Text>

          {REPAIR_PROTOCOL_STEPS.map((step, index) => (
            <View key={index} style={s.section}>
              <Text style={s.sectionTitle} minPresenceAhead={20}>{step.title}</Text>
              <View style={s.grid}>
                {repairProtocolStepRows(phase, index).map(({ label, value }) => (
                  <View key={label} style={index === REPAIR_PROTOCOL_STEPS.length - 1 ? s.notes : s.cell}>
                    <Text style={s.label} minPresenceAhead={10}>{label}</Text>
                    <Text style={s.value}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <View style={s.signature} wrap={false}>
            <Text style={s.label}>Подпис на сервизен техник</Text>
            {phase.signature_team
              ? <Image src={phase.signature_team} style={s.signatureImage} />
              : <Text style={s.value}>—</Text>}
          </View>

          <Text fixed style={s.footer} render={({ pageNumber, totalPages }) =>
            `Смолян Клима ЕООД · ЕИК BG 204223522 · гр. Смолян, ул. Елица № 36 · 0878 58 16 16     |     ${pageNumber} / ${totalPages}`
          } />
        </Page>
      ))}
    </Document>
  );
}
