/**
 * PDF шаблон за сервизен (профилактика/ремонт/диагностика) протокол.
 *
 * Различен от приемно-предавателния PDF (`lib/protocol-pdf.tsx`).
 * Фокусира се върху измервания, профилактика и оценка вместо върху
 * списък материали и аксесоари.
 *
 * Шрифт: Noto Sans (кирилица); Helvetica често дава „кракозябри“.
 */
import React from "react";
import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from "@react-pdf/renderer";
import { ProtocolPdfBrandMark } from "@/lib/protocol-pdf-brand";
import {
  FREON_CHARGE_LABEL, BEARINGS_LABEL, NOISE_LABEL, SERVICE_KIND_LABEL,
  type FreonChargeMethod, type BearingsState, type NoiseLevel, type RepairServiceKind,
} from "@/lib/repair-protocol-fields";

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

const C = {
  ink:    "#000000",
  muted:  "#333333",
  line:   "#000000",
  faint:  "#888888",
  accent: "#0077B6",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 9,
    paddingTop: 14,
    paddingBottom: 36,
    paddingHorizontal: 18,
    color: C.ink,
    lineHeight: 1.18,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1.1, flexDirection: "row", alignItems: "center" },
  headerRight: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
  docTitle: { fontSize: 12, fontWeight: "bold" },
  docNo: { fontSize: 10, marginTop: 2 },
  docDate: { fontSize: 9, marginTop: 1, color: C.muted },

  // Sections
  section: {
    marginBottom: 8,
    borderWidth: 0.6,
    borderColor: C.line,
    borderRadius: 2,
  },
  sectionTitle: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: "bold",
    borderBottomWidth: 0.4,
    borderBottomColor: C.line,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionBody: { padding: 6 },

  // Grid for fields
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "50%",
    paddingRight: 6,
    paddingBottom: 4,
  },
  cell3: {
    width: "33.33%",
    paddingRight: 6,
    paddingBottom: 4,
  },
  cell4: {
    width: "25%",
    paddingRight: 6,
    paddingBottom: 4,
  },
  cellLabel: { fontSize: 7.5, color: C.muted, marginBottom: 1 },
  cellValue: {
    fontSize: 9,
    fontWeight: "bold",
    borderBottomWidth: 0.4,
    borderBottomColor: C.faint,
    paddingBottom: 1,
    minHeight: 12,
  },

  // Notes
  notesBox: {
    minHeight: 40,
    borderWidth: 0.4,
    borderColor: C.line,
    padding: 4,
    fontSize: 9,
  },

  // Star rating
  ratingRow: { flexDirection: "row", alignItems: "center" },
  starFilled: {
    width: 14, height: 14, marginRight: 1,
    backgroundColor: "#FF4D00",
    borderWidth: 0.4, borderColor: "#000",
  },
  starEmpty: {
    width: 14, height: 14, marginRight: 1,
    backgroundColor: "#ffffff",
    borderWidth: 0.4, borderColor: "#cbd5e1",
  },
  ratingText: { fontSize: 9, fontWeight: "bold", marginLeft: 4, color: C.accent },

  // Signatures
  sigRow: { flexDirection: "row", gap: 14, marginTop: 8 },
  sigBox: { flex: 1 },
  sigTitle: { fontSize: 8.5, fontWeight: "bold", marginBottom: 4 },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    height: 38,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sigImg: { maxHeight: 36, maxWidth: "100%", marginBottom: 2 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 12,
    left: 18,
    right: 18,
    textAlign: "center",
    fontSize: 7.5,
    color: C.muted,
    borderTopWidth: 0.4,
    borderTopColor: C.faint,
    paddingTop: 4,
  },
});

interface RepairProtocolData {
  protocol_number: string;
  date: string;
  service_kind?: RepairServiceKind | null;

  client_name: string | null;
  ac_brand: string | null;
  ac_model: string | null;
  serial_number: string | null;
  address: string | null;
  paid_amount: number | null;
  client_email: string | null;
  client_phone: string | null;

  is_japanese_brand: boolean | null;
  freon_charge_method: FreonChargeMethod | null;
  refrigerant_type: string | null;
  refrigerant_amount_g: number | null;

  vacuum_cleaning_done: boolean | null;
  valves_ok: boolean | null;
  outdoor_bearings_state: BearingsState | null;
  indoor_bearings_state: BearingsState | null;

  pressure_cold_bar: number | null;
  pressure_hot_bar: number | null;
  consumption_cold_kw: number | null;
  consumption_hot_kw: number | null;

  original_remote: boolean | null;
  outdoor_noise_level: NoiseLevel | null;

  welds_indoor_heat_exchanger: boolean | null;
  welds_outdoor_heat_exchanger: boolean | null;
  welds_pipes: boolean | null;
  indoor_mechanism_repaired: boolean | null;
  broken_turbine: boolean | null;

  service_rating: number | null;

  notes: string | null;
  signature_team: string | null;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function boolText(v: boolean | null | undefined): string {
  if (v === true) return "Да";
  if (v === false) return "Не";
  return "—";
}

function PdfCell({
  label, value, width,
}: { label: string; value: string | number | null | undefined; width?: "half" | "third" | "quarter" }) {
  const style =
    width === "third" ? s.cell3 :
    width === "quarter" ? s.cell4 :
    s.cell;
  const displayed = value == null || value === "" ? "—" : String(value);
  return (
    <View style={style}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={s.cellValue}>{displayed}</Text>
    </View>
  );
}

export function RepairProtocolPDF({ data }: { data: RepairProtocolData }) {
  const rating = data.service_rating ?? 0;
  const isRecycle = data.service_kind === "recycle";
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <ProtocolPdfBrandMark />
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>СЕРВИЗЕН ПРОТОКОЛ</Text>
            <Text style={s.docNo}>№ {data.protocol_number}</Text>
            <Text style={s.docDate}>от дата {fmtDate(data.date)}</Text>
            <Text style={s.docDate}>
              {SERVICE_KIND_LABEL[isRecycle ? "recycle" : "client"]}
            </Text>
          </View>
        </View>

        {/* Клиент — само за клиентски сервиз */}
        {!isRecycle && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Клиент</Text>
            <View style={s.sectionBody}>
              <View style={s.grid}>
                <PdfCell label="Име" value={data.client_name} />
                <PdfCell label="Телефон" value={data.client_phone} />
                <PdfCell label="Имейл" value={data.client_email} />
                <PdfCell label="Адрес" value={data.address} />
              </View>
            </View>
          </View>
        )}

        {/* Климатик */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Климатик</Text>
          <View style={s.sectionBody}>
            <View style={s.grid}>
              <PdfCell label="Марка" value={data.ac_brand} />
              <PdfCell label="Модел" value={data.ac_model} />
              {!isRecycle && <PdfCell label="Сериен №" value={data.serial_number} />}
              <PdfCell label="Японски" value={data.is_japanese_brand === null ? "—" : boolText(data.is_japanese_brand)} />
            </View>
          </View>
        </View>

        {/* Профилактика */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Профилактика и механика</Text>
          <View style={s.sectionBody}>
            <View style={s.grid}>
              <PdfCell
                label="Фреон / зареждане"
                value={data.freon_charge_method ? FREON_CHARGE_LABEL[data.freon_charge_method] : "—"}
              />
              <PdfCell label="Вид хладилен агент" value={data.refrigerant_type} />
              <PdfCell
                label="Количество сложено"
                value={data.refrigerant_amount_g != null ? `${data.refrigerant_amount_g} г` : "—"}
              />
              <PdfCell label="Прахосмукачка" value={boolText(data.vacuum_cleaning_done)} />
              <PdfCell label="Клапи" value={boolText(data.valves_ok)} />
              <PdfCell label="Оригинално дистанционно" value={boolText(data.original_remote)} />
              <PdfCell
                label="Лагери на външно тяло"
                value={data.outdoor_bearings_state ? BEARINGS_LABEL[data.outdoor_bearings_state] : "—"}
              />
              <PdfCell
                label="Лагери на вътрешно тяло"
                value={data.indoor_bearings_state ? BEARINGS_LABEL[data.indoor_bearings_state] : "—"}
              />
            </View>
          </View>
        </View>

        {/* Измервания */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Измервания</Text>
          <View style={s.sectionBody}>
            <View style={s.grid}>
              <PdfCell
                label="Налягане (студено)"
                value={data.pressure_cold_bar != null ? `${data.pressure_cold_bar} bar` : "—"}
                width="quarter"
              />
              <PdfCell
                label="Налягане (топло)"
                value={data.pressure_hot_bar != null ? `${data.pressure_hot_bar} bar` : "—"}
                width="quarter"
              />
              <PdfCell
                label="Консумация (студено)"
                value={data.consumption_cold_kw != null ? `${data.consumption_cold_kw} kW` : "—"}
                width="quarter"
              />
              <PdfCell
                label="Консумация (топло)"
                value={data.consumption_hot_kw != null ? `${data.consumption_hot_kw} kW` : "—"}
                width="quarter"
              />
              <PdfCell
                label="Шум на външно тяло"
                value={data.outdoor_noise_level ? NOISE_LABEL[data.outdoor_noise_level] : "—"}
              />
            </View>
          </View>
        </View>

        {/* Заварки и ремонти */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Заварки и ремонти</Text>
          <View style={s.sectionBody}>
            <View style={s.grid}>
              <PdfCell label="Заварки топлообменник (вътре)" value={boolText(data.welds_indoor_heat_exchanger)} />
              <PdfCell label="Заварки топлообменник (вънка)" value={boolText(data.welds_outdoor_heat_exchanger)} />
              <PdfCell label="Заварки тръби" value={boolText(data.welds_pipes)} />
              <PdfCell label="Ремонт механика (вътрешно)" value={boolText(data.indoor_mechanism_repaired)} />
              <PdfCell label="Счупена турбина" value={boolText(data.broken_turbine)} />
            </View>
          </View>
        </View>

        {/* Оценка */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Сервизна оценка</Text>
          <View style={s.sectionBody}>
            <View style={s.ratingRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <View key={n} style={n <= rating ? s.starFilled : s.starEmpty} />
              ))}
              <Text style={s.ratingText}>
                {data.service_rating != null ? `${data.service_rating}/5` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Забележки */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Забележки</Text>
          <View style={s.sectionBody}>
            <View style={s.notesBox}>
              <Text>{data.notes?.trim() || ""}</Text>
            </View>
          </View>
        </View>

        {/* Подпис */}
        <View style={{ marginTop: 8, alignItems: "center" }}>
          <View style={{ width: "62%" }}>
            <Text style={s.sigTitle}>Подпис на сервизен техник</Text>
            <View style={s.sigLine}>
              {data.signature_team ? <Image src={data.signature_team} style={s.sigImg} /> : null}
            </View>
          </View>
        </View>

        <Text style={s.footer}>
          Смолян Клима ЕООД · ЕИК: BG 204223522 · гр. Смолян, ул. Елица № 36 · Тел: 0878 58 16 16
        </Text>
      </Page>
    </Document>
  );
}
