/**
 * PDF — визуално копие на хартиения „Приемно-предавателен протокол“ (СМОЛЯНКЛИМА).
 * Шрифт: Noto Sans (кирилица); Helvetica в PDF често дава „кракозябри“.
 */
import React from "react";
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from "@react-pdf/renderer";
import { ProtocolPdfBrandMark } from "@/lib/protocol-pdf-brand";
import { LEFT_MATERIALS, RIGHT_MATERIALS, ACCESSORIES_LABELS } from "@/lib/protocol-materials";
import type { AccessoriesEntry, MaterialEntry } from "@/lib/protocol-materials";

const NOTO_REG =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const NOTO_BOLD =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf";

Font.register({
  family: "NotoSans",
  fonts: [
    { src: NOTO_REG, fontWeight: "normal" },
    { src: NOTO_BOLD, fontWeight: "bold" },
  ],
});

const W = {
  hairline: 0.35,
  thin:     0.6,
  rule:     0.85,
};

const C = {
  ink:    "#000000",
  muted:  "#222222",
  line:   "#000000",
  dots:   "#333333",
};

const FONT = "NotoSans";

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 6.8,
    paddingTop: 22,
    paddingBottom: 52,
    paddingHorizontal: 26,
    color: C.ink,
    lineHeight: 1.15,
  },

  // ── Хедър като бланка: лого зона | вертикална линия | заглавие ─────────────
  headerOuter: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 8,
    borderBottomWidth: W.rule,
    borderBottomColor: C.line,
    paddingBottom: 6,
  },
  headerLeftBlock: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    maxWidth: "52%",
    paddingRight: 6,
  },
  headerVRule: {
    width: W.rule,
    backgroundColor: C.line,
    marginHorizontal: 4,
    alignSelf: "stretch",
    minHeight: 36,
  },
  headerRightBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 9.2,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 2,
  },
  docNoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    marginBottom: 2,
  },
  docNoLabel: { fontSize: 7.6 },
  docDateRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
  },
  docDateLabel: { fontSize: 7 },
  docDateLine: {
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    minWidth: 120,
    fontSize: 7,
    paddingBottom: 1,
    textAlign: "center",
  },

  // ── Полета клиент (редове с подчертаване) ───────────────────────────────────
  fieldsBlock: {
    marginBottom: 5,
  },
  underlineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 3,
  },
  ulLabel: {
    fontSize: 7,
    width: 108,
    paddingRight: 4,
  },
  ulLine: {
    flex: 1,
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    fontSize: 7,
    paddingBottom: 1,
    minHeight: 11,
  },
  ulTinyLabel: { fontSize: 7, marginLeft: 6, marginRight: 3 },
  ulTinyBox: {
    width: 36,
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    fontSize: 7,
    paddingBottom: 1,
    minHeight: 11,
    textAlign: "center",
  },

  twoColTop: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  colLeft:  { flex: 1.15 },
  colRight: { flex: 0.85 },

  paidRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  paidLbl: { fontSize: 7, width: 78 },
  paidLine: {
    flex: 1,
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    fontSize: 7.5,
    fontWeight: "bold",
    paddingBottom: 1,
    minHeight: 11,
  },

  mountHead: { fontSize: 7, marginBottom: 2 },
  mountRows: { gap: 3 },
  mountRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mountCell: { flexDirection: "row", alignItems: "center", gap: 3 },
  chk: {
    width: 7,
    height: 7,
    borderWidth: W.thin,
    borderColor: C.line,
    justifyContent: "center",
    alignItems: "center",
  },
  chkOn: {
    width: 7,
    height: 7,
    borderWidth: W.thin,
    borderColor: C.line,
    backgroundColor: C.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  chkMark: { fontSize: 5.5, color: "#fff", marginTop: -0.5 },
  mountTxt: { fontSize: 6.8 },

  // ── Голяма таблица материали ────────────────────────────────────────────────
  matOuter: {
    flexDirection: "row",
    borderWidth: W.thin,
    borderColor: C.line,
    marginBottom: 4,
  },
  matHalf: { flex: 1 },
  matHalfR: {
    flex: 1,
    borderLeftWidth: W.thin,
    borderLeftColor: C.line,
  },
  matRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: W.hairline,
    borderBottomColor: C.line,
    minHeight: 13,
  },
  matRowLast: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 13,
  },
  matDesc: {
    flex: 1,
    paddingLeft: 4,
    paddingRight: 3,
    paddingVertical: 2,
    justifyContent: "center",
    fontSize: 6.6,
  },
  matQty: {
    width: 26,
    borderLeftWidth: W.hairline,
    borderLeftColor: C.line,
    justifyContent: "center",
    alignItems: "center",
    fontSize: 6.8,
    paddingVertical: 2,
  },

  // ── Кабелни канали (като на бланката) ───────────────────────────────────────
  cableWrap: {
    borderWidth: W.thin,
    borderColor: C.line,
    paddingHorizontal: 5,
    paddingVertical: 4,
    marginBottom: 4,
    gap: 4,
  },
  cableRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 10,
    rowGap: 6,
  },
  cablePair: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  cableLbl: { fontSize: 6.8, maxWidth: 118 },
  cableBox: {
    minWidth: 22,
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    fontSize: 6.8,
    textAlign: "center",
    paddingBottom: 1,
    minHeight: 10,
  },

  notesHead: { fontSize: 7, marginBottom: 3 },
  notesBox: {
    borderWidth: W.thin,
    borderColor: C.line,
    minHeight: 38,
    padding: 5,
    marginBottom: 6,
  },
  notesLineText: { fontSize: 7, marginBottom: 5 },
  notesDots: {
    borderBottomWidth: W.hairline,
    borderBottomColor: C.line,
    marginBottom: 5,
    minHeight: 9,
  },

  sigWrap: {
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
  },
  sigCol: { flex: 1 },
  sigCap: { fontSize: 7, marginBottom: 4 },
  sigArea: {
    borderBottomWidth: W.rule,
    borderBottomColor: C.line,
    minHeight: 32,
    position: "relative",
    justifyContent: "flex-end",
  },
  sigImg: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 30,
    objectFit: "contain",
    objectPosition: "center bottom",
  },

  footerFixed: {
    position: "absolute",
    bottom: 18,
    left: 26,
    right: 26,
    borderTopWidth: W.hairline,
    borderTopColor: C.line,
    paddingTop: 5,
  },
  footerTxt: {
    fontSize: 6.2,
    color: C.muted,
    textAlign: "center",
    lineHeight: 1.35,
  },
});

export interface ProtocolData {
  protocol_number: string;
  date: string;
  client_name?: string | null;
  ac_model?: string | null;
  serial_number?: string | null;
  address?: string | null;
  travel_km?: string | null;
  paid_amount?: number | null;
  mount_types: string[];
  materials: MaterialEntry[];
  cable_channels_m: number;
  accessories: Partial<AccessoriesEntry>;
  notes?: string | null;
  signature_team?: string | null;
  signature_client?: string | null;
}

const MOUNT_GRID = [
  ["вишка", "скеле", "тераса"],
  ["под прозорец", "наземен", "демонтаж"],
  ["камък", "тухла", "бетон", "друго"],
];

function dash(v?: string | null) {
  const t = v?.trim();
  return t ?? "";
}

function qtyCell(v: number | undefined) {
  return v && v > 0 ? String(v) : "";
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

export function ProtocolPDF({ data }: { data: ProtocolData }) {
  const qtyMap: Record<string, number> = {};
  for (const m of data.materials) qtyMap[m.id] = m.qty;

  const acc = data.accessories as Partial<AccessoriesEntry>;
  const dateStr = fmtDate(data.date);

  const cableFirstRowKeys = ["cable_channels_m"] as const;
  const cableSecondRowKeys = ["outer_corner", "inner_corner", "angle_out", "connector"] as const;
  const cableThirdRowKeys = ["inner_cap", "outer_cap", "end_cap", "holder"] as const;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.headerOuter}>
          <View style={s.headerLeftBlock}>
            <ProtocolPdfBrandMark />
          </View>
          <View style={s.headerVRule} />
          <View style={s.headerRightBlock}>
            <Text style={s.docTitle}>ПРИЕМНО-ПРЕДАВАТЕЛЕН ПРОТОКОЛ</Text>
            <View style={s.docNoRow}>
              <Text style={s.docNoLabel}>№ {data.protocol_number}</Text>
            </View>
            <View style={s.docDateRow}>
              <Text style={s.docDateLabel}>от дата</Text>
              <Text style={s.docDateLine}>{dateStr}</Text>
            </View>
          </View>
        </View>

        <View style={s.twoColTop}>
          <View style={s.colLeft}>
            <View style={s.fieldsBlock}>
              <View style={s.underlineRow}>
                <Text style={s.ulLabel}>Клиент</Text>
                <Text style={s.ulLine}>{dash(data.client_name)}</Text>
              </View>
              <View style={s.underlineRow}>
                <Text style={s.ulLabel}>Модел климатик</Text>
                <Text style={s.ulLine}>{dash(data.ac_model)}</Text>
              </View>
              <View style={s.underlineRow}>
                <Text style={s.ulLabel}>Сериен №</Text>
                <Text style={s.ulLine}>{dash(data.serial_number)}</Text>
              </View>
              <View style={s.underlineRow}>
                <Text style={s.ulLabel}>Адрес</Text>
                <Text style={s.ulLine}>{dash(data.address)}</Text>
                <Text style={s.ulTinyLabel}>км</Text>
                <Text style={s.ulTinyBox}>{dash(data.travel_km)}</Text>
              </View>
            </View>
          </View>

          <View style={s.colRight}>
            <View style={s.paidRow}>
              <Text style={s.paidLbl}>Платена сума:</Text>
              <Text style={s.paidLine}>
                {data.paid_amount != null ? `${data.paid_amount.toFixed(2)} лв.` : ""}
              </Text>
            </View>
            <Text style={s.mountHead}>Начин на монтаж:</Text>
            <View style={s.mountRows}>
              {MOUNT_GRID.map((row, ri) => (
                <View key={ri} style={s.mountRow}>
                  {row.map(type => {
                    const on = data.mount_types.includes(type);
                    return (
                      <View key={type} style={s.mountCell}>
                        <View style={on ? s.chkOn : s.chk}>
                          {on ? <Text style={s.chkMark}>✓</Text> : null}
                        </View>
                        <Text style={s.mountTxt}>{type}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={s.matOuter}>
          <View style={s.matHalf}>
            {LEFT_MATERIALS.map((mat, i) => {
              const last = i === LEFT_MATERIALS.length - 1;
              const Row = last ? s.matRowLast : s.matRow;
              return (
                <View key={mat.id} style={Row}>
                  <Text style={s.matDesc}>
                    {mat.name}/{mat.unit}
                  </Text>
                  <Text style={s.matQty}>{qtyCell(qtyMap[mat.id])}</Text>
                </View>
              );
            })}
          </View>
          <View style={s.matHalfR}>
            {RIGHT_MATERIALS.map((mat, i) => {
              const last = i === RIGHT_MATERIALS.length - 1;
              const Row = last ? s.matRowLast : s.matRow;
              return (
                <View key={mat.id} style={Row}>
                  <Text style={s.matDesc}>
                    {mat.name}/{mat.unit}
                  </Text>
                  <Text style={s.matQty}>{qtyCell(qtyMap[mat.id])}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.cableWrap}>
          <View style={s.cableRow}>
            {cableFirstRowKeys.map(k => (
              <View key={k} style={s.cablePair}>
                <Text style={s.cableLbl}>{ACCESSORIES_LABELS[k]}</Text>
                <Text style={s.cableBox}>
                  {k === "cable_channels_m"
                    ? (acc.cable_channels_m ? String(acc.cable_channels_m) : "")
                    : ""}
                </Text>
              </View>
            ))}
          </View>
          <View style={s.cableRow}>
            {cableSecondRowKeys.map(k => (
              <View key={k} style={s.cablePair}>
                <Text style={s.cableLbl}>{ACCESSORIES_LABELS[k]}</Text>
                <Text style={s.cableBox}>{acc[k] ? String(acc[k]) : ""}</Text>
              </View>
            ))}
          </View>
          <View style={s.cableRow}>
            {cableThirdRowKeys.map(k => (
              <View key={k} style={s.cablePair}>
                <Text style={s.cableLbl}>{ACCESSORIES_LABELS[k]}</Text>
                <Text style={s.cableBox}>{acc[k] ? String(acc[k]) : ""}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.notesHead}>Забележки:</Text>
        <View style={s.notesBox}>
          <Text style={s.notesLineText}>{dash(data.notes)}</Text>
          <View style={s.notesDots} />
          <View style={s.notesDots} />
          <View style={s.notesDots} />
        </View>

        <View style={s.sigWrap}>
          <View style={s.sigCol}>
            <Text style={s.sigCap}>Монтажна група</Text>
            <View style={s.sigArea}>
              {data.signature_team ? (
                <Image src={data.signature_team} style={s.sigImg} />
              ) : null}
            </View>
          </View>
          <View style={s.sigCol}>
            <Text style={s.sigCap}>Подпис на клиента:</Text>
            <View style={s.sigArea}>
              {data.signature_client ? (
                <Image src={data.signature_client} style={s.sigImg} />
              ) : null}
            </View>
          </View>
        </View>

        <View style={s.footerFixed} fixed>
          <Text style={s.footerTxt}>
            Смолян Клима ЕООД, ЕИК: BG 204223522 гр. Смолян ул. Елица № 36 Тел: 0888 58 58 16
          </Text>
        </View>

      </Page>
    </Document>
  );
}
