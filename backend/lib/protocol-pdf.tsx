/**
 * PDF — визуално копие на хартиения „Приемно-предавателен протокол“ (СМОЛЯНКЛИМА).
 * Шрифт: Noto Sans (кирилица); Helvetica в PDF често дава „кракозябри“.
 */
import React from "react";
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from "@react-pdf/renderer";
import { ProtocolPdfBrandMark } from "@/lib/protocol-pdf-brand";
import {
  PDF_LEFT_MATERIALS,
  PDF_RIGHT_MATERIALS,
  ACCESSORIES_LABELS,
  resolveMaterialQty,
} from "@/lib/protocol-materials";
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

/** По-плътно запълване на A4 (една страница): по-малки полета + по-големи шрифтове/редове. */
const PAGE_PAD_H = 14;
const PAGE_PAD_TOP = 8;
const PAGE_PAD_BOTTOM = 44;

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 8,
    paddingTop: PAGE_PAD_TOP,
    paddingBottom: PAGE_PAD_BOTTOM,
    paddingHorizontal: PAGE_PAD_H,
    color: C.ink,
    lineHeight: 1.14,
    flexDirection: "column",
    height: "100%",
  },

  // ── Хедър като бланка: лого зона | вертикална линия | заглавие ─────────────
  headerOuter: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 10,
    borderBottomWidth: W.rule,
    borderBottomColor: C.line,
    paddingBottom: 8,
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
    marginHorizontal: 5,
    alignSelf: "stretch",
    minHeight: 44,
  },
  headerRightBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 3,
  },
  docNoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    marginBottom: 2,
  },
  docNoLabel: { fontSize: 9 },
  docDateRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
  },
  docDateLabel: { fontSize: 8.4 },
  docDateLine: {
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    minWidth: 132,
    fontSize: 8.4,
    paddingBottom: 2,
    textAlign: "center",
  },

  // ── Полета клиент (редове с подчертаване) ───────────────────────────────────
  fieldsBlock: {
    marginBottom: 6,
  },
  underlineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  ulLabel: {
    fontSize: 8.3,
    width: 118,
    paddingRight: 5,
  },
  ulLine: {
    flex: 1,
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    fontSize: 8.3,
    paddingBottom: 2,
    minHeight: 14,
  },
  ulTinyLabel: { fontSize: 8.3, marginLeft: 8, marginRight: 4 },
  ulTinyBox: {
    width: 42,
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    fontSize: 8.3,
    paddingBottom: 2,
    minHeight: 14,
    textAlign: "center",
  },

  twoColTop: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 6,
  },
  colLeft:  { flex: 1.15 },
  colRight: { flex: 0.85 },

  paidRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 5,
  },
  paidLbl: { fontSize: 8.3, width: 86 },
  paidLine: {
    flex: 1,
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    fontSize: 9,
    fontWeight: "bold",
    paddingBottom: 2,
    minHeight: 14,
    textAlign: "center",
  },

  mountHead: { fontSize: 8.3, marginBottom: 3 },
  mountRows: { gap: 4 },
  mountRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mountCell: { flexDirection: "row", alignItems: "center", gap: 4 },
  chk: {
    width: 8.5,
    height: 8.5,
    borderWidth: W.thin,
    borderColor: C.line,
    justifyContent: "center",
    alignItems: "center",
  },
  chkOn: {
    width: 8.5,
    height: 8.5,
    borderWidth: W.thin,
    borderColor: C.line,
    backgroundColor: C.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  chkMark: { fontSize: 6.2, color: "#fff", marginTop: -0.5 },
  mountTxt: { fontSize: 8 },

  // ── Голяма таблица материали ────────────────────────────────────────────────
  matOuter: {
    flexDirection: "row",
    borderWidth: W.thin,
    borderColor: C.line,
    marginBottom: 6,
    flexGrow: 1,
  },
  matHalf: { flex: 1, flexDirection: "column" },
  matHalfR: {
    flex: 1,
    flexDirection: "column",
    borderLeftWidth: W.thin,
    borderLeftColor: C.line,
  },
  matRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: W.hairline,
    borderBottomColor: C.line,
    flexGrow: 1,
    minHeight: 17,
  },
  matRowLast: {
    flexDirection: "row",
    alignItems: "stretch",
    flexGrow: 1,
    minHeight: 17,
  },
  matDesc: {
    flex: 1,
    paddingLeft: 5,
    paddingRight: 4,
    paddingVertical: 3,
    justifyContent: "center",
    fontSize: 8,
  },
  matQtyCell: {
    width: 32,
    borderLeftWidth: W.hairline,
    borderLeftColor: C.line,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 3,
    alignSelf: "stretch",
  },
  matQtyText: {
    fontSize: 8.2,
    textAlign: "center",
    width: "100%",
  },

  // ── Кабелни канали (като на бланката) ───────────────────────────────────────
  cableWrap: {
    borderWidth: W.thin,
    borderColor: C.line,
    paddingHorizontal: 7,
    paddingVertical: 6,
    marginBottom: 6,
    gap: 4,
  },
  /** Без flexWrap — иначе @react-pdf/renderer подрежда клетките криво и цифрите се припокриват с етикетите. */
  cableGridRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginBottom: 4,
  },
  cableCell: {
    flex: 1,
    flexDirection: "column",
    minWidth: 0,
  },
  cableCellSingle: {
    width: "38%",
    maxWidth: 160,
    flexDirection: "column",
  },
  cableLblCol: {
    fontSize: 8,
    marginBottom: 3,
    width: "100%",
  },
  cableBoxWrap: {
    width: "100%",
    borderBottomWidth: W.thin,
    borderBottomColor: C.dots,
    paddingBottom: 1,
    minHeight: 12,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  cableBoxText: {
    fontSize: 8,
    textAlign: "center",
    width: "100%",
  },

  notesHead: { fontSize: 8.4, marginBottom: 4 },
  notesBox: {
    borderWidth: W.thin,
    borderColor: C.line,
    minHeight: 52,
    padding: 7,
    marginBottom: 8,
  },
  notesLineText: { fontSize: 8.3, marginBottom: 6 },
  notesDots: {
    borderBottomWidth: W.hairline,
    borderBottomColor: C.line,
    marginBottom: 6,
    minHeight: 11,
  },

  sigWrap: {
    flexDirection: "row",
    gap: 14,
    marginTop: 8,
  },
  sigRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  sigLabel: {
    fontSize: 8.3,
    width: 74,
    paddingBottom: 5,
    paddingRight: 4,
  },
  sigArea: {
    flex: 1,
    borderBottomWidth: W.rule,
    borderBottomColor: C.line,
    backgroundColor: "#ffffff",
    minHeight: 54,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 1,
  },
  sigImg: {
    height: 50,
    width: "100%",
    objectFit: "contain",
    objectPosition: "center bottom",
  },

  footerFixed: {
    position: "absolute",
    bottom: 12,
    left: PAGE_PAD_H,
    right: PAGE_PAD_H,
    borderTopWidth: W.hairline,
    borderTopColor: C.line,
    paddingTop: 6,
  },
  footerTxt: {
    fontSize: 7.2,
    color: C.muted,
    textAlign: "center",
    lineHeight: 1.35,
  },

  photosPage: {
    fontFamily: FONT,
    fontSize: 8,
    paddingTop: PAGE_PAD_TOP,
    paddingBottom: PAGE_PAD_BOTTOM,
    paddingHorizontal: PAGE_PAD_H,
    color: C.ink,
  },
  photosTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 10,
    borderBottomWidth: W.rule,
    borderBottomColor: C.line,
    paddingBottom: 6,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoCell: {
    width: "48%",
    marginBottom: 8,
  },
  photoImg: {
    width: "100%",
    height: 180,
    objectFit: "cover",
    borderWidth: W.thin,
    borderColor: C.line,
  },
});

export interface ProtocolData {
  protocol_number: string;
  date: string;
  client_name?: string | null;
  ac_model?: string | null;
  serial_number?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
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
  photo_urls?: string[] | null;
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
  const cableChannelsM = Number(data.cable_channels_m ?? acc.cable_channels_m ?? 0);
  const dateStr = fmtDate(data.date);

  const cableSecondRowKeys = ["outer_corner", "inner_corner", "angle_out", "connector"] as const;
  const cableThirdRowKeys = ["inner_cap", "outer_cap", "end_cap", "holder"] as const;
  const photoUrls = (data.photo_urls ?? []).filter(u => typeof u === "string" && u.trim());

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
                <Text style={s.ulLabel}>Сериен № вътр.</Text>
                <Text style={s.ulLine}>{dash(data.indoor_unit_serial ?? data.serial_number)}</Text>
              </View>
              <View style={s.underlineRow}>
                <Text style={s.ulLabel}>Сериен № външ.</Text>
                <Text style={s.ulLine}>{dash(data.outdoor_unit_serial)}</Text>
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
                {data.paid_amount != null ? `€${data.paid_amount.toFixed(2)}` : ""}
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
            {PDF_LEFT_MATERIALS.map((mat, i) => {
              const last = i === PDF_LEFT_MATERIALS.length - 1;
              const Row = last ? s.matRowLast : s.matRow;
              return (
                <View key={mat.id} style={Row}>
                  <Text style={s.matDesc}>
                    {mat.name}/{mat.unit}
                  </Text>
                  <View style={s.matQtyCell}>
                    <Text style={s.matQtyText}>{qtyCell(resolveMaterialQty(mat.id, qtyMap))}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={s.matHalfR}>
            {PDF_RIGHT_MATERIALS.map((mat, i) => {
              const last = i === PDF_RIGHT_MATERIALS.length - 1;
              const Row = last ? s.matRowLast : s.matRow;
              return (
                <View key={mat.id} style={Row}>
                  <Text style={s.matDesc}>
                    {mat.name}/{mat.unit}
                  </Text>
                  <View style={s.matQtyCell}>
                    <Text style={s.matQtyText}>{qtyCell(resolveMaterialQty(mat.id, qtyMap))}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={s.cableWrap}>
          <View style={s.cableGridRow}>
            <View style={s.cableCellSingle}>
              <Text style={s.cableLblCol}>{ACCESSORIES_LABELS.cable_channels_m}</Text>
              <View style={s.cableBoxWrap}>
                <Text style={s.cableBoxText}>
                  {cableChannelsM > 0 ? String(cableChannelsM) : ""}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.cableGridRow}>
            {cableSecondRowKeys.map(k => (
              <View key={k} style={s.cableCell}>
                <Text style={s.cableLblCol}>{ACCESSORIES_LABELS[k]}</Text>
                <View style={s.cableBoxWrap}>
                  <Text style={s.cableBoxText}>{acc[k] ? String(acc[k]) : ""}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.cableGridRow}>
            {cableThirdRowKeys.map(k => (
              <View key={k} style={s.cableCell}>
                <Text style={s.cableLblCol}>{ACCESSORIES_LABELS[k]}</Text>
                <View style={s.cableBoxWrap}>
                  <Text style={s.cableBoxText}>{acc[k] ? String(acc[k]) : ""}</Text>
                </View>
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
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Монтажна група</Text>
            <View style={s.sigArea}>
              {data.signature_team ? (
                <Image src={data.signature_team} style={s.sigImg} />
              ) : null}
            </View>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>Подпис на клиента:</Text>
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

      {photoUrls.length > 0 && (
        <Page size="A4" style={s.photosPage}>
          <Text style={s.photosTitle}>Снимки от монтажа</Text>
          <View style={s.photosGrid}>
            {photoUrls.map((url, i) => (
              <View key={`${url}-${i}`} style={s.photoCell}>
                <Image src={url} style={s.photoImg} />
              </View>
            ))}
          </View>
          <View style={s.footerFixed} fixed>
            <Text style={s.footerTxt}>
              Смолян Клима ЕООД, ЕИК: BG 204223522 гр. Смолян ул. Елица № 36 Тел: 0888 58 58 16
            </Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
