/**
 * PDF оферта — компактна, бранд-стилизирана бланка.
 * Цени само в евро (EUR). Без letterSpacing (бърка кирилица в react-pdf).
 */
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import { ProtocolPdfBrandMark } from "@/lib/protocol-pdf-brand";
import { COMPANY_INFO } from "@/lib/company/companyInfo";
import type { OfferItemRow, OfferRow } from "@/lib/offers/offerTypes";
import type { OfferSpecRow } from "@/lib/offers/buildSpecsFromProduct";

const NOTO_REG =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const NOTO_BOLD =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf";

Font.register({
  family: "NotoSans",
  fonts: [
    { src: NOTO_REG, fontWeight: 400 },
    { src: NOTO_BOLD, fontWeight: 700 },
  ],
});

const C = {
  ink: "#111827",
  muted: "#64748B",
  line: "#E2E8F0",
  orange: "#FF4D00",
  cyan: "#00B4D8",
  cyanDark: "#0077B6",
  soft: "#FFF5ED",
  softBlue: "#F0F9FF",
  white: "#FFFFFF",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 8.5,
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 22,
    color: C.ink,
    lineHeight: 1.25,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: C.orange,
  },
  headerRight: { alignItems: "flex-end", maxWidth: "42%", flexDirection: "column" },
  docTitle: { fontSize: 14, fontWeight: 700, color: C.orange, marginBottom: 6, lineHeight: 1.45 },
  docMeta: { fontSize: 7.5, color: C.muted, marginBottom: 3, lineHeight: 1.4 },
  addr: { fontSize: 7, color: C.muted, marginTop: 4, lineHeight: 1.35 },

  titleBlock: { marginBottom: 6 },
  mainTitle: { fontSize: 11, fontWeight: 700, color: C.ink, marginBottom: 1 },
  objectLine: { fontSize: 8, color: C.muted },

  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  metaBox: {
    flex: 1,
    backgroundColor: C.softBlue,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderLeftWidth: 2.5,
    borderLeftColor: C.cyan,
  },
  metaLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    color: C.cyanDark,
    marginBottom: 4,
    lineHeight: 1.35,
    textTransform: "uppercase",
  },
  metaValue: { fontSize: 8, fontWeight: 700, color: C.ink, lineHeight: 1.35, marginBottom: 2 },
  metaPrice: { fontSize: 13, fontWeight: 700, color: C.orange, lineHeight: 1.5, marginTop: 2, marginBottom: 5 },
  metaSub: { fontSize: 7, color: C.muted, lineHeight: 1.35 },

  sectionBar: {
    backgroundColor: C.soft,
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 8, fontWeight: 700, color: C.orange, textTransform: "uppercase" },

  intro: { fontSize: 7.5, color: C.muted, marginBottom: 4 },

  groupLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: C.cyanDark,
    marginTop: 4,
    marginBottom: 2,
    textTransform: "uppercase",
  },

  itemCard: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 5,
    backgroundColor: C.white,
  },
  itemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  itemTitle: { fontSize: 9, fontWeight: 700, color: C.ink, maxWidth: "72%" },
  itemPrice: { fontSize: 9, fontWeight: 700, color: C.orange },
  itemType: { fontSize: 7, color: C.cyanDark, marginBottom: 2 },
  itemDesc: { fontSize: 7, color: C.muted, marginBottom: 3 },

  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    paddingTop: 3,
  },
  specCell: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingRight: 6,
    paddingVertical: 1,
  },
  specLabel: { fontSize: 6.5, color: C.muted, maxWidth: "58%" },
  specValue: { fontSize: 6.5, fontWeight: 700, color: C.ink, maxWidth: "40%", textAlign: "right" },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.ink,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  th: { fontSize: 6.5, fontWeight: 700, color: C.white, textTransform: "uppercase" },
  td: { fontSize: 7.5, color: C.ink },
  colName: { width: "48%" },
  colQty: { width: "10%", textAlign: "center" },
  colUnit: { width: "14%", textAlign: "right" },
  colInstall: { width: "14%", textAlign: "right" },
  colTotal: { width: "14%", textAlign: "right" },

  totalsWrap: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsBox: {
    width: 200,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.line,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: C.softBlue,
  },
  totalLabel: { fontSize: 7.5, color: C.muted },
  totalValue: { fontSize: 8, fontWeight: 700 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: C.orange,
  },
  grandLabel: { fontSize: 9, fontWeight: 700, color: C.white, lineHeight: 1.4 },
  grandValue: { fontSize: 12, fontWeight: 700, color: C.white, lineHeight: 1.45 },

  terms: { fontSize: 7, color: C.muted, lineHeight: 1.3 },

  footer: {
    position: "absolute",
    bottom: 10,
    left: 22,
    right: 22,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.5, color: C.muted },
});

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("bg-BG");
  } catch {
    return v;
  }
}

/** Суми в офертата са в EUR → показваме директно в евро. */
function toEur(amount: number, currency: string): number {
  const n = Number(amount) || 0;
  if ((currency || "EUR").toUpperCase() === "BGN") return Math.round((n / 1.95583) * 100) / 100;
  return Math.round(n * 100) / 100;
}

function eur(n: number): string {
  return `€${n.toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function itemLineTotal(item: OfferItemRow): number {
  const qty = Number(item.quantity) || 0;
  const unit = Number(item.unit_price) || 0;
  const install = Number(item.install_price) || 0;
  return qty * (unit + install);
}

function itemDisplayName(item: OfferItemRow): string {
  const parts = [item.brand_name, item.model_code || item.name].filter(Boolean);
  return parts.join(" ") || item.name;
}

function clip(text: string | null | undefined, max: number): string {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function OfferPDF({ data }: { data: OfferRow & { items: OfferItemRow[] } }) {
  const items = data.items ?? [];
  const currency = data.currency || "EUR";
  let lastGroup: string | null = null;

  const finalEur = toEur(Number(data.total_incl_vat), currency);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <ProtocolPdfBrandMark />
            <Text style={s.addr}>
              {COMPANY_INFO.tradeAddress} · {COMPANY_INFO.phone}
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.docTitle}>Оферта</Text>
            <Text style={s.docMeta}>№ {data.offer_number}</Text>
            <Text style={s.docMeta}>Дата: {fmtDate(data.created_at)}</Text>
            {data.valid_until ? <Text style={s.docMeta}>Валидна до: {fmtDate(data.valid_until)}</Text> : null}
          </View>
        </View>

        {(data.title || data.object_note) && (
          <View style={s.titleBlock}>
            {data.title ? <Text style={s.mainTitle}>{data.title}</Text> : null}
            {data.object_note ? <Text style={s.objectLine}>Обект: {data.object_note}</Text> : null}
          </View>
        )}

        <View style={s.metaRow}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Клиент</Text>
            <Text style={s.metaValue}>{data.client_name || "—"}</Text>
            {data.client_phone ? <Text style={s.metaSub}>Тел.: {data.client_phone}</Text> : null}
            {data.client_email ? <Text style={s.metaSub}>{data.client_email}</Text> : null}
            {data.client_address ? <Text style={s.metaSub}>{data.client_address}</Text> : null}
          </View>
          <View style={[s.metaBox, { borderLeftColor: C.orange, backgroundColor: C.soft }]}>
            <Text style={[s.metaLabel, { color: C.orange }]}>Крайна цена</Text>
            <Text style={s.metaPrice}>{eur(finalEur)}</Text>
            <Text style={s.metaSub}>с включен ДДС {data.vat_rate}%</Text>
          </View>
        </View>

        {data.intro_note ? <Text style={s.intro}>{clip(data.intro_note, 420)}</Text> : null}

        <View style={s.sectionBar}>
          <Text style={s.sectionTitle}>Предложени климатици</Text>
        </View>

        {items.map((item) => {
          const showGroup = item.group_label && item.group_label !== lastGroup;
          if (item.group_label) lastGroup = item.group_label;
          const specs = (Array.isArray(item.specs) ? item.specs : []) as OfferSpecRow[];
          const lineEur = toEur(itemLineTotal(item), currency);
          const unitEur = toEur(Number(item.unit_price), currency);
          const installEur = item.install_price != null ? toEur(Number(item.install_price), currency) : null;

          return (
            <View key={item.id}>
              {showGroup ? <Text style={s.groupLabel}>{item.group_label}</Text> : null}
              <View style={s.itemCard}>
                <View style={s.itemHead}>
                  <Text style={s.itemTitle}>{itemDisplayName(item)}</Text>
                  <Text style={s.itemPrice}>{eur(lineEur)}</Text>
                </View>
                {item.type_name ? <Text style={s.itemType}>{item.type_name}</Text> : null}
                {item.description ? <Text style={s.itemDesc}>{clip(item.description, 280)}</Text> : null}
                {specs.length > 0 ? (
                  <View style={s.specsGrid}>
                    {specs.slice(0, 10).map((sp, i) => (
                      <View key={`${item.id}-sp-${i}`} style={s.specCell}>
                        <Text style={s.specLabel}>{sp.label}</Text>
                        <Text style={s.specValue}>{sp.value}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 4 }}>
                  <View style={{ flex: 1, minWidth: 80 }}>
                    <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>Количество</Text>
                    <Text style={{ fontSize: 8, fontWeight: 700 }}>{item.quantity}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 80 }}>
                    <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>Ед. цена</Text>
                    <Text style={{ fontSize: 8, fontWeight: 700 }}>{eur(unitEur)}</Text>
                  </View>
                  {installEur != null && (
                    <View style={{ flex: 1, minWidth: 80 }}>
                      <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>Монтаж</Text>
                      <Text style={{ fontSize: 8, fontWeight: 700 }}>{eur(installEur)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 80 }}>
                    <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>Общо</Text>
                    <Text style={{ fontSize: 8, fontWeight: 700, color: C.orange }}>{eur(lineEur)}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        <View style={s.sectionBar}>
          <Text style={s.sectionTitle}>Ценова таблица</Text>
        </View>
        <View style={s.tableHeader}>
          <Text style={[s.th, s.colName]}>Артикул</Text>
          <Text style={[s.th, s.colQty]}>Кол.</Text>
          <Text style={[s.th, s.colUnit]}>Ед. цена</Text>
          <Text style={[s.th, s.colInstall]}>Монтаж</Text>
          <Text style={[s.th, s.colTotal]}>Общо</Text>
        </View>
        {items.map((item) => (
          <View key={`t-${item.id}`} style={s.tableRow}>
            <Text style={[s.td, s.colName]}>{clip(itemDisplayName(item), 48)}</Text>
            <Text style={[s.td, s.colQty]}>{item.quantity}</Text>
            <Text style={[s.td, s.colUnit]}>{eur(toEur(Number(item.unit_price), currency))}</Text>
            <Text style={[s.td, s.colInstall]}>
              {item.install_price != null ? eur(toEur(Number(item.install_price), currency)) : "—"}
            </Text>
            <Text style={[s.td, s.colTotal, { fontWeight: 700 }]}>
              {eur(toEur(itemLineTotal(item), currency))}
            </Text>
          </View>
        ))}

        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            {Number(data.discount_total) > 0 ? (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Отстъпка</Text>
                <Text style={s.totalValue}>−{eur(toEur(Number(data.discount_total), currency))}</Text>
              </View>
            ) : null}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Без ДДС</Text>
              <Text style={s.totalValue}>{eur(toEur(Number(data.base_excl_vat), currency))}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>ДДС ({data.vat_rate}%)</Text>
              <Text style={s.totalValue}>{eur(toEur(Number(data.vat_amount), currency))}</Text>
            </View>
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Крайна цена</Text>
              <Text style={s.grandValue}>{eur(finalEur)}</Text>
            </View>
          </View>
        </View>

        {data.terms_note ? (
          <>
            <View style={[s.sectionBar, { marginTop: 8 }]}>
              <Text style={s.sectionTitle}>Условия</Text>
            </View>
            <Text style={s.terms}>{clip(data.terms_note, 900)}</Text>
          </>
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {COMPANY_INFO.legalName} · ЕИК {COMPANY_INFO.eik} · ДДС {COMPANY_INFO.vatNumber}
          </Text>
          <Text style={s.footerText}>
            {COMPANY_INFO.website} · {COMPANY_INFO.email}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Транслитерация на кирилица → латиница за ASCII имена на файлове (Windows). */
function cyrillicToLatin(input: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
    А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ж: "Zh", З: "Z", И: "I", Й: "Y",
    К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F",
    Х: "H", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Sht", Ъ: "A", Ь: "Y", Ю: "Yu", Я: "Ya",
  };
  return input
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
}

function offerDatePart(created_at?: string | null): string {
  try {
    const d = created_at ? new Date(created_at) : new Date();
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function clientSlug(name: string | null | undefined, ascii = false): string {
  let s = (name || "klient").trim();
  if (ascii) s = cyrillicToLatin(s);
  return (
    s
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "klient"
  );
}

/** Име на файла: oferta-{клиент}-{дата}.pdf (може да съдържа кирилица). */
export function buildOfferPdfFilename(data: {
  client_name?: string | null;
  created_at?: string | null;
  offer_number?: string | null;
}): string {
  const client = (data.client_name || "klient")
    .replace(/[^a-zA-Zа-яА-Я0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "klient";
  return `oferta-${client}-${offerDatePart(data.created_at)}.pdf`;
}

/** ASCII име с транслитерирано име на клиент (Windows Save As диалог). */
export function buildOfferPdfFilenameAscii(data: {
  client_name?: string | null;
  created_at?: string | null;
  offer_number?: string | null;
}): string {
  const client = clientSlug(data.client_name, true);
  return `oferta-${client}-${offerDatePart(data.created_at)}.pdf`;
}

/** Content-Disposition header — ASCII fallback + UTF-8 име. */
export function offerPdfContentDisposition(data: {
  client_name?: string | null;
  created_at?: string | null;
  offer_number?: string | null;
}): string {
  const utf8 = buildOfferPdfFilename(data);
  const ascii = buildOfferPdfFilenameAscii(data);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`;
}
