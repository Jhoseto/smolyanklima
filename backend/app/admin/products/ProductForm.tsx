"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Input, Select, Textarea, Button } from "../ui";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Sparkles, Wand2, X, ExternalLink, Loader2, Info } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { normalizeProductStockLocation, type ProductStockLocation } from "@/lib/admin/productStockLocation";
import { normalizeProductRegion, type ProductRegion } from "@/lib/admin/productRegion";
import { LabelScanButton, type LabelExtractResult } from "./LabelScanButton";
import {
  ProductPhotoUploader,
  MAX_PRODUCT_IMAGES as MAX_PHOTO_LIMIT,
  AI_ENHANCE_PRICE_DISPLAY,
} from "./ProductPhotoUploader";
import { ImageLightbox } from "./ImageLightbox";
import { BrandCombobox } from "./BrandCombobox";
import { enhancePhotoViaAI, fetchImageAsBlob } from "@/lib/photos/enhancePhoto";

type SerialMatch = {
  id: string;
  name: string;
  slug: string | null;
  field: "indoor" | "outdoor" | "both";
};

export type SpecsForm = {
  coverage_m2: string;
  noise_db: string;
  cooling_power_kw: string;
  heating_power_kw: string;
  refrigerant: string;
  wifi: boolean;
  energy_class_cool: string;
  energy_class_heat: string;
  seer: string;
  scop: string;
  warranty_months: string;
  weight_indoor_kg: string;
  weight_outdoor_kg: string;
  dim_indoor_length_mm: string;
  dim_indoor_width_mm: string;
  dim_indoor_height_mm: string;
  dim_outdoor_length_mm: string;
  dim_outdoor_width_mm: string;
  dim_outdoor_height_mm: string;
};

export type ImageRow = { url: string; sort_order: number; is_main: boolean };

export type AdminProductForm = {
  slug: string;
  /** Публичното име в каталога (марка + модел + kW). */
  name: string;
  /** Кратък/технически модел (напр. „FTXA50AW“). */
  modelCode: string;
  brandId: string;
  typeId: string;
  productCondition: "new" | "used";
  description: string;
  /** Само админ — не се показва в публичния каталог. */
  internalNote: string;
  price: number;
  priceWithMount: string;
  indoorUnitSerial: string;
  outdoorUnitSerial: string;
  supplierId: string;
  purchasedAt: string;
  supplierInvoiceNumber: string;
  purchasePrice: string;
  isFeatured: boolean;
  showInPublicCatalog: boolean;
  stockStatus: "in_stock" | "out_of_stock" | "on_order";
  /** Витрина (магазин) или склад — вътрешно, не е публичният stock_status. */
  stockLocation: ProductStockLocation;
  /** EUROPE / JAPAN в БД: europe / japan */
  productRegion: ProductRegion;
  stockQuantity: number;
  specs: SpecsForm;
  images: ImageRow[];
};

export function emptySpecsForm(): SpecsForm {
  return {
    coverage_m2: "",
    noise_db: "",
    cooling_power_kw: "",
    heating_power_kw: "",
    refrigerant: "",
    wifi: false,
    energy_class_cool: "",
    energy_class_heat: "",
    seer: "",
    scop: "",
    warranty_months: "",
    weight_indoor_kg: "",
    weight_outdoor_kg: "",
    dim_indoor_length_mm: "",
    dim_indoor_width_mm: "",
    dim_indoor_height_mm: "",
    dim_outdoor_length_mm: "",
    dim_outdoor_width_mm: "",
    dim_outdoor_height_mm: "",
  };
}

export function emptyProductForm(): AdminProductForm {
  return {
    slug: "",
    name: "",
    modelCode: "",
    brandId: "",
    typeId: "",
    productCondition: "new",
    description: "",
    internalNote: "",
    price: 0,
    priceWithMount: "",
    indoorUnitSerial: "",
    outdoorUnitSerial: "",
    supplierId: "",
    purchasedAt: "",
    supplierInvoiceNumber: "",
    purchasePrice: "",
    isFeatured: false,
    showInPublicCatalog: false,
    stockStatus: "in_stock",
    stockLocation: "warehouse",
    productRegion: "europe",
    stockQuantity: 0,
    specs: emptySpecsForm(),
    images: [],
  };
}

const MAX_PRODUCT_IMAGES = 4;

const ENERGY_CLASS_OPTIONS = ["A+++", "A++", "A+", "A", "B", "C", "D"] as const;
const REFRIGERANT_OPTIONS = ["R-32", "R-410A", "R-290", "R-134a"] as const;
const WARRANTY_MONTHS_OPTIONS = ["12", "24", "36", "48", "60", "72", "84", "120"] as const;
const COVERAGE_M2_OPTIONS = ["15", "20", "25", "30", "35", "40", "45", "50", "60", "70", "80", "90", "100"] as const;
const NOISE_DB_OPTIONS = ["18", "19", "20", "21", "22", "24", "26", "28", "30", "32", "35", "38", "40", "42", "45", "48", "50"] as const;
const COOLING_KW_OPTIONS = ["2.0", "2.5", "3.2", "3.5", "4.2", "5.0", "5.3", "6.0", "7.1", "8.0", "9.5", "10.0", "12.0"] as const;
const HEATING_KW_OPTIONS = ["2.2", "2.8", "3.4", "4.0", "4.5", "5.6", "6.3", "7.5", "8.5", "9.5", "10.8", "12.0", "14.0"] as const;

function slugifyBg(input: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "", ю: "yu", я: "ya",
  };
  const s = input
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Mapping от model-code prefix → canonical brand name. Използва се като
 * последен fallback, ако AI върна null/непознат brand_hint, но виждаме
 * валиден model code на етикета.
 *
 * Източник: официални naming conventions на производителите. Prefixes
 * са case-INSENSITIVE.
 *
 * Поддръжка: при добавяне на нова марка тук трябва ДА СЕ ДОБАВИ и в
 * AI промпта (route.ts → product_label_extract) — за да информираме
 * Gemini за конвенцията.
 */
const MODEL_CODE_PREFIX_TO_BRAND: Array<{ prefixes: string[]; brand: string }> = [
  { prefixes: ["FTXA", "FTXM", "FTKM", "ATXA", "ATXM", "RXA", "RXM", "ARXM", "2MXM", "3MXM", "4MXM", "5MXM"], brand: "Daikin" },
  { prefixes: ["MSZ-", "MUZ-", "MFZ-", "MUFZ-", "PKA-", "PUMY-", "SLZ-", "MSY-"], brand: "Mitsubishi Electric" },
  { prefixes: ["SRK-", "SRC-", "SCM-", "FDC-", "FDT-", "SRR-"], brand: "Mitsubishi Heavy" },
  { prefixes: ["ASYG", "AOYG", "ASYA", "AOYA"], brand: "Fujitsu" },
  { prefixes: ["RAS-", "RAV-", "MMK-", "MMY-"], brand: "Toshiba" },
  { prefixes: ["CS-", "CU-", "KIT-"], brand: "Panasonic" },
  { prefixes: ["GWH"], brand: "Gree" },
  { prefixes: ["MSAG", "MSAFA", "MSAB"], brand: "Midea" },
  { prefixes: ["AS-", "AUS-"], brand: "Hisense" },
];

/**
 * Намира brand entry, който съответства на AI hint или model code.
 *
 * Стратегия (multi-pass):
 *   1. AI ни е върнал точното име от availableBrands → direct exact match.
 *   2. Normalize match — lowercase, без punctuation/spaces.
 *   3. Token-based match — за multi-word марки (напр. „Mitsubishi“ в hint
 *      vs „Mitsubishi Electric“ в DB, или обратно). При няколко candidate-а
 *      ползваме model-code prefix за дезамбигуация.
 *   4. Substring match — hint contains brand name или vice versa.
 *   5. Fallback по model-code prefix — ако всичко друго е failed.
 *
 * @returns brand entry от списъка или null ако нищо не match-ва.
 */
function matchBrandFromHint(
  hint: string | null | undefined,
  modelCode: string | null | undefined,
  brands: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  const normalize = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const tokenize = (s: string): string[] =>
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3); // игнорираме къси думи („co“, „ltd“, …)

  const hintRaw = (hint ?? "").trim();
  const hintNorm = normalize(hintRaw);
  const hintTokens = hintRaw ? tokenize(hintRaw) : [];

  // 1. Exact match — AI ни е върнал точното име.
  if (hintRaw) {
    const exact = brands.find((b) => b.name.trim().toLowerCase() === hintRaw.toLowerCase());
    if (exact) return exact;
  }

  // 2. Normalize match (без spaces/punctuation).
  if (hintNorm) {
    const norm = brands.find((b) => normalize(b.name) === hintNorm);
    if (norm) return norm;
  }

  // 3. Token-based match — за multi-word марки.
  if (hintTokens.length > 0) {
    const candidates = brands.filter((b) => {
      const brandTokens = tokenize(b.name);
      // Всеки token от hint трябва да присъства в brand-а ИЛИ обратно.
      const hintMatchesBrand = hintTokens.every((ht) => brandTokens.some((bt) => bt === ht));
      const brandMatchesHint = brandTokens.every((bt) => hintTokens.some((ht) => ht === bt));
      return hintMatchesBrand || brandMatchesHint;
    });
    if (candidates.length === 1) return candidates[0];
    // Няколко candidate-а (напр. „Mitsubishi“ → Electric vs Heavy):
    // дезамбигуирай чрез model-code prefix.
    if (candidates.length > 1 && modelCode) {
      const byPrefix = matchBrandByModelPrefix(modelCode, brands);
      if (byPrefix && candidates.some((c) => c.id === byPrefix.id)) return byPrefix;
    }
    // Все още няколко — върни първия (deterministic, по DB order).
    if (candidates.length > 0) return candidates[0];
  }

  // 4. Substring match — hint contains brand name (или vice versa).
  if (hintNorm) {
    const contains = brands.find((b) => {
      const bn = normalize(b.name);
      return bn.length >= 3 && (hintNorm.includes(bn) || bn.includes(hintNorm));
    });
    if (contains) return contains;
  }

  // 5. Fallback — само по model-code prefix.
  if (modelCode) {
    const byPrefix = matchBrandByModelPrefix(modelCode, brands);
    if (byPrefix) return byPrefix;
  }

  return null;
}

/** Подсхема на матча — само по model code prefix. */
function matchBrandByModelPrefix(
  modelCode: string,
  brands: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  const code = modelCode.trim().toUpperCase();
  if (!code) return null;
  for (const entry of MODEL_CODE_PREFIX_TO_BRAND) {
    for (const prefix of entry.prefixes) {
      if (code.startsWith(prefix.toUpperCase())) {
        const brand = brands.find(
          (b) => b.name.trim().toLowerCase() === entry.brand.toLowerCase(),
        );
        if (brand) return brand;
      }
    }
  }
  return null;
}

function FieldTitle({ label, info, ai }: { label: string; info: string; ai?: boolean }) {
  return (
    <div className="mb-0.5 md:mb-1 leading-tight" title={info}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="text-[10px] md:text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1 min-w-0 flex-1">
          <span className="truncate">{label}</span>
          {ai && <AiBadge />}
        </div>
        <span
          className="md:hidden shrink-0 text-slate-400 p-0.5 -mr-0.5 -mt-0.5 rounded-md"
          title={info}
          aria-label={info}
          role="img"
        >
          <Info className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="hidden md:block text-[10px] text-slate-400 truncate">{info}</div>
    </div>
  );
}

/** Малък зелен бадж до полета, попълнени автоматично от AI скан на етикет. */
function AiBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-1 py-px uppercase tracking-wide"
      title="Това поле е попълнено автоматично от AI след сканиране на етикета. Прегледай и коригирай при нужда."
    >
      <Sparkles className="w-2.5 h-2.5" /> AI
    </span>
  );
}

function strNum(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function strInt(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function specsPayload(specs: SpecsForm) {
  return {
    coverage_m2: strNum(specs.coverage_m2),
    noise_db: strNum(specs.noise_db),
    cooling_power_kw: strNum(specs.cooling_power_kw),
    heating_power_kw: strNum(specs.heating_power_kw),
    refrigerant: specs.refrigerant.trim() || null,
    wifi: specs.wifi,
    energy_class_cool: specs.energy_class_cool.trim() || null,
    energy_class_heat: specs.energy_class_heat.trim() || null,
    seer: strNum(specs.seer),
    scop: strNum(specs.scop),
    warranty_months: strInt(specs.warranty_months),
    weight_indoor_kg: strNum(specs.weight_indoor_kg),
    weight_outdoor_kg: strNum(specs.weight_outdoor_kg),
    dim_indoor_length_mm: strInt(specs.dim_indoor_length_mm),
    dim_indoor_width_mm: strInt(specs.dim_indoor_width_mm),
    dim_indoor_height_mm: strInt(specs.dim_indoor_height_mm),
    dim_outdoor_length_mm: strInt(specs.dim_outdoor_length_mm),
    dim_outdoor_width_mm: strInt(specs.dim_outdoor_width_mm),
    dim_outdoor_height_mm: strInt(specs.dim_outdoor_height_mm),
  };
}

export function buildPostBody(form: AdminProductForm) {
  const pwm = strNum(form.priceWithMount);
  const pp = strNum(form.purchasePrice);
  const slug = form.slug.trim();
  return {
    ...(slug.length >= 2 ? { slug } : {}),
    name: form.name.trim(),
    modelCode: form.modelCode.trim() || null,
    brandId: form.brandId,
    typeId: form.typeId,
    productCondition: form.productCondition,
    description: form.description.trim() || undefined,
    internalNote: form.internalNote.trim() || undefined,
    price: Number(form.price),
    priceWithMount: pwm ?? undefined,
    indoorUnitSerial: form.indoorUnitSerial.trim() || null,
    outdoorUnitSerial: form.outdoorUnitSerial.trim() || null,
    supplierId: form.supplierId.trim() || null,
    purchasedAt: form.purchasedAt.trim() || null,
    supplierInvoiceNumber: form.supplierInvoiceNumber.trim() || null,
    purchasePrice: pp ?? null,
    isFeatured: form.isFeatured,
    showInPublicCatalog: form.showInPublicCatalog,
    stockStatus: form.stockStatus,
    stockLocation: form.stockLocation,
    productRegion: form.productRegion,
    stockQuantity: form.stockQuantity,
    specs: specsPayload(form.specs),
    images: form.images
      .filter((i) => i.url.trim())
      .slice(0, MAX_PRODUCT_IMAGES)
      .map((i, idx) => ({
        url: i.url.trim(),
        sort_order: i.sort_order ?? idx,
        is_main: i.is_main,
      })),
  };
}

export function buildPutBody(form: AdminProductForm) {
  const pwm = strNum(form.priceWithMount);
  const pp = strNum(form.purchasePrice);
  const slug = form.slug.trim();
  return {
    slug: slug.length >= 2 ? slug : null,
    name: form.name.trim(),
    modelCode: form.modelCode.trim() || null,
    brandId: form.brandId,
    typeId: form.typeId,
    productCondition: form.productCondition,
    description: form.description.trim() || null,
    internalNote: form.internalNote.trim() || null,
    price: Number(form.price),
    priceWithMount: pwm,
    indoorUnitSerial: form.indoorUnitSerial.trim() || null,
    outdoorUnitSerial: form.outdoorUnitSerial.trim() || null,
    supplierId: form.supplierId.trim() || null,
    purchasedAt: form.purchasedAt.trim() || null,
    supplierInvoiceNumber: form.supplierInvoiceNumber.trim() || null,
    purchasePrice: pp,
    isFeatured: form.isFeatured,
    showInPublicCatalog: form.showInPublicCatalog,
    stockStatus: form.stockStatus,
    stockLocation: form.stockLocation,
    productRegion: form.productRegion,
    stockQuantity: form.stockQuantity,
    specs: specsPayload(form.specs),
    images: form.images
      .filter((i) => i.url.trim())
      .slice(0, MAX_PRODUCT_IMAGES)
      .map((i, idx) => ({
        url: i.url.trim(),
        sort_order: i.sort_order ?? idx,
        is_main: i.is_main,
      })),
  };
}

export function mapLoadedProductToForm(p: {
  slug?: string | null;
  name: string;
  model_code?: string | null;
  brand_id: string;
  type_id: string;
  product_condition?: "new" | "used";
  description?: string | null;
  internal_note?: string | null;
  price: number;
  price_with_mount?: number | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  supplier_id?: string | null;
  purchased_at?: string | null;
  supplier_invoice_number?: string | null;
  purchase_price?: number | null;
  is_featured: boolean;
  show_in_public_catalog?: boolean | null;
  stock_status?: string;
  stock_location?: string | null;
  product_region?: string | null;
  stock_quantity?: number;
  product_specs?: Record<string, unknown> | null;
  product_images?: Array<{ url: string; sort_order: number; is_main: boolean }>;
}): AdminProductForm {
  const sp = p.product_specs;
  const n = (v: unknown) => (v != null && v !== "" ? String(v) : "");
  const d = (v: unknown) => {
    if (v == null || v === "") return "";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  };
  return {
    slug: p.slug ?? "",
    name: p.name,
    modelCode: p.model_code ?? "",
    brandId: p.brand_id,
    typeId: p.type_id,
    productCondition: p.product_condition === "used" ? "used" : "new",
    description: p.description ?? "",
    internalNote: p.internal_note ?? "",
    price: Number(p.price),
    priceWithMount: p.price_with_mount != null ? String(p.price_with_mount) : "",
    indoorUnitSerial: p.indoor_unit_serial ?? "",
    outdoorUnitSerial: p.outdoor_unit_serial ?? "",
    supplierId: p.supplier_id ?? "",
    purchasedAt: d(p.purchased_at),
    supplierInvoiceNumber: p.supplier_invoice_number ?? "",
    purchasePrice: p.purchase_price != null ? String(p.purchase_price) : "",
    isFeatured: Boolean(p.is_featured),
    showInPublicCatalog: Boolean(p.show_in_public_catalog),
    stockStatus:
      p.stock_status === "out_of_stock" || p.stock_status === "on_order" ? p.stock_status : "in_stock",
    stockLocation: normalizeProductStockLocation(p.stock_location),
    productRegion: normalizeProductRegion(p.product_region),
    stockQuantity: Number(p.stock_quantity ?? 0),
    specs: {
      coverage_m2: n(sp?.coverage_m2),
      noise_db: n(sp?.noise_db),
      cooling_power_kw: n(sp?.cooling_power_kw),
      heating_power_kw: n(sp?.heating_power_kw),
      refrigerant: (sp?.refrigerant as string) ?? "",
      wifi: Boolean(sp?.wifi),
      energy_class_cool: (sp?.energy_class_cool as string) ?? "",
      energy_class_heat: (sp?.energy_class_heat as string) ?? "",
      seer: n(sp?.seer),
      scop: n(sp?.scop),
      warranty_months: sp?.warranty_months != null ? String(sp.warranty_months) : "",
      weight_indoor_kg: n(sp?.weight_indoor_kg),
      weight_outdoor_kg: n(sp?.weight_outdoor_kg),
      dim_indoor_length_mm: sp?.dim_indoor_length_mm != null ? String(sp.dim_indoor_length_mm) : "",
      dim_indoor_width_mm: sp?.dim_indoor_width_mm != null ? String(sp.dim_indoor_width_mm) : "",
      dim_indoor_height_mm: sp?.dim_indoor_height_mm != null ? String(sp.dim_indoor_height_mm) : "",
      dim_outdoor_length_mm: sp?.dim_outdoor_length_mm != null ? String(sp.dim_outdoor_length_mm) : "",
      dim_outdoor_width_mm: sp?.dim_outdoor_width_mm != null ? String(sp.dim_outdoor_width_mm) : "",
      dim_outdoor_height_mm: sp?.dim_outdoor_height_mm != null ? String(sp.dim_outdoor_height_mm) : "",
    },
    images: [...(p.product_images ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .slice(0, MAX_PRODUCT_IMAGES)
      .map((im) => ({
        url: im.url,
        sort_order: im.sort_order ?? 0,
        is_main: Boolean(im.is_main),
      })),
  };
}

function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-200 pt-2 md:pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 mb-1 md:mb-2 group min-h-[2rem] md:min-h-0 py-0.5"
      >
        <div className="flex items-center gap-2 min-w-0 text-left">
          <h2 className="text-[13px] md:text-base font-bold text-slate-900 leading-tight">{title}</h2>
          {badge && <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">{badge}</span>}
        </div>
        <ChevronDown
          className={`w-4 h-4 md:w-5 md:h-5 text-slate-400 shrink-0 transition-transform duration-200 group-hover:text-slate-600 ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>
      {open && children}
    </div>
  );
}

function SerialDuplicateNotice({ matches, label }: { matches: SerialMatch[]; label: "вътрешно" | "външно" }) {
  if (matches.length === 0) return null;
  return (
    <div className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[12px] leading-snug text-amber-900">
      <div className="flex items-start gap-1.5 font-bold">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>Същият сериен номер вече е въведен при друг продукт.</span>
      </div>
      <ul className="mt-1 space-y-0.5 pl-5 list-disc">
        {matches.map((m) => (
          <li key={m.id}>
            <Link
              href={`/admin/products/${m.id}`}
              target="_blank"
              rel="noopener"
              className="text-amber-900 underline hover:text-amber-950"
              title="Отвори другия продукт в нов раздел"
            >
              {m.name}
            </Link>
            <span className="text-amber-700"> · </span>
            <span className="text-[11px] uppercase tracking-wide text-amber-700">
              {m.field === "both" ? "вътр. + външ." : m.field === "indoor" ? "вътрешно" : "външно"} тяло
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 text-[11px] text-amber-700">
        Проверете дали серийният номер на {label} тяло е правилно копиран от табелката, или коригирайте дубликата.
      </div>
    </div>
  );
}

type Props = {
  brands: { id: string; name: string }[];
  types: { id: string; name: string }[];
  /** Доставчици от Контакти (contact_kind = supplier) */
  suppliers?: { id: string; full_name: string }[];
  form: AdminProductForm;
  setForm: Dispatch<SetStateAction<AdminProductForm>>;
  cloudinaryKind?: "product" | "accessory";
  /** office_staff cannot edit prices */
  canEditPrice?: boolean;
  /** Само master_admin и office_staff могат да сменят магазин/склад. */
  canEditStockLocation?: boolean;
  /** master_admin и office_staff — поле „Страна“. */
  canEditProductRegion?: boolean;
  /** ID на текущия продукт при редакция — изключва се при duplicate-check. */
  currentProductId?: string;
  /** Само при нов продукт: „цена с монтаж“ = продажна цена + стандарт от настройките на каталога, докато не редактираш полето ръчно. */
  autoPriceWithMountFromCatalog?: boolean;
  /** Callback при промяна на броя „pending“ снимки (preview, но не качени).
   *  Родителят го ползва за save-protection (показва confirm, ако > 0). */
  onPendingPhotosChange?: (count: number) => void;
  /** Само преглед: всички полета извън секцията „Снимки“ са неактивни (сервиз). */
  readOnly?: boolean;
  /** highlight delivery fields */
  highlightDelivery?: boolean;
};

export function ProductFormFields({
  brands: brandsProp,
  types,
  suppliers = [],
  form,
  setForm,
  cloudinaryKind = "product",
  canEditPrice = true,
  canEditStockLocation = false,
  canEditProductRegion = false,
  currentProductId,
  autoPriceWithMountFromCatalog = false,
  onPendingPhotosChange,
  readOnly = false,
  highlightDelivery = false,
}: Props) {
  const ro = Boolean(readOnly);
  /** Локален overlay за марки, създадени по време на тази сесия чрез
   *  „+ Създай нова марка“ в BrandCombobox. Parent prop-ът може да не се
   *  rerender-не веднага (data idва от родителския state), затова пазим
   *  допълнителния списък локално и merge-ваме двата източника.
   *
   *  Reset-ва се при rerender само ако всички новосъздадени марки вече
   *  присъстват в `brandsProp` (parent се е sync-нал). */
  const [localBrands, setLocalBrands] = useState<Array<{ id: string; name: string }>>([]);

  /** Финален списък = parent prop ∪ локални нови (без дубликати по id). */
  const brands = useMemo(() => {
    const seen = new Set(brandsProp.map((b) => b.id));
    const extra = localBrands.filter((b) => !seen.has(b.id));
    if (extra.length === 0) return brandsProp;
    return [...brandsProp, ...extra].sort((a, b) => a.name.localeCompare(b.name, "bg"));
  }, [brandsProp, localBrands]);

  // Когато parent-ът дойде с актуалните brands (включително нашите нови),
  // изчистваме локалния overlay, за да избегнем duplicate-state.
  useEffect(() => {
    if (localBrands.length === 0) return;
    const propIds = new Set(brandsProp.map((b) => b.id));
    if (localBrands.every((lb) => propIds.has(lb.id))) {
      setLocalBrands([]);
    }
  }, [brandsProp, localBrands]);

  const [aiBusy, setAiBusy] = useState(false);
  const [aiDialog, setAiDialog] = useState<"missing_name" | "replace_description" | "error" | null>(null);
  const [aiError, setAiError] = useState("");
  const [dimsBusy, setDimsBusy] = useState(false);
  const [dimsNotice, setDimsNotice] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  const [indoorDup, setIndoorDup] = useState<SerialMatch[]>([]);
  const [outdoorDup, setOutdoorDup] = useState<SerialMatch[]>([]);
  const debouncedIndoor = useDebounce(form.indoorUnitSerial.trim(), 350);
  const debouncedOutdoor = useDebounce(form.outdoorUnitSerial.trim(), 350);
  const debouncedModelCode = useDebounce(form.modelCode.trim(), 350);

  /** Името в каталога е „dirty“ ако потребителят го е въвел/редактирал ръчно.
   *  Докато е „clean“, auto-генерираме „Марка Модел [kW]“ при смяна на тези
   *  полета — за да не натоварваме оператора с допълнително писане.
   *  При редакция на съществуващ продукт стартираме като dirty (за да не
   *  пренаписваме готовото публично име при смяна на марка/модел). */
  const [nameDirty, setNameDirty] = useState(() => Boolean(currentProductId));

  /** Полета, попълнени автоматично от AI скан на етикет. Показваме малък
   *  „✨ AI“ бадж до тях, за да може складовият техник веднага да види
   *  кои стойности са машинно попълнени и да ги провери преди save. */
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [aiToast, setAiToast] = useState<{
    kind: "ok" | "warn";
    text: string;
    /** Допълнителни човекочетими подробности за конкретно попълнените полета. */
    details?: string[] | null;
  } | null>(null);

  /** Брой снимки, които потребителят е добавил в preview, но ОЩЕ не са
   *  качени в Cloudinary. Save-action-ът проверява тази стойност и
   *  предупреждава, ако се опитва да запази продукта с pending снимки. */
  const [pendingPhotosCount, setPendingPhotosCount] = useState(0);

  useEffect(() => {
    onPendingPhotosChange?.(pendingPhotosCount);
  }, [pendingPhotosCount, onPendingPhotosChange]);

  /** Стандартни суми за монтаж от панел Продукти → ⚙ (само при нов продукт). */
  const [catalogMountDefaults, setCatalogMountDefaults] = useState<{ new: number; used: number } | null>(null);
  /** След ръчна редакция на „цена с монтаж“ вече не я пипаме от настройките. */
  const [catalogPwmUserEdited, setCatalogPwmUserEdited] = useState(false);

  useEffect(() => {
    if (!autoPriceWithMountFromCatalog || !canEditPrice) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/products/catalog-settings", { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { defaultMountNewEur?: number | null; defaultMountUsedEur?: number | null };
        };
        if (cancelled || !res.ok) return;
        const n = json.data?.defaultMountNewEur;
        const u = json.data?.defaultMountUsedEur;
        if (n != null && u != null && Number.isFinite(n) && Number.isFinite(u)) {
          setCatalogMountDefaults({ new: n, used: u });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPriceWithMountFromCatalog, canEditPrice]);

  useEffect(() => {
    if (!autoPriceWithMountFromCatalog || !canEditPrice || catalogPwmUserEdited) return;
    if (!catalogMountDefaults) return;
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) return;
    const addon = form.productCondition === "used" ? catalogMountDefaults.used : catalogMountDefaults.new;
    const nextPwm = Math.round((priceNum + addon) * 100) / 100;
    setForm((prev) => {
      const cur = strNum(prev.priceWithMount);
      if (cur != null && Math.abs(cur - nextPwm) < 1e-9) return prev;
      return { ...prev, priceWithMount: String(nextPwm) };
    });
  }, [
    autoPriceWithMountFromCatalog,
    canEditPrice,
    catalogMountDefaults,
    catalogPwmUserEdited,
    form.price,
    form.productCondition,
    setForm,
  ]);

  const priceWithMountFieldInfo = useMemo(() => {
    if (autoPriceWithMountFromCatalog && canEditPrice) {
      return "Продажна цена с включен стандартен монтаж. Докато не я редактираш ръчно, се изчислява като продажна цена + стандартния монтаж от настройките на каталога (икона зъбно колело до „Нов продукт“).";
    }
    return "Продажна цена с включен стандартен монтаж.";
  }, [autoPriceWithMountFromCatalog, canEditPrice]);

  const showCatalogMountAutoHint = useMemo(
    () =>
      autoPriceWithMountFromCatalog &&
      canEditPrice &&
      catalogMountDefaults != null &&
      !catalogPwmUserEdited &&
      Number(form.price) > 0,
    [autoPriceWithMountFromCatalog, canEditPrice, catalogMountDefaults, catalogPwmUserEdited, form.price],
  );

  /** Pre-fetched снимки от друг продукт със същия (марка, модел) —
   *  показват се като „линкни тези“ предложение, за да се избегне
   *  повторно качване на каталожни снимки. */
  const [reusablePhotos, setReusablePhotos] = useState<{
    sourceId: string;
    sourceName: string | null;
    images: Array<{ url: string; sort_order: number; is_main: boolean }>;
  } | null>(null);

  /** Lightbox state — index на отворената снимка от form.images (или null). */
  const [imageLightboxIndex, setImageLightboxIndex] = useState<number | null>(null);

  /** AI enhance статус за ВЕЧЕ КАЧЕНИ снимки (key = original Cloudinary URL).
   *  Позволява да виждаме „processing“ overlay на конкретна снимка докато AI
   *  работи. След успех заместваме URL-а в form.images и записа се махва. */
  const [uploadedAiStatus, setUploadedAiStatus] = useState<
    Record<string, { phase: "processing"; startedAt: number } | { phase: "error"; message: string }>
  >({});

  /** Live preview на количеството за този модел в каталога.
   *  - `otherInStock` = брой ДРУГИ продукти със същата (марка, модел) в наличност.
   *  - `othersTotal`  = брой ВСИЧКИ други продукти със същия модел (вкл. изчерпани).
   *  - `nextInStock`  = очакваното количество в каталога СЛЕД save (включва текущия). */
  const [modelStockPreview, setModelStockPreview] = useState<{
    otherInStock: number;
    othersTotal: number;
    nextInStock: number;
  } | null>(null);
  const [modelStockLoading, setModelStockLoading] = useState(false);

  /**
   * AI enhance на ВЕЧЕ КАЧЕНА снимка (от Cloudinary).
   *
   * Flow:
   *   1. Сваляме оригинала от Cloudinary URL → Blob.
   *   2. Praщаме към Gemini Nano Banana → нов Blob (PNG).
   *   3. Качваме новия Blob обратно в Cloudinary (в същата папка).
   *   4. Заместваме URL-а в form.images.
   *
   * Старият Cloudinary файл остава orphaned — отделен cleanup би трябвало да
   * го изчисти (out of scope тук).
   */
  async function enhanceUploadedImage(originalUrl: string) {
    if (uploadedAiStatus[originalUrl]?.phase === "processing") return;

    setUploadedAiStatus((prev) => ({
      ...prev,
      [originalUrl]: { phase: "processing", startedAt: Date.now() },
    }));

    try {
      // 1. Сваляме оригинала
      const origBlob = await fetchImageAsBlob(originalUrl);

      // 2. AI enhance — real-time, ~$0.039
      const result = await enhancePhotoViaAI(origBlob);

      // 3. Upload в Cloudinary в подходящата папка
      const brand = brands.find((br) => br.id === form.brandId);
      const brandSlug = brand ? slugifyBg(brand.name) : null;
      const productSlug = form.slug || slugifyBg(form.name || "");
      const folderKey =
        brandSlug && form.modelCode ? `${brandSlug}-${form.modelCode.trim().toLowerCase()}` : productSlug;
      const file = new File([result.blob], "enhanced-ai.png", { type: result.mimeType });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", cloudinaryKind);
      fd.append("slug", folderKey);
      const res = await fetch("/api/admin/uploads/image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { url?: string };
        error?: string;
      };
      if (!res.ok || !json.data?.url) {
        throw new Error(json.error || `Качването в Cloudinary не успя (HTTP ${res.status}).`);
      }
      const newUrl = json.data.url;

      // 4. Заместваме URL-а в form.images (запазваме is_main / sort_order)
      setForm((f) => ({
        ...f,
        images: f.images.map((im) => (im.url === originalUrl ? { ...im, url: newUrl } : im)),
      }));
      setUploadedAiStatus((prev) => {
        const next = { ...prev };
        delete next[originalUrl];
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUploadedAiStatus((prev) => ({
        ...prev,
        [originalUrl]: { phase: "error", message: msg },
      }));
      // auto-clear след 7s
      setTimeout(() => {
        setUploadedAiStatus((prev) => {
          if (prev[originalUrl]?.phase !== "error") return prev;
          const next = { ...prev };
          delete next[originalUrl];
          return next;
        });
      }, 7000);
    }
  }

  function isAiField(key: string) {
    return aiFilledFields.has(key);
  }
  /** Утилитарен helper за зелен highlight на AI-попълнени input полета. */
  function aiHl(key: string): string {
    return aiFilledFields.has(key) ? "border-emerald-300 bg-emerald-50/40" : "";
  }
  /** Маха „AI“ маркировката на дадено поле — при ръчно редактиране от потребителя. */
  function clearAiFlag(key: string) {
    setAiFilledFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function buildCatalogName(brandName: string, modelCode: string, coolingKw: string): string {
    const parts: string[] = [];
    if (brandName.trim()) parts.push(brandName.trim());
    if (modelCode.trim()) parts.push(modelCode.trim());
    const kw = strNum(coolingKw);
    if (kw && kw > 0) parts.push(`${kw}kW`);
    return parts.join(" ").trim();
  }

  function syncAutoName(next: AdminProductForm): AdminProductForm {
    if (nameDirty) return next;
    const brandName = brands.find((b) => b.id === next.brandId)?.name ?? "";
    const auto = buildCatalogName(brandName, next.modelCode, next.specs.cooling_power_kw);
    if (!auto) return next;
    const slugChange = next.slug.trim().length < 2
      ? { slug: slugifyBg(auto) || next.slug }
      : {};
    return { ...next, name: auto, ...slugChange };
  }

  /**
   * Слива резултата от AI скан на етикет с текущата форма.
   *
   * SMART MERGE правила:
   *  • Серийният номер на снимания blok ВИНАГИ се попълва (overwrite-ва се
   *    дори ако вече има стойност — техникът целенасочено снима, за да
   *    провери/коригира).
   *  • Останалите полета се попълват САМО ако са празни (никога не
   *    overwrites-ват ръчно въведени стойности).
   *  • Името в каталога се auto-генерира от новата марка/модел/kW.
   *  • Всички AI-попълнени полета се маркират със зелен „✨ AI“ бадж.
   */
  function mergeLabelExtract(extract: LabelExtractResult, whichUnit: "indoor" | "outdoor") {
    const filled = new Set<string>(aiFilledFields);
    let confidence = extract.confidence_label;
    let specsConfidence = extract.confidence_specs;

    setForm((prev) => {
      const next: AdminProductForm = {
        ...prev,
        specs: { ...prev.specs },
        images: prev.images,
      };

      // 1) Серийни номера — винаги попълваме този на снимания blok.
      const lbl = extract.from_label ?? {};
      if (whichUnit === "indoor" && lbl.indoor_unit_serial) {
        next.indoorUnitSerial = String(lbl.indoor_unit_serial).trim();
        filled.add("indoorUnitSerial");
      }
      if (whichUnit === "outdoor" && lbl.outdoor_unit_serial) {
        next.outdoorUnitSerial = String(lbl.outdoor_unit_serial).trim();
        filled.add("outdoorUnitSerial");
      }

      // 3) Модел — само ако празен. (Извличаме го преди марката, защото го
      //    използваме за fallback match по prefix.)
      if (!next.modelCode.trim() && lbl.model_code) {
        next.modelCode = String(lbl.model_code).trim();
        filled.add("modelCode");
      }

      // 2) Марка — само ако празна. Multi-pass match:
      //    (a) AI връща exact име от availableBrands → direct match по name.
      //    (b) Token-level match (Mitsubishi → Mitsubishi Electric).
      //    (c) Fallback по model-code prefix (FTXA → Daikin, SRK → Mitsubishi Heavy).
      if (!next.brandId) {
        const matched = matchBrandFromHint(lbl.brand_hint, next.modelCode, brands);
        if (matched) {
          next.brandId = matched.id;
          filled.add("brandId");
        }
      }

      // 4) Хладилен агент — само ако празен.
      if (!next.specs.refrigerant.trim() && lbl.refrigerant) {
        next.specs.refrigerant = String(lbl.refrigerant).trim();
        filled.add("specs.refrigerant");
      }

      // 5) Дата на производство → purchasedAt НЕ се попълва от тук (това е
      //    дата на покупка от доставчик, не на производство). Само като
      //    info в логовете.

      // 6) Spec lookup полета — попълваме само ПРАЗНИ.
      const specs = extract.model_specs ?? {};
      const tryFillNum = (specKey: keyof SpecsForm, value: number | null | undefined, decimal: boolean) => {
        if (value == null || !Number.isFinite(value)) return;
        if (next.specs[specKey] && String(next.specs[specKey]).trim() !== "") return;
        const out = decimal
          ? String(Math.round(Number(value) * 10) / 10)
          : String(Math.round(Number(value)));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next.specs as any)[specKey] = out;
        filled.add(`specs.${specKey}`);
      };
      const tryFillStr = (specKey: keyof SpecsForm, value: string | null | undefined) => {
        if (!value || String(value).trim() === "") return;
        if (next.specs[specKey] && String(next.specs[specKey]).trim() !== "") return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next.specs as any)[specKey] = String(value).trim();
        filled.add(`specs.${specKey}`);
      };

      tryFillNum("coverage_m2", specs.coverage_m2, false);
      tryFillNum("noise_db", specs.noise_db, false);
      tryFillNum("cooling_power_kw", specs.cooling_power_kw, true);
      tryFillNum("heating_power_kw", specs.heating_power_kw, true);
      tryFillStr("energy_class_cool", specs.energy_class_cool);
      tryFillStr("energy_class_heat", specs.energy_class_heat);
      tryFillNum("seer", specs.seer, true);
      tryFillNum("scop", specs.scop, true);
      tryFillNum("warranty_months", specs.warranty_months, false);
      tryFillNum("weight_indoor_kg", specs.weight_indoor_kg, true);
      tryFillNum("weight_outdoor_kg", specs.weight_outdoor_kg, true);
      tryFillNum("dim_indoor_length_mm", specs.dim_indoor_length_mm, false);
      tryFillNum("dim_indoor_width_mm", specs.dim_indoor_width_mm, false);
      tryFillNum("dim_indoor_height_mm", specs.dim_indoor_height_mm, false);
      tryFillNum("dim_outdoor_length_mm", specs.dim_outdoor_length_mm, false);
      tryFillNum("dim_outdoor_width_mm", specs.dim_outdoor_width_mm, false);
      tryFillNum("dim_outdoor_height_mm", specs.dim_outdoor_height_mm, false);

      // WiFi — само ако specs.wifi не е true вече (false = default „празно“).
      if (specs.wifi === true && !next.specs.wifi) {
        next.specs.wifi = true;
        filled.add("specs.wifi");
      }

      // 7) Името в каталога — auto-обнови, ако още е „чисто“.
      return syncAutoName(next);
    });

    setAiFilledFields(filled);

    // Кои НОВИ полета бяха попълнени от ТОЗИ конкретен scan? (Изваждаме
    // предходно попълнените, за да покажем само резултата от сегашния call.)
    const newlyFilled = new Set<string>();
    for (const key of filled) {
      if (!aiFilledFields.has(key)) newlyFilled.add(key);
    }

    const lowConf =
      confidence === "low" ||
      confidence === "none" ||
      specsConfidence === "low" ||
      specsConfidence === "none";

    // Изграждаме компактен човекочетим списък на ключовите попълнени
    // полета — за бърза визуална потвърждение („какво стана преди миг“).
    const highlights: string[] = [];
    if (newlyFilled.has("brandId")) {
      // Brand id-то току-що беше set-нато през matchBrandFromHint. Ползваме
      // hint-а от етикета, ако е по-кратък/човекочетим; иначе fallback
      // към името от списъка чрез повторен match по hint.
      const hintRaw = extract.from_label?.brand_hint?.trim() ?? "";
      const matchedBrand = matchBrandFromHint(hintRaw, extract.from_label?.model_code ?? "", brands);
      if (matchedBrand) highlights.push(`марка: ${matchedBrand.name}`);
      else if (hintRaw) highlights.push(`марка: ${hintRaw}`);
    }
    if (newlyFilled.has("modelCode") && extract.from_label?.model_code) {
      highlights.push(`модел: ${extract.from_label.model_code}`);
    }
    if (newlyFilled.has("indoorUnitSerial") && extract.from_label?.indoor_unit_serial) {
      highlights.push(`сер.вътр.: ${extract.from_label.indoor_unit_serial}`);
    }
    if (newlyFilled.has("outdoorUnitSerial") && extract.from_label?.outdoor_unit_serial) {
      highlights.push(`сер.външ.: ${extract.from_label.outdoor_unit_serial}`);
    }
    if (newlyFilled.has("specs.refrigerant") && extract.from_label?.refrigerant) {
      highlights.push(`газ: ${extract.from_label.refrigerant}`);
    }

    setAiToast({
      kind: lowConf ? "warn" : "ok",
      text: lowConf
        ? `Попълнени са ${newlyFilled.size} нови полета, но точността е ниска. Прегледай ВНИМАТЕЛНО.`
        : newlyFilled.size === 0
          ? `Не успях да попълня нови полета. Опитай с по-ясна снимка на етикета.`
          : `Попълнени са ${newlyFilled.size} нови полета автоматично. Общо AI-попълнени: ${filled.size}.`,
      details: highlights.length > 0 ? highlights : null,
    });
    // Toast-ът ОСТАВА на екрана докато не го затвори потребителят (или
    // не направи нов scan, който го замества). Това дава време за
    // преглед на резултата без натиск.
  }

  useEffect(() => {
    if (!debouncedIndoor) {
      setIndoorDup([]);
      return;
    }
    const ctrl = new AbortController();
    const url = new URL("/api/admin/products/check-serial", window.location.origin);
    url.searchParams.set("serial", debouncedIndoor);
    if (currentProductId) url.searchParams.set("excludeId", currentProductId);
    fetch(url.toString(), { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ data: [] })))
      .then((j: { data?: SerialMatch[] }) => setIndoorDup(j.data ?? []))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [debouncedIndoor, currentProductId]);

  useEffect(() => {
    if (!debouncedOutdoor) {
      setOutdoorDup([]);
      return;
    }
    const ctrl = new AbortController();
    const url = new URL("/api/admin/products/check-serial", window.location.origin);
    url.searchParams.set("serial", debouncedOutdoor);
    if (currentProductId) url.searchParams.set("excludeId", currentProductId);
    fetch(url.toString(), { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ data: [] })))
      .then((j: { data?: SerialMatch[] }) => setOutdoorDup(j.data ?? []))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [debouncedOutdoor, currentProductId]);

  // Re-use на каталожни снимки: при попълнен (марка, модел) проверяваме
  // дали друг продукт с този модел вече има снимки в Cloudinary. Ако да,
  // показваме предложение „линкни тези снимки“ — спестява duplicate upload.
  useEffect(() => {
    if (!form.brandId || !debouncedModelCode || form.images.length > 0) {
      setReusablePhotos(null);
      return;
    }
    const ctrl = new AbortController();
    const url = new URL("/api/admin/products/photos-for-model", window.location.origin);
    url.searchParams.set("brandId", form.brandId);
    url.searchParams.set("modelCode", debouncedModelCode);
    if (currentProductId) url.searchParams.set("excludeId", currentProductId);
    fetch(url.toString(), { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ data: null })))
      .then(
        (
          j: {
            data?: {
              source_product_id: string | null;
              source_product_name: string | null;
              images: Array<{ url: string; sort_order: number; is_main: boolean }>;
            } | null;
          },
        ) => {
          if (!j?.data || !j.data.source_product_id || j.data.images.length === 0) {
            setReusablePhotos(null);
          } else {
            setReusablePhotos({
              sourceId: j.data.source_product_id,
              sourceName: j.data.source_product_name,
              images: j.data.images,
            });
          }
        },
      )
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [form.brandId, debouncedModelCode, form.images.length, currentProductId]);

  // Live preview на количеството за този модел в каталога.
  // При промяна на (марка, модел) питаме сървъра колко ДРУГИ продукта има със
  // същия модел и колко от тях са в наличност. Това позволява да покажем
  // на оператора какво ще се изчисли автоматично след save.
  useEffect(() => {
    if (!form.brandId || !debouncedModelCode) {
      setModelStockPreview(null);
      setModelStockLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setModelStockLoading(true);
    const url = new URL("/api/admin/products/model-stock-count", window.location.origin);
    url.searchParams.set("brandId", form.brandId);
    url.searchParams.set("modelCode", debouncedModelCode);
    if (currentProductId) url.searchParams.set("excludeId", currentProductId);
    fetch(url.toString(), { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ data: null })))
      .then((j: { data?: { total: number; inStock: number; otherStatuses: number } | null }) => {
        if (!j?.data) {
          setModelStockPreview(null);
        } else {
          // „nextInStock“ = ДРУГИ in_stock + (себе си, ако ще е in_stock).
          const selfInStock = form.stockStatus === "in_stock" ? 1 : 0;
          setModelStockPreview({
            otherInStock: j.data.inStock,
            othersTotal: j.data.total,
            nextInStock: j.data.inStock + selfInStock,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setModelStockLoading(false));
    return () => ctrl.abort();
  }, [form.brandId, debouncedModelCode, form.stockStatus, currentProductId]);

  const setSpec = (k: keyof SpecsForm, v: string | boolean) => {
    // Ако стойността беше попълнена от AI и сега потребителят я редактира —
    // махаме „AI“ маркировката, за да не подвежда.
    clearAiFlag(`specs.${k}`);
    setForm((f) => {
      const next: AdminProductForm = { ...f, specs: { ...f.specs, [k]: v } };
      // Когато потребителят промени охладителната мощност и името още е
      // auto-генериран draft, обновяваме и него.
      if (k === "cooling_power_kw" && !nameDirty) {
        return syncAutoName(next);
      }
      return next;
    });
  };

  function generateSlugFromName() {
    const next = slugifyBg(form.name || form.modelCode || "");
    if (next.length >= 2) setForm((f) => ({ ...f, slug: next }));
  }

  function requestAiDraft() {
    if (!form.name.trim()) {
      setAiDialog("missing_name");
      return;
    }
    if (form.description.trim()) {
      setAiDialog("replace_description");
      return;
    }
    void generateAiDraft();
  }

  async function generateAiDraft() {
    setAiDialog(null);
    setAiError("");
    setAiBusy(true);
    try {
      const brandName = brands.find((b) => b.id === form.brandId)?.name;
      const typeName = types.find((t) => t.id === form.typeId)?.name;
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "product_draft",
          input: {
            name: form.name,
            brandName,
            typeName,
            condition: form.productCondition,
            price: Number(form.price || 0),
            currentDescription: form.description,
            specs: form.specs,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "AI заявката не успя");
      const draft = (json as any).data ?? {};
      setForm((prev) => ({
        ...prev,
        slug: typeof draft.slug === "string" && draft.slug.length >= 2 ? draft.slug : prev.slug,
        description: typeof draft.description === "string" ? draft.description : prev.description,
        specs: {
          ...prev.specs,
          ...Object.fromEntries(
            Object.entries((draft.specs ?? {}) as Record<string, unknown>).filter(([key, value]) => {
              return key in prev.specs && value != null && value !== "";
            }),
          ),
        } as SpecsForm,
      }));
    } catch (e: any) {
      setAiError(String(e?.message ?? e));
      setAiDialog("error");
    } finally {
      setAiBusy(false);
    }
  }

  async function requestAiDimensions() {
    if (!form.name.trim()) {
      setDimsNotice({ kind: "warn", text: "Първо въведи името на модела, за да може AI да го разпознае." });
      return;
    }
    setDimsBusy(true);
    setDimsNotice(null);
    try {
      const brandName = brands.find((b) => b.id === form.brandId)?.name;
      const typeName = types.find((t) => t.id === form.typeId)?.name;
      const coolingPowerKw = strNum(form.specs.cooling_power_kw) ?? undefined;
      const heatingPowerKw = strNum(form.specs.heating_power_kw) ?? undefined;
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "product_dimensions",
          input: {
            name: form.name.trim(),
            brandName,
            typeName,
            coolingPowerKw,
            heatingPowerKw,
          },
        }),
      });
      const json = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) throw new Error(((json as any)?.error as string) || "AI заявката не успя");
      const d = ((json as any).data ?? {}) as Record<string, unknown>;

      const dimNum = (v: unknown): string => {
        if (v == null) return "";
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n) || n <= 0) return "";
        return String(Math.round(n));
      };
      const weightNum = (v: unknown): string => {
        if (v == null) return "";
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n) || n <= 0) return "";
        return (Math.round(n * 10) / 10).toString();
      };

      const next: SpecsForm = {
        ...form.specs,
        weight_indoor_kg: weightNum(d.weight_indoor_kg) || form.specs.weight_indoor_kg,
        weight_outdoor_kg: weightNum(d.weight_outdoor_kg) || form.specs.weight_outdoor_kg,
        dim_indoor_length_mm: dimNum(d.dim_indoor_length_mm) || form.specs.dim_indoor_length_mm,
        dim_indoor_width_mm: dimNum(d.dim_indoor_width_mm) || form.specs.dim_indoor_width_mm,
        dim_indoor_height_mm: dimNum(d.dim_indoor_height_mm) || form.specs.dim_indoor_height_mm,
        dim_outdoor_length_mm: dimNum(d.dim_outdoor_length_mm) || form.specs.dim_outdoor_length_mm,
        dim_outdoor_width_mm: dimNum(d.dim_outdoor_width_mm) || form.specs.dim_outdoor_width_mm,
        dim_outdoor_height_mm: dimNum(d.dim_outdoor_height_mm) || form.specs.dim_outdoor_height_mm,
      };

      const filled = [
        next.weight_indoor_kg, next.weight_outdoor_kg,
        next.dim_indoor_length_mm, next.dim_indoor_width_mm, next.dim_indoor_height_mm,
        next.dim_outdoor_length_mm, next.dim_outdoor_width_mm, next.dim_outdoor_height_mm,
      ].filter((v) => v !== "").length;

      setForm((f) => ({ ...f, specs: next }));

      const confidence = String((d as any).confidence ?? "");
      const source = typeof (d as any).source === "string" ? String((d as any).source).slice(0, 160) : "";
      if (filled === 0 || confidence === "none") {
        setDimsNotice({
          kind: "warn",
          text: `AI не успя да намери надеждни размери за „${form.name}“. Провери името/марката или попълни ръчно от спецификацията.`,
        });
      } else if (confidence === "low") {
        setDimsNotice({
          kind: "warn",
          text: `Попълнени са ${filled}/8 полета, но AI не е напълно сигурен (low confidence). Прегледай стойностите преди запис.${source ? ` Източник: ${source}` : ""}`,
        });
      } else {
        setDimsNotice({
          kind: "ok",
          text: `Попълнени са ${filled}/8 полета (${confidence || "ok"} confidence).${source ? ` Източник: ${source}` : ""}`,
        });
      }
    } catch (e: any) {
      setDimsNotice({ kind: "error", text: `Грешка: ${String(e?.message ?? e)}` });
    } finally {
      setDimsBusy(false);
    }
  }

  // (Legacy single-file uploader е премахнат в полза на ProductPhotoUploader.)

  return (
    <div className="grid gap-2 md:gap-5 max-md:text-[13px] max-md:leading-snug">
      {ro && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 max-md:text-xs md:px-3 md:py-2.5 text-sm text-slate-700 leading-snug">
          <strong>Сервизен преглед:</strong> полетата са само за четене. За промени по този продукт обърнете се към офис или главен администратор.
        </div>
      )}
      <fieldset disabled={ro} className="min-w-0 border-0 p-0 m-0 w-full grid gap-2 md:gap-5">
      <datalist id="energy-class-options">{ENERGY_CLASS_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="refrigerant-options">{REFRIGERANT_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="warranty-months-options">{WARRANTY_MONTHS_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="coverage-m2-options">{COVERAGE_M2_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="noise-db-options">{NOISE_DB_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="cooling-kw-options">{COOLING_KW_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="heating-kw-options">{HEATING_KW_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>

      {/* ===================================================================== */}
      {/* БЪРЗ СТАРТ ОТ СНИМКА — складовият flow за PWA на телефон.            */}
      {/* Снимаш ИЛИ избираш от галерия → AI попълва серия + модел + specs.    */}
      {/* Снимките НЕ се пазят (нито Cloudinary, нито база) — само AI анализ. */}
      {/* Multi-photo: бутоните може да се ползват многократно; повторен скан */}
      {/* допълва само празните полета (никога не презаписва ръчни стойности). */}
      {/* ===================================================================== */}
      <section className="rounded-lg max-md:border max-md:border-brand-blue-200 md:rounded-2xl border-2 border-dashed border-brand-blue-200 bg-gradient-to-br from-brand-blue-50/70 via-white to-brand-orange-50/40 p-2 max-md:py-2.5 sm:p-4">
        <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md sm:rounded-lg bg-brand-blue-500 text-white shadow-sm shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <h2 className="text-xs sm:text-base font-bold text-slate-900 leading-tight">
                Бърз старт от снимка{" "}
                <span className="text-[10px] text-slate-500 font-normal hidden sm:inline">
                  (камера или галерия → AI auto-попълване)
                </span>
              </h2>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-600 mt-0.5 sm:mt-1 ml-7 sm:ml-9 leading-snug">
              Снимай или избери готова снимка на етикета — AI чете серийния номер, разпознава модела и попълва пълните технически данни. Може да повториш многократно за различни тела или ъгли.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
          <LabelScanButton
            whichUnit="indoor"
            knownBrand={brands.find((b) => b.id === form.brandId)?.name}
            knownModel={form.modelCode}
            availableBrands={brands.map((b) => b.name)}
            onExtracted={(r) => mergeLabelExtract(r, "indoor")}
          />
          <LabelScanButton
            whichUnit="outdoor"
            knownBrand={brands.find((b) => b.id === form.brandId)?.name}
            knownModel={form.modelCode}
            availableBrands={brands.map((b) => b.name)}
            onExtracted={(r) => mergeLabelExtract(r, "outdoor")}
          />
        </div>
        <p className="mt-2 text-[10px] sm:text-[11px] text-slate-500 leading-snug text-center">
          🔒 Снимките не се запазват — изпращат се само за анализ от AI и веднага се изтриват.
        </p>
        {aiToast && (
          <div
            className={`mt-2 max-md:mt-1.5 rounded-lg md:rounded-xl border px-2.5 py-2 max-md:py-1.5 text-xs md:text-[13px] font-semibold leading-snug flex items-start gap-2 shadow-sm relative ${
              aiToast.kind === "ok"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
            role="status"
            aria-live="polite"
          >
            {aiToast.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 mt-0.5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1 pr-6">
              <div>{aiToast.text}</div>
              {aiToast.details && aiToast.details.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {aiToast.details.map((d, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                        aiToast.kind === "ok"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAiToast(null)}
              className={`absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                aiToast.kind === "ok"
                  ? "text-emerald-700 hover:bg-emerald-100"
                  : "text-amber-700 hover:bg-amber-100"
              }`}
              title="Скрий съобщението"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Двуколоновъ layout на desktop: основни полета (2/3) + страничен панел „Каталог & наличност" (1/3). */}
      <div className="grid gap-2 md:gap-4 lg:grid-cols-3 lg:gap-x-5">
        <div className="lg:col-span-2 grid gap-2 md:gap-4">
          {/* НАЙ-ГОРЕ: Марка + Модел — техническата идентификация. */}
          <div className="grid gap-2 md:gap-4 md:grid-cols-12">
            <label className="block md:col-span-5">
              <FieldTitle
                label="Марка"
                info="Производител (Daikin, Mitsubishi и т.н.). Можеш да избереш от съществуващите ИЛИ да напишеш нова — ще се създаде автоматично."
                ai={isAiField("brandId")}
              />
              <BrandCombobox
                brands={brands}
                value={form.brandId}
                onChange={(brandId) => {
                  clearAiFlag("brandId");
                  setForm((prev) => syncAutoName({ ...prev, brandId }));
                }}
                onBrandCreated={(newBrand) => {
                  // Добавяме в локалния overlay, за да се появи веднага в
                  // dropdown-а и за да го намери `brands.find(...)`.
                  setLocalBrands((prev) =>
                    prev.some((b) => b.id === newBrand.id) ? prev : [...prev, newBrand],
                  );
                }}
                aiHighlighted={isAiField("brandId")}
              />
            </label>
            <label className="block md:col-span-7">
              <FieldTitle
                label="Модел"
                info="Само моделът — кратко техническо обозначение от табелката."
                ai={isAiField("modelCode")}
              />
              <Input
                value={form.modelCode}
                onChange={(e) => {
                  clearAiFlag("modelCode");
                  setForm((prev) => syncAutoName({ ...prev, modelCode: e.target.value }));
                }}
                placeholder="напр. FTXA50AW"
                autoCapitalize="characters"
                className={isAiField("modelCode") ? "border-emerald-300 bg-emerald-50/40" : ""}
              />
            </label>
          </div>

          {/* СЛЕД МАРКА+МОДЕЛ: Slug + Име в клиентския каталог. */}
          <div className="grid gap-2 md:gap-4 md:grid-cols-12">
            <label className="block md:col-span-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Slug (по избор)</div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const next = slugifyBg(form.name || form.modelCode || "");
                    if (next.length >= 2) setForm((f) => ({ ...f, slug: next }));
                  }}
                  title="Генерирай slug от името в каталога"
                  className="!py-1 !px-2.5 !text-xs gap-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Генерирай
                </Button>
              </div>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto от името" />
              <div className="text-[10px] text-slate-400 mt-0.5 leading-snug hidden md:block">
                По избор. Ползва се за URL и за папка при качване на снимки (мин. 2 знака).
              </div>
            </label>

            <label className="block md:col-span-7">
              <div className="flex items-center justify-between gap-2 mb-1 leading-tight">
                <div>
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Име в клиентския каталог</div>
                  <div className="hidden md:block text-[10px] text-slate-400 truncate" title="Това вижда клиентът. Обикновено: марка + модел + kW.">
                    Това вижда клиентът. Обикновено: марка + модел + kW.
                  </div>
                </div>
                {!nameDirty && form.name.trim() && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 whitespace-nowrap"
                    title="Името се генерира автоматично от марка/модел/kW. Промяна го заключва."
                  >
                    <Sparkles className="w-3 h-3" /> auto
                  </span>
                )}
              </div>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setNameDirty(true);
                  setForm((prev) => {
                    if (prev.slug.trim().length >= 2) return { ...prev, name };
                    const nextSlug = slugifyBg(name);
                    return { ...prev, name, slug: nextSlug.length >= 2 ? nextSlug : prev.slug };
                  });
                }}
                placeholder="напр. Daikin Stylish FTXA50AW 5kW"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <label className="block">
              <FieldTitle label="Тип" info="Стенен, мулти-сплит, касетъчен и т.н." />
              <Select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </label>
            <label className="block">
              <FieldTitle label="Състояние" info="Нови или Втора употреба." />
              <Select value={form.productCondition} onChange={(e) => setForm({ ...form, productCondition: e.target.value as AdminProductForm["productCondition"] })}>
                <option value="new">Нови</option>
                <option value="used">Втора употреба</option>
              </Select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <label className="block">
              <FieldTitle label="Цена (EUR)" info="Цена на уреда без монтаж, в евро." />
              <div className="relative">
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => canEditPrice && setForm({ ...form, price: Number(e.target.value) })}
                  disabled={!canEditPrice}
                  className={!canEditPrice ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}
                />
                {!canEditPrice && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">🔒 само Admin</span>
                )}
              </div>
            </label>
            <label className="block">
              <FieldTitle label="Цена с монтаж (EUR)" info={priceWithMountFieldInfo} />
              <div className="relative">
                <Input
                  value={form.priceWithMount}
                  onChange={(e) => {
                    if (!canEditPrice) return;
                    if (autoPriceWithMountFromCatalog) setCatalogPwmUserEdited(true);
                    setForm({ ...form, priceWithMount: e.target.value });
                  }}
                  placeholder="по избор"
                  disabled={!canEditPrice}
                  className={!canEditPrice ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}
                />
                {!canEditPrice && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">🔒</span>
                )}
              </div>
              {showCatalogMountAutoHint && catalogMountDefaults && (
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  Автоматично: цена +{" "}
                  {form.productCondition === "used"
                    ? `${catalogMountDefaults.used} € (втора употреба)`
                    : `${catalogMountDefaults.new} € (нов)`}{" "}
                  от настройките на каталога.
                </p>
              )}
            </label>
          </div>

          <label className="block">
            <div className="flex items-center justify-between gap-3">
              <FieldTitle label="Описание" info="Кратко описание/текст за продукта. Показва се на детайлната страница." />
              <Button type="button" variant="secondary" size="sm" onClick={requestAiDraft} disabled={aiBusy} className="mb-1 gap-1.5 whitespace-nowrap">
                <Wand2 className="w-3.5 h-3.5" /> {aiBusy ? "AI..." : "AI чернова"}
              </Button>
            </div>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="max-md:min-h-[5.5rem] md:min-h-[7rem]" />
          </label>

          <label className="block">
            <FieldTitle
              label="Вътрешна бележка"
              info="Само за екипа в админ панела — не се показва в публичния каталог."
            />
            <Textarea
              value={form.internalNote}
              onChange={(e) => setForm({ ...form, internalNote: e.target.value })}
              rows={2}
              placeholder="Бележки за склад, резервации, особености…"
              className="max-md:min-h-[4rem] md:min-h-[5rem] border-amber-200/80 bg-amber-50/40 focus:border-amber-300"
              disabled={readOnly}
            />
          </label>
        </div>

        {/* Страничен панел: Каталог & наличност */}
        <aside className="lg:col-span-1 grid gap-2 md:gap-3 rounded-lg md:rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 md:p-4 lg:sticky lg:top-4 lg:self-start order-first lg:order-none">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 md:pb-2">
            <div className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-700">Каталог &amp; наличност</div>
            <span className="text-[10px] text-slate-400">витрина / склад</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">Статус</div>
              <Select value={form.stockStatus} onChange={(e) => setForm({ ...form, stockStatus: e.target.value as AdminProductForm["stockStatus"] })}>
                <option value="in_stock">В наличност</option>
                <option value="out_of_stock">Изчерпан</option>
                <option value="on_order">По поръчка</option>
              </Select>
            </label>
            <div className="block">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide leading-tight">
                  Количество
                </div>
                <span
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-1 py-px uppercase tracking-wide whitespace-nowrap"
                  title="Изчислява се автоматично — броят на всички продукти със същата марка и модел, които са в наличност."
                >
                  🔄 авто
                </span>
              </div>
              {(() => {
                // Display value:
                //  - preview е достъпен и моделът е попълнен → ползваме nextInStock;
                //  - в противен случай показваме стойността от базата (form.stockQuantity).
                const displayQty =
                  modelStockPreview && form.brandId && form.modelCode.trim()
                    ? modelStockPreview.nextInStock
                    : form.stockQuantity;
                return (
                  <Input
                    type="number"
                    min={0}
                    value={displayQty}
                    readOnly
                    tabIndex={-1}
                    className="bg-slate-100 text-slate-700 cursor-not-allowed border-slate-200"
                    title="Полето е автоматично — броят на инстанциите със същия модел в наличност."
                  />
                );
              })()}
            </div>
          </div>

          {/* Помощен ред под „Статус / Количество“: обяснява автоматичния
              механизъм + показва live preview. */}
          {form.brandId && form.modelCode.trim() ? (
            <div className="-mt-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[10.5px] leading-snug text-emerald-900">
              {modelStockLoading ? (
                <span className="opacity-70">Изчисляване…</span>
              ) : modelStockPreview ? (
                modelStockPreview.othersTotal === 0 ? (
                  <span>
                    Първа инстанция на този модел.{" "}
                    {form.stockStatus === "in_stock"
                      ? <strong>След save: 1 бр. в каталога.</strong>
                      : <strong>След save: 0 бр. (изчерпан).</strong>}
                  </span>
                ) : (
                  <span>
                    В базата има още <strong>{modelStockPreview.othersTotal}</strong> бр. от същия модел
                    ({modelStockPreview.otherInStock} в наличност).{" "}
                    <strong>След save: {modelStockPreview.nextInStock} бр.</strong> в каталога.
                  </span>
                )
              ) : (
                <span className="opacity-70">
                  Количеството ще се преизчисли при save (брой инстанции в наличност).
                </span>
              )}
            </div>
          ) : (
            <div className="-mt-1 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5 text-[10.5px] leading-snug text-slate-500">
              Попълни марка и модел, за да видиш колко инстанции от същия модел има в каталога.
            </div>
          )}

          <label className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300"
              checked={form.showInPublicCatalog}
              onChange={(e) => setForm({ ...form, showInPublicCatalog: e.target.checked })}
            />
            <span className="text-[11px] leading-snug text-slate-700">
              <span className="font-bold block">Вижда се в публичния каталог</span>
              <span className="text-slate-500">Клиентите няма да виждат складов статус на сайта.</span>
            </span>
          </label>

          <label className="block">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">Местоположение</div>
            <Select
              value={form.stockLocation}
              disabled={!canEditStockLocation}
              onChange={(e) => setForm({ ...form, stockLocation: e.target.value as ProductStockLocation })}
              className={!canEditStockLocation ? "opacity-65 cursor-not-allowed bg-slate-50" : ""}
            >
              <option value="showroom">В магазин</option>
              <option value="warehouse">В склада</option>
            </Select>
            {!canEditStockLocation && (
              <div className="text-[10px] text-slate-500 mt-0.5">Промяна: главен админ или офис.</div>
            )}
          </label>

          <label className="block">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">Страна (произход)</div>
            <Select
              value={form.productRegion}
              disabled={!canEditProductRegion}
              onChange={(e) => setForm({ ...form, productRegion: e.target.value as ProductRegion })}
              className={!canEditProductRegion ? "opacity-65 cursor-not-allowed bg-slate-50" : ""}
            >
              <option value="europe">EUROPE</option>
              <option value="japan">JAPAN</option>
            </Select>
            {!canEditProductRegion && (
              <div className="text-[10px] text-slate-500 mt-0.5">Промяна: главен админ или офис.</div>
            )}
          </label>

          <label className="flex items-center gap-2 cursor-pointer rounded-md md:rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 md:px-3 md:py-2 mt-0.5 md:mt-1">
            <input type="checkbox" className="w-4 h-4 max-md:w-3.5 max-md:h-3.5 rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
            <span className="text-xs md:text-sm font-semibold text-slate-700">Избран <span className="text-slate-400 font-normal text-[10px] md:text-[11px]">(подчертава в каталога)</span></span>
          </label>
        </aside>
      </div>

      <CollapsibleSection title="Серийни номера и доставчик" badge="вътрешен запис, не се показва публично">
        {highlightDelivery && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              <span className="mt-0.5 text-red-500">&#9888;</span>
              <span>Попълнете <strong>серийните номера</strong>, <strong>дата на доставка</strong> и <strong>номер на фактура</strong> за да завършите записа.</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-2.5 md:gap-x-4 md:gap-y-3">
          <label className="block">
            <div className="flex items-center justify-between gap-2 mb-1 leading-tight">
              <div>
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Серия вътрешно тяло
                  {isAiField("indoorUnitSerial") && <AiBadge />}
                </div>
                <div className="text-[10px] text-slate-400 truncate" title="Уникален № от табелката. Проверка за дублиране.">
                  Уникален № от табелката. Проверка за дублиране.
                </div>
              </div>
              <LabelScanButton
                variant="compact"
                whichUnit="indoor"
                knownBrand={brands.find((b) => b.id === form.brandId)?.name}
                knownModel={form.modelCode}
                availableBrands={brands.map((b) => b.name)}
                onExtracted={(r) => mergeLabelExtract(r, "indoor")}
              />
            </div>
            <Input
              value={form.indoorUnitSerial}
              onChange={(e) => {
                setForm({ ...form, indoorUnitSerial: e.target.value });
                if (isAiField("indoorUnitSerial")) clearAiFlag("indoorUnitSerial");
              }}
              placeholder="напр. T000532"
              className={`${indoorDup.length > 0 ? "border-amber-400 focus:ring-amber-400" : ""} ${isAiField("indoorUnitSerial") ? "border-emerald-300 bg-emerald-50/40" : ""} ${highlightDelivery && !form.indoorUnitSerial.trim() ? "border-red-400 ring-2 ring-red-300/50" : ""}`}
            />
            <SerialDuplicateNotice matches={indoorDup} label="вътрешно" />
          </label>
          <label className="block">
            <div className="flex items-center justify-between gap-2 mb-1 leading-tight">
              <div>
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  Серия външно тяло
                  {isAiField("outdoorUnitSerial") && <AiBadge />}
                </div>
                <div className="text-[10px] text-slate-400 truncate" title="Уникален № от табелката. Проверка за дублиране.">
                  Уникален № от табелката. Проверка за дублиране.
                </div>
              </div>
              <LabelScanButton
                variant="compact"
                whichUnit="outdoor"
                knownBrand={brands.find((b) => b.id === form.brandId)?.name}
                knownModel={form.modelCode}
                availableBrands={brands.map((b) => b.name)}
                onExtracted={(r) => mergeLabelExtract(r, "outdoor")}
              />
            </div>
            <Input
              value={form.outdoorUnitSerial}
              onChange={(e) => {
                setForm({ ...form, outdoorUnitSerial: e.target.value });
                if (isAiField("outdoorUnitSerial")) clearAiFlag("outdoorUnitSerial");
              }}
              placeholder="напр. T001024"
              className={`${outdoorDup.length > 0 ? "border-amber-400 focus:ring-amber-400" : ""} ${isAiField("outdoorUnitSerial") ? "border-emerald-300 bg-emerald-50/40" : ""} ${highlightDelivery && !form.outdoorUnitSerial.trim() ? "border-red-400 ring-2 ring-red-300/50" : ""}`}
            />
            <SerialDuplicateNotice matches={outdoorDup} label="външно" />
          </label>
          <label className="block md:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <FieldTitle label="Доставчик" info="От контакти тип „доставчик“. Управление в Контакти." />
              <Link
                href="/admin/contacts?kind=supplier"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue-700 hover:text-brand-blue-900 -mt-1"
                title="Отвори списък с доставчици"
              >
                Управление <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">— няма избран доставчик —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
            {suppliers.length === 0 && (
              <div className="mt-1.5 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                Няма доставчици. Създайте в Контакти.
              </div>
            )}
          </label>
          <label className="block">
            <FieldTitle label="Закупено на" info="Дата на покупка (YYYY-MM-DD)." />
            <Input type="date" value={form.purchasedAt} onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })} className={highlightDelivery && !form.purchasedAt.trim() ? "border-red-400 ring-2 ring-red-300/50" : ""} />
          </label>
          <label className="block">
            <FieldTitle label="Фактура № (доставчик)" info="Номер на фактура от доставчика." />
            <Input value={form.supplierInvoiceNumber} onChange={(e) => setForm({ ...form, supplierInvoiceNumber: e.target.value })} placeholder="напр. 0000123456" className={highlightDelivery && !form.supplierInvoiceNumber.trim() ? "border-red-400 ring-2 ring-red-300/50" : ""} />
          </label>
          <label className="block">
            <FieldTitle label="Закупна цена (EUR)" info="Цена от доставчика (не продажната). Само главен админ." />
            <Input
              value={form.purchasePrice}
              onChange={(e) => canEditPrice && setForm({ ...form, purchasePrice: e.target.value })}
              placeholder="по избор"
              disabled={!canEditPrice}
              className={!canEditPrice ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}
            />
            {!canEditPrice && (
              <div className="text-[11px] text-slate-500 mt-1">🔒 Само главен админ.</div>
            )}
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Технически данни" badge="Остави празно поле, ако нямаш надеждна стойност">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-2.5 md:gap-x-4 md:gap-y-3">
          <label className="block">
            <FieldTitle label="Площ (м²)" info="Препоръчителна квадратура (по спецификация)." ai={isAiField("specs.coverage_m2")} />
            <Input value={form.specs.coverage_m2} onChange={(e) => setSpec("coverage_m2", e.target.value)} list="coverage-m2-options" placeholder="25" className={aiHl("specs.coverage_m2")} />
          </label>
          <label className="block">
            <FieldTitle label="Шум (dB)" info="Ниво на шум (вътрешно тяло). По-ниско = по-тих." ai={isAiField("specs.noise_db")} />
            <Input value={form.specs.noise_db} onChange={(e) => setSpec("noise_db", e.target.value)} list="noise-db-options" placeholder="19" className={aiHl("specs.noise_db")} />
          </label>
          <label className="block">
            <FieldTitle label="Охлаждане (kW)" info="Номинална охладителна мощност." ai={isAiField("specs.cooling_power_kw")} />
            <Input value={form.specs.cooling_power_kw} onChange={(e) => setSpec("cooling_power_kw", e.target.value)} list="cooling-kw-options" placeholder="2.5" className={aiHl("specs.cooling_power_kw")} />
          </label>
          <label className="block">
            <FieldTitle label="Отопление (kW)" info="Номинална отоплителна мощност." ai={isAiField("specs.heating_power_kw")} />
            <Input value={form.specs.heating_power_kw} onChange={(e) => setSpec("heating_power_kw", e.target.value)} list="heating-kw-options" placeholder="3.2" className={aiHl("specs.heating_power_kw")} />
          </label>
          <label className="block">
            <FieldTitle label="Хладилен агент" info="Напр. R-32 (от табелката)." ai={isAiField("specs.refrigerant")} />
            <Input value={form.specs.refrigerant} onChange={(e) => setSpec("refrigerant", e.target.value)} list="refrigerant-options" placeholder="R-32" className={aiHl("specs.refrigerant")} />
          </label>
          <label className="block">
            <FieldTitle label="Енергиен клас (охлаждане)" info="Напр. A+++." ai={isAiField("specs.energy_class_cool")} />
            <Input value={form.specs.energy_class_cool} onChange={(e) => setSpec("energy_class_cool", e.target.value)} list="energy-class-options" placeholder="A+++" className={aiHl("specs.energy_class_cool")} />
          </label>
          <label className="block">
            <FieldTitle label="Енергиен клас (отопление)" info="Напр. A++." ai={isAiField("specs.energy_class_heat")} />
            <Input value={form.specs.energy_class_heat} onChange={(e) => setSpec("energy_class_heat", e.target.value)} list="energy-class-options" placeholder="A++" className={aiHl("specs.energy_class_heat")} />
          </label>
          <label className="block">
            <FieldTitle label="SEER" info="Сезонна ефективност (охлаждане). По-високо = по-икономично." ai={isAiField("specs.seer")} />
            <Input value={form.specs.seer} onChange={(e) => setSpec("seer", e.target.value)} className={aiHl("specs.seer")} />
          </label>
          <label className="block">
            <FieldTitle label="SCOP" info="Сезонна ефективност (отопление). По-високо = по-икономично." ai={isAiField("specs.scop")} />
            <Input value={form.specs.scop} onChange={(e) => setSpec("scop", e.target.value)} className={aiHl("specs.scop")} />
          </label>
          <label className="block">
            <FieldTitle label="Гаранция (месеци)" info="Напр. 36 = 3 години." ai={isAiField("specs.warranty_months")} />
            <Input value={form.specs.warranty_months} onChange={(e) => setSpec("warranty_months", e.target.value)} list="warranty-months-options" placeholder="36" className={aiHl("specs.warranty_months")} />
          </label>
          <label className={`flex items-center gap-2 cursor-pointer rounded-md md:rounded-lg border px-2.5 py-1.5 md:px-3 md:py-2 self-end sm:col-span-2 lg:col-span-1 ${isAiField("specs.wifi") ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"}`}>
            <input type="checkbox" className="w-3.5 h-3.5 md:w-4 md:h-4 rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500" checked={form.specs.wifi} onChange={(e) => setSpec("wifi", e.target.checked)} />
            <span className="text-xs md:text-sm font-semibold text-slate-700 flex items-center gap-1">WiFi <span className="text-slate-400 font-normal text-[10px] md:text-[11px]">(модул)</span>{isAiField("specs.wifi") && <AiBadge />}</span>
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Размери и тегло" badge="Информация от спецификацията / етикета на уреда" defaultOpen={false}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4 -mt-1">
          <p className="text-xs text-slate-500 max-w-xl">
            Стойностите се показват в детайлната страница на продукта. Теглото е в килограми, размерите — в милиметри. Можеш да попълниш ръчно или да оставиш AI да намери стойностите от каталога на производителя.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void requestAiDimensions()}
            disabled={dimsBusy}
            className="gap-1.5 whitespace-nowrap shrink-0"
            title="AI намира размерите и теглото от каталога на производителя по името и марката."
          >
            <Wand2 className="w-3.5 h-3.5" />
            {dimsBusy ? "AI търси..." : "AI попълни размери и тегло"}
          </Button>
        </div>

        {dimsNotice && (
          <div
            className={`mb-4 rounded-xl border px-3 py-2.5 text-[12px] leading-snug font-medium ${
              dimsNotice.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : dimsNotice.kind === "warn"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {dimsNotice.text}
          </div>
        )}

        <div className="space-y-3 md:space-y-5">
          <div>
            <div className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-brand-blue-700 mb-1.5 md:mb-2">Вътрешен блок</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <label className="block">
                <FieldTitle label="Тегло (kg)" info="Тегло на вътрешния блок в килограми." ai={isAiField("specs.weight_indoor_kg")} />
                <Input value={form.specs.weight_indoor_kg} onChange={(e) => setSpec("weight_indoor_kg", e.target.value)} placeholder="24.0" inputMode="decimal" className={aiHl("specs.weight_indoor_kg")} />
              </label>
              <label className="block">
                <FieldTitle label="Дължина (mm)" info="Дължина на вътрешния блок в милиметри." ai={isAiField("specs.dim_indoor_length_mm")} />
                <Input value={form.specs.dim_indoor_length_mm} onChange={(e) => setSpec("dim_indoor_length_mm", e.target.value)} placeholder="840" inputMode="numeric" className={aiHl("specs.dim_indoor_length_mm")} />
              </label>
              <label className="block">
                <FieldTitle label="Ширина (mm)" info="Ширина (дълбочина) на вътрешния блок в милиметри." ai={isAiField("specs.dim_indoor_width_mm")} />
                <Input value={form.specs.dim_indoor_width_mm} onChange={(e) => setSpec("dim_indoor_width_mm", e.target.value)} placeholder="840" inputMode="numeric" className={aiHl("specs.dim_indoor_width_mm")} />
              </label>
              <label className="block">
                <FieldTitle label="Височина (mm)" info="Височина на вътрешния блок в милиметри." ai={isAiField("specs.dim_indoor_height_mm")} />
                <Input value={form.specs.dim_indoor_height_mm} onChange={(e) => setSpec("dim_indoor_height_mm", e.target.value)} placeholder="298" inputMode="numeric" className={aiHl("specs.dim_indoor_height_mm")} />
              </label>
            </div>
          </div>

          <div>
            <div className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-brand-orange-700 mb-1.5 md:mb-2">Външен блок</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <label className="block">
                <FieldTitle label="Тегло (kg)" info="Тегло на външния блок в килограми." ai={isAiField("specs.weight_outdoor_kg")} />
                <Input value={form.specs.weight_outdoor_kg} onChange={(e) => setSpec("weight_outdoor_kg", e.target.value)} placeholder="134.0" inputMode="decimal" className={aiHl("specs.weight_outdoor_kg")} />
              </label>
              <label className="block">
                <FieldTitle label="Дължина (mm)" info="Дължина на външния блок в милиметри." ai={isAiField("specs.dim_outdoor_length_mm")} />
                <Input value={form.specs.dim_outdoor_length_mm} onChange={(e) => setSpec("dim_outdoor_length_mm", e.target.value)} placeholder="950" inputMode="numeric" className={aiHl("specs.dim_outdoor_length_mm")} />
              </label>
              <label className="block">
                <FieldTitle label="Ширина (mm)" info="Ширина (дълбочина) на външния блок в милиметри." ai={isAiField("specs.dim_outdoor_width_mm")} />
                <Input value={form.specs.dim_outdoor_width_mm} onChange={(e) => setSpec("dim_outdoor_width_mm", e.target.value)} placeholder="330" inputMode="numeric" className={aiHl("specs.dim_outdoor_width_mm")} />
              </label>
              <label className="block">
                <FieldTitle label="Височина (mm)" info="Височина на външния блок в милиметри." ai={isAiField("specs.dim_outdoor_height_mm")} />
                <Input value={form.specs.dim_outdoor_height_mm} onChange={(e) => setSpec("dim_outdoor_height_mm", e.target.value)} placeholder="1350" inputMode="numeric" className={aiHl("specs.dim_outdoor_height_mm")} />
              </label>
            </div>
          </div>
        </div>
      </CollapsibleSection>
      </fieldset>

      <CollapsibleSection
        title={`Снимки на продукта (до ${MAX_PRODUCT_IMAGES})`}
        badge={
          form.modelCode.trim()
            ? `smolyanklima/${cloudinaryKind === "accessory" ? "aksesoari" : "klimatici"}/<brand-model>/`
            : `smolyanklima/${cloudinaryKind === "accessory" ? "aksesoari" : "klimatici"}/<slug>/`
        }
      >
        <p className="text-[12px] text-slate-500 mb-3 -mt-1 leading-snug">
          {ro
            ? "Преглед на качените снимки. Качване и редакция са достъпни само за офис и главен администратор."
            : form.modelCode.trim()
              ? "Снимките се качват в споделена папка по модел — така различните инстанции (с различен сериен номер) ползват едни и същи каталожни снимки."
              : "Попълни „Марка“ и „Модел“ за споделена папка между инстанции. Иначе папката се прави по slug."}
        </p>

        {/* === Вече качени снимки (form.images) — малки thumbnail-и === */}
        {form.images.length > 0 && (
          <div className="mb-3">
            <FieldTitle
              label={`Качени снимки (${form.images.length}/${MAX_PRODUCT_IMAGES})`}
              info="Снимки, които вече са в Cloudinary. Кликни върху thumbnail за уголемяване; задръж върху него за бутоните „Главна“, „AI подобри“ и „Махни“."
            />

            {/* AI enhance info за стари снимки */}
            {!ro &&
            (() => {
              const busyCount = Object.values(uploadedAiStatus).filter(
                (v) => v.phase === "processing",
              ).length;
              return (
                <div className="mb-2 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50/60 px-2.5 py-2 flex items-start gap-2">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500 text-white shadow-sm shrink-0">
                    <Wand2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-violet-900 leading-tight">
                      AI „професионален каталог“ вид за стари снимки
                    </div>
                    <p className="text-[10.5px] text-violet-800 leading-snug mt-0.5">
                      Сложи курсора върху снимка и натисни „✨“ — Gemini Nano Banana ще
                      смени фона на бял със soft shadow и ще нормализира светлината.{" "}
                      Стандартна снимка ще се замени с подобрена версия в Cloudinary.{" "}
                      Цена: <strong>~{AI_ENHANCE_PRICE_DISPLAY}/снимка</strong>.
                      {busyCount > 0 && (
                        <> Обработват се: <strong>{busyCount}</strong>...</>
                      )}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-wrap gap-1.5">
              {form.images.map((im, idx) => {
                const ai = uploadedAiStatus[im.url];
                const isProcessing = ai?.phase === "processing";
                const isError = ai?.phase === "error";
                return (
                  <div
                    key={`${im.url}-${idx}`}
                    className={`group relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 bg-white shadow-sm transition-all ${
                      isProcessing
                        ? "border-violet-400 ring-1 ring-violet-200"
                        : im.is_main
                          ? "border-brand-blue-500 ring-2 ring-brand-blue-200"
                          : "border-slate-200"
                    }`}
                  >
                    {im.url ? (
                      <button
                        type="button"
                        onClick={() => setImageLightboxIndex(idx)}
                        className="w-full h-full block cursor-zoom-in"
                        title="Кликни за уголемяване"
                      >
                        <img src={im.url} alt={`img-${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400 text-center p-1">
                        Празен
                      </div>
                    )}

                    {im.is_main && (
                      <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-brand-blue-600 text-white text-[8px] font-bold shadow-md pointer-events-none">
                        ★
                      </div>
                    )}

                    {/* AI обработка overlay */}
                    {isProcessing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-violet-900/65 text-white pointer-events-none">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <div className="text-[8px] font-bold mt-0.5">AI...</div>
                      </div>
                    )}
                    {isError && !isProcessing && (
                      <div
                        className="absolute inset-x-0 bottom-0 bg-red-900/85 text-white text-[8px] font-bold p-0.5 text-center leading-tight pointer-events-none"
                        title={ai!.phase === "error" ? ai!.message : ""}
                      >
                        AI ✕
                      </div>
                    )}

                    {/* Hover overlay с компактни action-и */}
                    {!isProcessing && !ro && (
                      <div className="absolute inset-x-0 bottom-0 flex bg-slate-900/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {!im.is_main && (
                          <button
                            type="button"
                            title="Направи главна"
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm({
                                ...form,
                                images: form.images.map((row, i) => ({ ...row, is_main: i === idx })),
                              });
                            }}
                            className="flex-1 py-0.5 text-white text-[9px] font-bold hover:bg-brand-blue-600/80"
                          >
                            ★
                          </button>
                        )}
                        <button
                          type="button"
                          title={`AI подобри (~${AI_ENHANCE_PRICE_DISPLAY})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void enhanceUploadedImage(im.url);
                          }}
                          className="flex-1 py-0.5 text-white text-[9px] font-bold hover:bg-violet-600/80"
                        >
                          ✨
                        </button>
                        <button
                          type="button"
                          title="Премахни снимката"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({
                              ...form,
                              images: form.images.filter((_, i) => i !== idx),
                            });
                          }}
                          className="flex-1 py-0.5 text-white text-[9px] font-bold hover:bg-red-600/80"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {ro && form.images.length === 0 && (
          <p className="text-sm text-slate-500 py-1">Няма качени снимки за този продукт.</p>
        )}

        {/* === Multi-photo uploader === */}
        {!ro && (
        <ProductPhotoUploader
          brandSlug={
            // Извличаме brand slug от името на марката (липсва от brands prop).
            (() => {
              const b = brands.find((br) => br.id === form.brandId);
              return b ? slugifyBg(b.name) : null;
            })()
          }
          brandName={brands.find((br) => br.id === form.brandId)?.name ?? null}
          modelCode={form.modelCode}
          productSlug={form.slug || slugifyBg(form.name || "")}
          cloudinaryKind={cloudinaryKind}
          remainingSlots={Math.max(0, MAX_PRODUCT_IMAGES - form.images.length)}
          onUploaded={(urls) =>
            setForm((f) => {
              const baseLen = f.images.length;
              const next: ImageRow[] = urls.map((url, i) => ({
                url,
                sort_order: baseLen + i,
                is_main: baseLen === 0 && i === 0,
              }));
              return { ...f, images: [...f.images, ...next] };
            })
          }
          onPendingChange={setPendingPhotosCount}
          reusableImages={reusablePhotos?.images ?? null}
          reusableFromName={reusablePhotos?.sourceName ?? null}
          onLinkReusable={
            reusablePhotos
              ? () => {
                  setForm((f) => {
                    if (f.images.length > 0) return f; // не презаписваме съществуващи
                    const slice = reusablePhotos.images.slice(0, MAX_PRODUCT_IMAGES);
                    // Определяме главната снимка преди map-а, за да гарантираме
                    // че точно ЕДНА снимка ще има is_main=true (избягваме бъг,
                    // в който две снимки стават главни едновременно).
                    let mainIdx = slice.findIndex((im) => im.is_main);
                    if (mainIdx < 0) mainIdx = 0;
                    const linked: ImageRow[] = slice.map((im, i) => ({
                      url: im.url,
                      sort_order: i,
                      is_main: i === mainIdx,
                    }));
                    return { ...f, images: linked };
                  });
                  setReusablePhotos(null);
                }
              : undefined
          }
        />
        )}

        {/* Pending-photos warning — duplicated на парент level от save handler-а,
             но и тук показваме персистентно напомняне. */}
        {pendingPhotosCount > 0 && !ro && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900 leading-snug font-medium">
            ⚠️ Имаш {pendingPhotosCount}{" "}
            {pendingPhotosCount === 1 ? "снимка в preview" : "снимки в preview"} които не са качени в
            Cloudinary. Натисни „Качи в Cloudinary“ преди запазване на продукта.
          </div>
        )}
      </CollapsibleSection>

      {/* Lightbox за уголемяване на качените снимки. */}
      <ImageLightbox
        images={form.images.map((im) => im.url).filter(Boolean)}
        index={imageLightboxIndex}
        onClose={() => setImageLightboxIndex(null)}
        onIndexChange={(n) => setImageLightboxIndex(n)}
      />

      {aiDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-slate-950/55 backdrop-blur-md"
          onClick={() => !aiBusy && setAiDialog(null)}
        >
          <div
            className="w-full md:max-w-xl overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
            <div className="relative border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f8fafc_100%)] px-6 py-5">
              <button
                type="button"
                onClick={() => setAiDialog(null)}
                disabled={aiBusy}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-50"
                aria-label="Затвори AI прозореца"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 pr-10">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${aiDialog === "error" ? "bg-red-600 shadow-red-600/25" : "bg-brand-blue-500"}`}>
                  {aiDialog === "error" ? <AlertCircle className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue-700">Gemini продуктова чернова</div>
                  <div className="mt-1 text-2xl font-black leading-tight text-slate-950">
                    {aiDialog === "missing_name" ? "Нужно е име на продукта" : aiDialog === "replace_description" ? "Да заменя описанието?" : "AI заявката не успя"}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {aiDialog === "missing_name" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
                  Попълни първо името на продукта. AI черновата използва името, марката, типа и цената, за да направи смислено описание и спецификации.
                </div>
              )}
              {aiDialog === "replace_description" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Текущо описание</div>
                    <div className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {form.description}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-brand-blue-100 bg-brand-blue-50/70 p-4 text-sm font-semibold leading-6 text-slate-900">
                    AI черновата ще замени това описание и ще допълни празните спецификации, когато Gemini има достатъчно информация.
                  </div>
                </div>
              )}
              {aiDialog === "error" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-800">
                  {aiError || "Възникна неочаквана грешка при AI черновата."}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setAiDialog(null)} disabled={aiBusy} className="justify-center">
                {aiDialog === "missing_name" || aiDialog === "error" ? "Разбрах" : "Отказ"}
              </Button>
              {aiDialog === "replace_description" && (
                <Button onClick={() => void generateAiDraft()} disabled={aiBusy} className="justify-center gap-2 shadow-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  {aiBusy ? "Генериране..." : "Замени с AI чернова"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
