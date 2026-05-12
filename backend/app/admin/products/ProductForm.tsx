"use client";

import { useEffect, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Input, Select, Textarea, Button } from "../ui";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Sparkles, Wand2, Upload, Plus, Trash2, X, ExternalLink } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { normalizeProductStockLocation, type ProductStockLocation } from "@/lib/admin/productStockLocation";
import { normalizeProductRegion, type ProductRegion } from "@/lib/admin/productRegion";

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
  name: string;
  brandId: string;
  typeId: string;
  productCondition: "new" | "used";
  description: string;
  price: number;
  priceWithMount: string;
  indoorUnitSerial: string;
  outdoorUnitSerial: string;
  supplierId: string;
  purchasedAt: string;
  supplierInvoiceNumber: string;
  purchasePrice: string;
  isFeatured: boolean;
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
    brandId: "",
    typeId: "",
    productCondition: "new",
    description: "",
    price: 0,
    priceWithMount: "",
    indoorUnitSerial: "",
    outdoorUnitSerial: "",
    supplierId: "",
    purchasedAt: "",
    supplierInvoiceNumber: "",
    purchasePrice: "",
    isFeatured: false,
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

function FieldTitle({ label, info }: { label: string; info: string }) {
  return (
    <div className="mb-1">
      <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{info}</div>
    </div>
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
    brandId: form.brandId,
    typeId: form.typeId,
    productCondition: form.productCondition,
    description: form.description.trim() || undefined,
    price: Number(form.price),
    priceWithMount: pwm ?? undefined,
    indoorUnitSerial: form.indoorUnitSerial.trim() || null,
    outdoorUnitSerial: form.outdoorUnitSerial.trim() || null,
    supplierId: form.supplierId.trim() || null,
    purchasedAt: form.purchasedAt.trim() || null,
    supplierInvoiceNumber: form.supplierInvoiceNumber.trim() || null,
    purchasePrice: pp ?? null,
    isFeatured: form.isFeatured,
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
    brandId: form.brandId,
    typeId: form.typeId,
    productCondition: form.productCondition,
    description: form.description.trim() || null,
    price: Number(form.price),
    priceWithMount: pwm,
    indoorUnitSerial: form.indoorUnitSerial.trim() || null,
    outdoorUnitSerial: form.outdoorUnitSerial.trim() || null,
    supplierId: form.supplierId.trim() || null,
    purchasedAt: form.purchasedAt.trim() || null,
    supplierInvoiceNumber: form.supplierInvoiceNumber.trim() || null,
    purchasePrice: pp,
    isFeatured: form.isFeatured,
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
  brand_id: string;
  type_id: string;
  product_condition?: "new" | "used";
  description?: string | null;
  price: number;
  price_with_mount?: number | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  supplier_id?: string | null;
  purchased_at?: string | null;
  supplier_invoice_number?: string | null;
  purchase_price?: number | null;
  is_featured: boolean;
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
    brandId: p.brand_id,
    typeId: p.type_id,
    productCondition: p.product_condition === "used" ? "used" : "new",
    description: p.description ?? "",
    price: Number(p.price),
    priceWithMount: p.price_with_mount != null ? String(p.price_with_mount) : "",
    indoorUnitSerial: p.indoor_unit_serial ?? "",
    outdoorUnitSerial: p.outdoor_unit_serial ?? "",
    supplierId: p.supplier_id ?? "",
    purchasedAt: d(p.purchased_at),
    supplierInvoiceNumber: p.supplier_invoice_number ?? "",
    purchasePrice: p.purchase_price != null ? String(p.purchase_price) : "",
    isFeatured: Boolean(p.is_featured),
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
    <div className="border-t border-slate-200 pt-4 md:pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 mb-3 group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-slate-900 leading-tight">{title}</h2>
          {badge && <span className="text-xs text-slate-500 font-normal hidden sm:inline">{badge}</span>}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 group-hover:text-slate-600 ${open ? "rotate-180" : "rotate-0"}`}
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
};

export function ProductFormFields({
  brands,
  types,
  suppliers = [],
  form,
  setForm,
  cloudinaryKind = "product",
  canEditPrice = true,
  canEditStockLocation = false,
  canEditProductRegion = false,
  currentProductId,
}: Props) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDialog, setAiDialog] = useState<"missing_name" | "replace_description" | "error" | null>(null);
  const [aiError, setAiError] = useState("");
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [dimsBusy, setDimsBusy] = useState(false);
  const [dimsNotice, setDimsNotice] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  const [indoorDup, setIndoorDup] = useState<SerialMatch[]>([]);
  const [outdoorDup, setOutdoorDup] = useState<SerialMatch[]>([]);
  const debouncedIndoor = useDebounce(form.indoorUnitSerial.trim(), 350);
  const debouncedOutdoor = useDebounce(form.outdoorUnitSerial.trim(), 350);

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

  const setSpec = (k: keyof SpecsForm, v: string | boolean) =>
    setForm((f) => ({ ...f, specs: { ...f.specs, [k]: v } }));

  function generateSlugFromName() {
    const next = slugifyBg(form.name || "");
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

  async function onUploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const folderKey =
      form.slug.trim().length >= 2 ? form.slug.trim() : slugifyBg(form.name || "") || "product";
    if (folderKey.length < 2) {
      setUploadNotice("За качване са нужни мин. 2 знака slug или име, от което да се генерира папка.");
      e.target.value = "";
      return;
    }
    if (form.images.length >= MAX_PRODUCT_IMAGES) {
      setUploadNotice(`Максимум ${MAX_PRODUCT_IMAGES} снимки на продукт.`);
      e.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", cloudinaryKind);
    fd.append("slug", folderKey);
    const res = await fetch("/api/admin/uploads/image", { method: "POST", credentials: "include", body: fd });
    const json = await res.json();
    if (!res.ok) {
      setUploadNotice(json.error || "Качването се провали");
      return;
    }
    const url = json.data?.url as string;
    if (!url) return;
    setForm((f) => ({
      ...f,
      images: [...f.images, { url, sort_order: f.images.length, is_main: f.images.length === 0 }],
    }));
    e.target.value = "";
  }

  return (
    <div className="grid gap-6">
      <datalist id="energy-class-options">{ENERGY_CLASS_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="refrigerant-options">{REFRIGERANT_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="warranty-months-options">{WARRANTY_MONTHS_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="coverage-m2-options">{COVERAGE_M2_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="noise-db-options">{NOISE_DB_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="cooling-kw-options">{COOLING_KW_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="heating-kw-options">{HEATING_KW_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>

      <div className="grid gap-4">
        <label className="block">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Slug (по избор)</div>
            <Button type="button" variant="secondary" size="sm" onClick={generateSlugFromName} title="Генерирай slug от името" className="!py-1 !px-2.5 !text-xs gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> Генерирай
            </Button>
          </div>
          <div className="text-[11px] text-slate-500 mb-1.5">
            Не е задължителен. Публичната страница работи и с ID. Ползва се за папка при качване на снимки, ако е поне 2 знака.
          </div>
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="по избор — латиница" />
        </label>

        <label className="block">
          <FieldTitle label="Име" info="Показваното име за клиента (може да е дълго и с интервали/кирилица). Може да се редактира свободно без да чупи папки/URL." />
          <Input
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((prev) => {
                if (prev.slug.trim().length >= 2) return { ...prev, name };
                const nextSlug = slugifyBg(name);
                return { ...prev, name, slug: nextSlug.length >= 2 ? nextSlug : prev.slug };
              });
            }}
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between gap-3">
            <FieldTitle label="Описание" info="Кратко описание/текст за продукта. Показва се на детайлната страница." />
            <Button type="button" variant="secondary" size="sm" onClick={requestAiDraft} disabled={aiBusy} className="mb-1 gap-1.5 whitespace-nowrap">
              <Wand2 className="w-3.5 h-3.5" /> {aiBusy ? "AI..." : "AI чернова"}
            </Button>
          </div>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <FieldTitle label="Марка" info="Производител/бранда на уреда (Daikin, Mitsubishi и т.н.)." />
            <Select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <FieldTitle label="Тип" info="Тип продукт (стенен, мулти-сплит, касетъчен и т.н.). Ползва се за филтри и групиране." />
            <Select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </label>
        </div>

        <label className="block">
          <FieldTitle label="Състояние" info="Основна подкатегория за климатици: Нови или Втора употреба." />
          <Select value={form.productCondition} onChange={(e) => setForm({ ...form, productCondition: e.target.value as AdminProductForm["productCondition"] })}>
            <option value="new">Нови</option>
            <option value="used">Втора употреба</option>
          </Select>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <FieldTitle label="Цена (EUR)" info="Цена на уреда (без монтаж), в евро." />
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
            <FieldTitle label="Цена с монтаж (EUR)" info="Продажна цена с включен стандартен монтаж. Полето „Цена (EUR)“ е без монтаж." />
            <div className="relative">
              <Input
                value={form.priceWithMount}
                onChange={(e) => canEditPrice && setForm({ ...form, priceWithMount: e.target.value })}
                placeholder="по избор"
                disabled={!canEditPrice}
                className={!canEditPrice ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}
              />
              {!canEditPrice && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">🔒</span>
              )}
            </div>
          </label>
        </div>

        <CollapsibleSection title="Серийни номера и доставчик" badge="вътрешен запис, не се показва публично">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <FieldTitle label="Серия вътрешно тяло" info="Уникален сериен номер от табелката на вътрешното тяло. Системата проверява за дублирани с други продукти." />
              <Input
                value={form.indoorUnitSerial}
                onChange={(e) => setForm({ ...form, indoorUnitSerial: e.target.value })}
                placeholder="напр. T000532"
                className={indoorDup.length > 0 ? "border-amber-400 focus:ring-amber-400" : ""}
              />
              <SerialDuplicateNotice matches={indoorDup} label="вътрешно" />
            </label>
            <label className="block">
              <FieldTitle label="Серия външно тяло" info="Уникален сериен номер от табелката на външното тяло. Системата проверява за дублирани с други продукти." />
              <Input
                value={form.outdoorUnitSerial}
                onChange={(e) => setForm({ ...form, outdoorUnitSerial: e.target.value })}
                placeholder="напр. T001024"
                className={outdoorDup.length > 0 ? "border-amber-400 focus:ring-amber-400" : ""}
              />
              <SerialDuplicateNotice matches={outdoorDup} label="външно" />
            </label>
            <label className="block md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <FieldTitle label="Доставчик" info="Избира се от контакти с тип „доставчик“. Ако нужният липсва — създайте го в Контакти." />
                <Link
                  href="/admin/contacts?kind=supplier"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue-700 hover:text-brand-blue-900"
                  title="Отвори списък с доставчици"
                >
                  Управление на доставчици <ExternalLink className="w-3 h-3" />
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
                  Все още няма създадени доставчици. Отворете „Контакти“ и създайте контакт с тип „доставчик“.
                </div>
              )}
            </label>
            <label className="block">
              <FieldTitle label="Закупено на" info="Дата на покупка от доставчик (YYYY-MM-DD)." />
              <Input type="date" value={form.purchasedAt} onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })} />
            </label>
            <label className="block">
              <FieldTitle label="Фактура № (доставчик)" info="Номер на фактура от доставчика." />
              <Input value={form.supplierInvoiceNumber} onChange={(e) => setForm({ ...form, supplierInvoiceNumber: e.target.value })} placeholder="напр. 0000123456" />
            </label>
            <label className="block md:col-span-2">
              <FieldTitle label="Закупна цена (EUR)" info="Цена, на която сте взели уреда от доставчик (не е продажната цена). Само главен администратор." />
              <Input
                value={form.purchasePrice}
                onChange={(e) => canEditPrice && setForm({ ...form, purchasePrice: e.target.value })}
                placeholder="по избор"
                disabled={!canEditPrice}
                className={!canEditPrice ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}
              />
              {!canEditPrice && (
                <div className="text-[11px] text-slate-500 mt-1">🔒 Редакция: само главен администратор.</div>
              )}
            </label>
          </div>
        </CollapsibleSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <FieldTitle label="Каталог (статус)" info="Видимост в онлайн каталог: в наличност / изчерпан / по поръчка." />
            <Select value={form.stockStatus} onChange={(e) => setForm({ ...form, stockStatus: e.target.value as AdminProductForm["stockStatus"] })}>
              <option value="in_stock">В наличност</option>
              <option value="out_of_stock">Изчерпан</option>
              <option value="on_order">По поръчка</option>
            </Select>
          </label>
          <label className="block">
            <FieldTitle label="Количество (бр.)" info="Брой налични бройки (по избор). Полезно за вътрешен контрол." />
            <Input type="number" min={0} value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: Math.max(0, Number(e.target.value)) })} />
          </label>
          <label className="block md:col-span-2">
            <FieldTitle
              label="Местоположение"
              info="Физически: в магазина (витрина) или в склада. Показва се в колоната „Наличност“ в списъка с продукти."
            />
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
              <div className="text-[11px] text-slate-500 mt-1">Промяна на магазин/склад: главен администратор или офис служител.</div>
            )}
          </label>
          <label className="block md:col-span-2">
            <FieldTitle label="Страна (произход)" info="EUROPE или JAPAN — пазар/произход на модела." />
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
              <div className="text-[11px] text-slate-500 mt-1">Промяна: главен администратор или офис служител.</div>
            )}
          </label>
        </div>

        <div className="flex flex-wrap gap-3 mt-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
            <span className="text-sm font-semibold text-slate-700">Избран <span className="text-slate-400 font-normal">(за витрина/подчертаване)</span></span>
          </label>
        </div>
      </div>

      <CollapsibleSection title="Технически данни" badge="Остави празно поле, ако нямаш надеждна стойност">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <FieldTitle label="Площ (м²)" info="Препоръчителна квадратура/покритие на помещението (по спецификация)." />
            <Input value={form.specs.coverage_m2} onChange={(e) => setSpec("coverage_m2", e.target.value)} list="coverage-m2-options" placeholder="25" />
          </label>
          <label className="block">
            <FieldTitle label="Шум (dB)" info="Ниво на шум (обикновено вътрешно тяло), в децибели. По-ниско = по-тих." />
            <Input value={form.specs.noise_db} onChange={(e) => setSpec("noise_db", e.target.value)} list="noise-db-options" placeholder="19" />
          </label>
          <label className="block">
            <FieldTitle label="Охлаждане (kW)" info="Номинална охладителна мощност в kW (по спецификация)." />
            <Input value={form.specs.cooling_power_kw} onChange={(e) => setSpec("cooling_power_kw", e.target.value)} list="cooling-kw-options" placeholder="2.5" />
          </label>
          <label className="block">
            <FieldTitle label="Отопление (kW)" info="Номинална отоплителна мощност в kW (по спецификация)." />
            <Input value={form.specs.heating_power_kw} onChange={(e) => setSpec("heating_power_kw", e.target.value)} list="heating-kw-options" placeholder="3.2" />
          </label>
          <label className="block">
            <FieldTitle label="Хладилен агент" info="Тип хладилен агент (напр. R-32). Взима се от табелката/документацията." />
            <Input value={form.specs.refrigerant} onChange={(e) => setSpec("refrigerant", e.target.value)} list="refrigerant-options" placeholder="R-32" />
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer md:mt-7">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500" checked={form.specs.wifi} onChange={(e) => setSpec("wifi", e.target.checked)} />
            <span className="text-sm font-semibold text-slate-700">WiFi <span className="text-slate-400 font-normal">(вграден модул/управление)</span></span>
          </label>
          <label className="block">
            <FieldTitle label="Енергиен клас (охлаждане)" info="Енергиен клас при охлаждане (напр. A+++). Ползва се и в каталога." />
            <Input value={form.specs.energy_class_cool} onChange={(e) => setSpec("energy_class_cool", e.target.value)} list="energy-class-options" placeholder="A+++" />
          </label>
          <label className="block">
            <FieldTitle label="Енергиен клас (отопление)" info="Енергиен клас при отопление (напр. A++)." />
            <Input value={form.specs.energy_class_heat} onChange={(e) => setSpec("energy_class_heat", e.target.value)} list="energy-class-options" placeholder="A++" />
          </label>
          <label className="block">
            <FieldTitle label="SEER" info="Сезонна ефективност при охлаждане. По-висока стойност = по-икономичен режим." />
            <Input value={form.specs.seer} onChange={(e) => setSpec("seer", e.target.value)} />
          </label>
          <label className="block">
            <FieldTitle label="SCOP" info="Сезонна ефективност при отопление. По-висока стойност = по-икономичен режим." />
            <Input value={form.specs.scop} onChange={(e) => setSpec("scop", e.target.value)} />
          </label>
          <label className="block">
            <FieldTitle label="Гаранция (месеци)" info="Гаранционен срок в месеци (по избор). Пример: 36 = 3 години." />
            <Input value={form.specs.warranty_months} onChange={(e) => setSpec("warranty_months", e.target.value)} list="warranty-months-options" placeholder="36" />
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

        <div className="space-y-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand-blue-700 mb-2">Вътрешен блок</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="block">
                <FieldTitle label="Тегло (kg)" info="Тегло на вътрешния блок в килограми." />
                <Input value={form.specs.weight_indoor_kg} onChange={(e) => setSpec("weight_indoor_kg", e.target.value)} placeholder="24.0" inputMode="decimal" />
              </label>
              <label className="block">
                <FieldTitle label="Дължина (mm)" info="Дължина на вътрешния блок в милиметри." />
                <Input value={form.specs.dim_indoor_length_mm} onChange={(e) => setSpec("dim_indoor_length_mm", e.target.value)} placeholder="840" inputMode="numeric" />
              </label>
              <label className="block">
                <FieldTitle label="Ширина (mm)" info="Ширина (дълбочина) на вътрешния блок в милиметри." />
                <Input value={form.specs.dim_indoor_width_mm} onChange={(e) => setSpec("dim_indoor_width_mm", e.target.value)} placeholder="840" inputMode="numeric" />
              </label>
              <label className="block">
                <FieldTitle label="Височина (mm)" info="Височина на вътрешния блок в милиметри." />
                <Input value={form.specs.dim_indoor_height_mm} onChange={(e) => setSpec("dim_indoor_height_mm", e.target.value)} placeholder="298" inputMode="numeric" />
              </label>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-brand-orange-700 mb-2">Външен блок</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="block">
                <FieldTitle label="Тегло (kg)" info="Тегло на външния блок в килограми." />
                <Input value={form.specs.weight_outdoor_kg} onChange={(e) => setSpec("weight_outdoor_kg", e.target.value)} placeholder="134.0" inputMode="decimal" />
              </label>
              <label className="block">
                <FieldTitle label="Дължина (mm)" info="Дължина на външния блок в милиметри." />
                <Input value={form.specs.dim_outdoor_length_mm} onChange={(e) => setSpec("dim_outdoor_length_mm", e.target.value)} placeholder="950" inputMode="numeric" />
              </label>
              <label className="block">
                <FieldTitle label="Ширина (mm)" info="Ширина (дълбочина) на външния блок в милиметри." />
                <Input value={form.specs.dim_outdoor_width_mm} onChange={(e) => setSpec("dim_outdoor_width_mm", e.target.value)} placeholder="330" inputMode="numeric" />
              </label>
              <label className="block">
                <FieldTitle label="Височина (mm)" info="Височина на външния блок в милиметри." />
                <Input value={form.specs.dim_outdoor_height_mm} onChange={(e) => setSpec("dim_outdoor_height_mm", e.target.value)} placeholder="1350" inputMode="numeric" />
              </label>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={`Снимки (до ${MAX_PRODUCT_IMAGES}, Cloudinary)`} badge={`smolyanklima/${cloudinaryKind === "accessory" ? "aksesoari" : "klimatici"}/<slug>/`}>
        <p className="text-xs text-slate-500 mb-4 -mt-1">
          Всяка снимка се качва в отделна папка по slug. В базата се пази само URL.
        </p>
        
        <div className="mb-4">
          <FieldTitle label="Качи файл (изисква попълнен slug)" info="Качва снимка в Cloudinary в папка по slug. Първата снимка по подразбиране става главна." />
          <div className="relative">
            <input type="file" accept="image/*" onChange={onUploadFile} disabled={form.images.length >= MAX_PRODUCT_IMAGES} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
            <div className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-xl text-sm font-semibold transition-colors ${form.images.length >= MAX_PRODUCT_IMAGES ? "border-slate-200 bg-slate-50 text-slate-400" : "border-brand-blue-200 bg-brand-blue-50 text-brand-blue-600 hover:bg-brand-blue-100 hover:border-brand-blue-300"}`}>
              <Upload className="w-4 h-4" />
              {form.images.length >= MAX_PRODUCT_IMAGES ? "Достигнат лимит от снимки" : "Кликни или пусни файл тук"}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {form.images.map((im, idx) => (
            <div key={`${im.url}-${idx}`} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <Input
                value={im.url}
                onChange={(e) => {
                  const images = [...form.images];
                  images[idx] = { ...images[idx], url: e.target.value };
                  setForm({ ...form, images });
                }}
                placeholder="URL"
                title="URL към снимката (обикновено Cloudinary). Може да добавите ръчно URL или чрез качване."
                className="flex-1"
              />
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 whitespace-nowrap">
                <input type="radio" name="mainimg" className="w-4 h-4 text-brand-blue-500 focus:ring-brand-blue-500 border-slate-300" checked={im.is_main} onChange={() => {
                  setForm({
                    ...form,
                    images: form.images.map((row, i) => ({ ...row, is_main: i === idx })),
                  });
                }} />
                Главна
              </label>
              <Button variant="danger" size="sm" className="w-full sm:w-auto gap-1.5" onClick={() => setForm({ ...form, images: form.images.filter((_, i) => i !== idx) })}>
                <Trash2 className="w-4 h-4" /> Махни
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            disabled={form.images.length >= MAX_PRODUCT_IMAGES}
            onClick={() => setForm({ ...form, images: [...form.images, { url: "", sort_order: form.images.length, is_main: form.images.length === 0 }] })}
            title="Добавя нов ред за ръчно поставяне на URL към снимка."
            className="w-full gap-2 border-dashed border-2"
          >
            <Plus className="w-4 h-4" /> Добави ред с URL
          </Button>
        </div>
      </CollapsibleSection>

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

      {uploadNotice && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-slate-950/55 backdrop-blur-md"
          onClick={() => setUploadNotice(null)}
        >
          <div className="w-full md:max-w-lg overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.25)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e6f9fd_0,#ffffff_42%,#fff3ed_100%)] px-6 py-5">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue-700">Качване на снимка</div>
              <div className="mt-1 text-2xl font-black leading-tight text-slate-950">Нужно е действие</div>
            </div>
            <div className="p-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
                {uploadNotice}
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="secondary" onClick={() => setUploadNotice(null)}>Разбрах</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
