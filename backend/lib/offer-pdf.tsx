/**
 * PDF оферта — компактна, бранд-стилизирана бланка.
 * Цени само в евро (EUR). Без letterSpacing (бърка кирилица в react-pdf).
 */
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font, Link, Image } from "@react-pdf/renderer";
import { ProtocolPdfBrandMark } from "@/lib/protocol-pdf-brand";
import { COMPANY_INFO } from "@/lib/company/companyInfo";
import type { OfferItemRow, OfferRow } from "@/lib/offers/offerTypes";
import type { OfferItemPdfRow } from "@/lib/offers/offerPdfImages";
import type { OfferSpecRow } from "@/lib/offers/buildSpecsFromProduct";
import { lineTotal as calcOfferLineTotal, effectiveUnitPrice, lineTradeDiscountAmount, totalTradeDiscountAmount, formatTradeDiscountWithAmount, TRADE_DISCOUNT_LABEL } from "@/lib/offers/calcTotals";
import { sanitizeOfferDescription } from "@/lib/offers/sanitizeOfferDescription";
import { splitOfferTermsEmphasis } from "@/lib/offers/formatOfferTermsDisplay";

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
    paddingBottom: 36,
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

  intro: { fontSize: 7.5, color: C.muted, marginBottom: 4, lineHeight: 1.35 },

  terms: { fontSize: 7, color: C.muted, lineHeight: 1.35 },
  termsEmphasis: { fontSize: 7, fontWeight: 700, color: C.ink, lineHeight: 1.35, marginTop: 4 },

  ctaBanner: {
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: C.ink,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  ctaTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: C.white,
    marginBottom: 5,
    textAlign: "center",
    lineHeight: 1.35,
  },
  ctaSub: {
    fontSize: 8,
    color: "#D1D5DB",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 1.4,
    maxWidth: 380,
  },
  ctaPhoneBtn: {
    backgroundColor: C.orange,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  ctaPhoneText: { fontSize: 10, fontWeight: 700, color: C.white },

  signOff: {
    marginTop: 48,
    marginBottom: 36,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 6,
  },
  signOffLabel: { fontSize: 8.5, color: C.ink },
  signOffLine: {
    width: 140,
    borderBottomWidth: 0.5,
    borderBottomColor: C.muted,
    marginBottom: 2,
  },
  signOffName: { fontSize: 8.5, fontWeight: 700, color: C.ink },

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
  itemCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  itemImageWrap: {
    width: 76,
    height: 76,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: C.line,
    backgroundColor: "#F8FAFC",
    flexShrink: 0,
    overflow: "hidden",
  },
  itemImage: {
    width: 76,
    height: 76,
    objectFit: "contain",
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
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
  itemDesc: { fontSize: 7, color: C.muted, marginBottom: 3, lineHeight: 1.35 },

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
    alignItems: "flex-start",
    backgroundColor: C.ink,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  th: { fontSize: 6.5, fontWeight: 700, color: C.white, textTransform: "uppercase", lineHeight: 1.25 },
  td: { fontSize: 7, color: C.ink, lineHeight: 1.3 },
  tdBold: { fontSize: 7, fontWeight: 700, color: C.ink, lineHeight: 1.3 },
  colName: { width: "40%", paddingRight: 6 },
  colQty: { width: "5%" },
  colUnit: { width: "12%" },
  colTo: { width: "18%" },
  colInstall: { width: "11%" },
  colTotal: { width: "14%" },
  cellRight: { alignItems: "flex-end" },
  cellCenter: { alignItems: "center" },

  totalsWrap: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsBox: {
    width: 240,
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
  return calcOfferLineTotal({
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    install_price: item.install_price,
    trade_discount_percent: item.trade_discount_percent,
  });
}

function itemEffectiveUnitEur(item: OfferItemRow, currency: string): number {
  return toEur(
    effectiveUnitPrice({
      quantity: 1,
      unit_price: Number(item.unit_price) || 0,
      trade_discount_percent: item.trade_discount_percent,
    }),
    currency,
  );
}

function itemDisplayName(item: OfferItemRow): string {
  const parts = [item.brand_name, item.model_code || item.name].filter(Boolean);
  return parts.join(" ") || item.name;
}

function itemToCalcLine(item: OfferItemRow) {
  return {
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    install_price: item.install_price,
    trade_discount_percent: item.trade_discount_percent,
  };
}

function pdfTradeDiscountLabel(item: OfferItemRow, currency: string): string {
  const line = itemToCalcLine(item);
  const amount = toEur(lineTradeDiscountAmount(line), currency);
  return formatTradeDiscountWithAmount(item.trade_discount_percent, amount, currency);
}

function offerItemPdfImageSrc(item: OfferItemPdfRow): string | null {
  const src = (item.pdf_image_src ?? "").trim();
  return src || null;
}

export function OfferPDF({ data }: { data: OfferRow & { items: OfferItemPdfRow[] } }) {
  const items = data.items ?? [];
  const currency = data.currency || "EUR";
  let lastGroup: string | null = null;

  const finalEur = toEur(Number(data.total_incl_vat), currency);
  const tradeDiscountTotalEur = toEur(
    totalTradeDiscountAmount(items.map(itemToCalcLine)),
    currency,
  );

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
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

        {data.intro_note ? <Text style={s.intro}>{data.intro_note}</Text> : null}

        <View style={s.sectionBar}>
          <Text style={s.sectionTitle}>Предложени климатици</Text>
        </View>

        {items.map((item) => {
          const showGroup = item.group_label && item.group_label !== lastGroup;
          if (item.group_label) lastGroup = item.group_label;
          const specs = (Array.isArray(item.specs) ? item.specs : []) as OfferSpecRow[];
          const lineEur = toEur(itemLineTotal(item), currency);
          const unitEur = toEur(Number(item.unit_price), currency);
          const unitAfterToEur = itemEffectiveUnitEur(item, currency);
          const installEur = item.install_price != null ? toEur(Number(item.install_price), currency) : null;
          const toLabel = pdfTradeDiscountLabel(item, currency);
          const imageSrc = offerItemPdfImageSrc(item);

          return (
            <View key={item.id}>
              {showGroup ? <Text style={s.groupLabel}>{item.group_label}</Text> : null}
              <View style={s.itemCard}>
                <View style={s.itemCardRow}>
                  {imageSrc ? (
                    <View style={s.itemImageWrap}>
                      <Image src={imageSrc} style={s.itemImage} />
                    </View>
                  ) : null}
                  <View style={s.itemBody}>
                <View style={s.itemHead}>
                  <Text style={s.itemTitle}>{itemDisplayName(item)}</Text>
                  <Text style={s.itemPrice}>{eur(lineEur)}</Text>
                </View>
                {item.type_name ? <Text style={s.itemType}>{item.type_name}</Text> : null}
                {item.description ? (
                  <Text style={s.itemDesc}>{sanitizeOfferDescription(item.description) ?? ""}</Text>
                ) : null}
                {specs.length > 0 ? (
                  <View style={s.specsGrid}>
                    {specs.map((sp, i) => (
                      <View key={`${item.id}-sp-${i}`} style={s.specCell}>
                        <Text style={s.specLabel}>{sp.label}</Text>
                        <Text style={s.specValue}>{sp.value}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 4 }}>
                  <View style={{ flex: 1, minWidth: 80 }}>
                    <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>Бройки</Text>
                    <Text style={{ fontSize: 8, fontWeight: 700 }}>{item.quantity}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 80 }}>
                    <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>Ед. цена</Text>
                    <Text style={{ fontSize: 8, fontWeight: 700 }}>{eur(unitEur)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 56 }}>
                    <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>{TRADE_DISCOUNT_LABEL}</Text>
                    <Text style={{ fontSize: 8, fontWeight: 700 }}>{toLabel}</Text>
                  </View>
                  {Number(item.trade_discount_percent) > 0 ? (
                    <View style={{ flex: 1, minWidth: 80 }}>
                      <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>След {TRADE_DISCOUNT_LABEL.toLowerCase()}</Text>
                      <Text style={{ fontSize: 8, fontWeight: 700 }}>{eur(unitAfterToEur)}</Text>
                    </View>
                  ) : null}
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
              </View>
            </View>
          );
        })}

        <View style={s.sectionBar}>
          <Text style={s.sectionTitle}>Ценова таблица</Text>
        </View>
        <View style={s.tableHeader}>
          <View style={s.colName}>
            <Text style={s.th}>Артикул</Text>
          </View>
          <View style={[s.colQty, s.cellCenter]}>
            <Text style={[s.th, { textAlign: "center" }]}>Бр.</Text>
          </View>
          <View style={[s.colUnit, s.cellRight]}>
            <Text style={[s.th, { textAlign: "right" }]}>Ед. цена</Text>
          </View>
          <View style={[s.colTo, s.cellCenter]}>
            <Text style={[s.th, { textAlign: "center", fontSize: 5.5, lineHeight: 1.2 }]}>{TRADE_DISCOUNT_LABEL}</Text>
          </View>
          <View style={[s.colInstall, s.cellRight]}>
            <Text style={[s.th, { textAlign: "right" }]}>Монтаж</Text>
          </View>
          <View style={[s.colTotal, s.cellRight]}>
            <Text style={[s.th, { textAlign: "right" }]}>Общо</Text>
          </View>
        </View>
        {items.map((item) => (
          <View key={`t-${item.id}`} style={s.tableRow}>
            <View style={s.colName}>
              <Text style={s.td}>{itemDisplayName(item)}</Text>
            </View>
            <View style={[s.colQty, s.cellCenter]}>
              <Text style={[s.tdBold, { textAlign: "center" }]}>{item.quantity}</Text>
            </View>
            <View style={[s.colUnit, s.cellRight]}>
              <Text style={[s.td, { textAlign: "right" }]}>{eur(toEur(Number(item.unit_price), currency))}</Text>
            </View>
            <View style={[s.colTo, s.cellCenter]}>
              <Text style={[s.td, { textAlign: "center", fontSize: 6.5 }]}>{pdfTradeDiscountLabel(item, currency)}</Text>
            </View>
            <View style={[s.colInstall, s.cellRight]}>
              <Text style={[s.td, { textAlign: "right" }]}>
                {item.install_price != null ? eur(toEur(Number(item.install_price), currency)) : "—"}
              </Text>
            </View>
            <View style={[s.colTotal, s.cellRight]}>
              <Text style={[s.tdBold, { textAlign: "right" }]}>
                {eur(toEur(itemLineTotal(item), currency))}
              </Text>
            </View>
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
            {tradeDiscountTotalEur > 0 ? (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Обща {TRADE_DISCOUNT_LABEL.toLowerCase()}</Text>
                <Text style={[s.totalValue, { color: C.orange }]}>{eur(tradeDiscountTotalEur)}</Text>
              </View>
            ) : null}
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Крайна цена</Text>
              <Text style={s.grandValue}>{eur(finalEur)}</Text>
            </View>
          </View>
        </View>

        {data.terms_note ? (() => {
          const { body, emphasis } = splitOfferTermsEmphasis(data.terms_note);
          return (
            <>
              <View style={[s.sectionBar, { marginTop: 8 }]}>
                <Text style={s.sectionTitle}>Условия</Text>
              </View>
              {body ? <Text style={s.terms}>{body}</Text> : null}
              {emphasis ? <Text style={s.termsEmphasis}>{emphasis}</Text> : null}
            </>
          );
        })() : null}

        <View style={s.ctaBanner}>
          <Text style={s.ctaTitle}>Готови сме да монтираме</Text>
          <Text style={s.ctaSub}>
            Потвърдете офертата по телефона и нашият екип ще се свърже с вас за уточняване на детайлите и
            удобна дата за монтаж.
          </Text>
          <Link src={`tel:${COMPANY_INFO.phoneE164}`} style={{ textDecoration: "none" }}>
            <View style={s.ctaPhoneBtn}>
              <Text style={s.ctaPhoneText}>Потвърди офертата · {COMPANY_INFO.phone}</Text>
            </View>
          </Link>
        </View>

        <View style={s.signOff}>
          <Text style={s.signOffLabel}>С Уважение:</Text>
          <View style={s.signOffLine} />
          <Text style={s.signOffName}>{COMPANY_INFO.offerSignatory}</Text>
        </View>

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
