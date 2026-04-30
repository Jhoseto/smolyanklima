"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";

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
  oldPrice: string;
  isActive: boolean;
  isFeatured: boolean;
  stockStatus: "in_stock" | "out_of_stock" | "on_order";
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
    oldPrice: "",
    isActive: true,
    isFeatured: false,
    stockStatus: "in_stock",
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
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sht",
    ъ: "a",
    ь: "",
    ю: "yu",
    я: "ya",
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

function InfoBadge({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 999,
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
        color: "#111827",
        fontSize: 12,
        fontWeight: 900,
        cursor: "help",
        position: "relative",
        userSelect: "none",
      }}
      tabIndex={0}
      aria-label="Информация"
      title={text}
    >
      i
    </span>
  );
}

function FieldTitle({ label, info }: { label: string; info: string }) {
  return (
    <div style={{ ...lab, display: "flex", alignItems: "center", gap: 8 }}>
      {label} <InfoBadge text={info} />
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
  };
}

export function buildPostBody(form: AdminProductForm) {
  const pwm = strNum(form.priceWithMount);
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    brandId: form.brandId,
    typeId: form.typeId,
    productCondition: form.productCondition,
    description: form.description.trim() || undefined,
    price: Number(form.price),
    priceWithMount: pwm ?? undefined,
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    stockStatus: form.stockStatus,
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
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    brandId: form.brandId,
    typeId: form.typeId,
    productCondition: form.productCondition,
    description: form.description.trim() || null,
    price: Number(form.price),
    priceWithMount: pwm,
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    stockStatus: form.stockStatus,
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
  slug: string;
  name: string;
  brand_id: string;
  type_id: string;
  product_condition?: "new" | "used";
  description?: string | null;
  price: number;
  price_with_mount?: number | null;
  old_price?: number | null;
  is_active: boolean;
  is_featured: boolean;
  stock_status?: string;
  stock_quantity?: number;
  product_specs?: Record<string, unknown> | null;
  product_images?: Array<{ url: string; sort_order: number; is_main: boolean }>;
}): AdminProductForm {
  const sp = p.product_specs;
  const n = (v: unknown) => (v != null && v !== "" ? String(v) : "");
  return {
    slug: p.slug,
    name: p.name,
    brandId: p.brand_id,
    typeId: p.type_id,
    productCondition: p.product_condition === "used" ? "used" : "new",
    description: p.description ?? "",
    price: Number(p.price),
    priceWithMount: p.price_with_mount != null ? String(p.price_with_mount) : "",
    oldPrice: p.old_price != null ? String(p.old_price) : "",
    isActive: Boolean(p.is_active),
    isFeatured: Boolean(p.is_featured),
    stockStatus:
      p.stock_status === "out_of_stock" || p.stock_status === "on_order" ? p.stock_status : "in_stock",
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

const inp = { width: "100%" as const, padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 };
const lab = { fontSize: 12, fontWeight: 700 as const, marginBottom: 4 };

type Props = {
  brands: { id: string; name: string }[];
  types: { id: string; name: string }[];
  form: AdminProductForm;
  setForm: Dispatch<SetStateAction<AdminProductForm>>;
  /** Папка в Cloudinary: `smolyanklima/klimatici/...` или `smolyanklima/aksesoari/...` */
  cloudinaryKind?: "product" | "accessory";
};

export function ProductFormFields({ brands, types, form, setForm, cloudinaryKind = "product" }: Props) {
  const setSpec = (k: keyof SpecsForm, v: string | boolean) =>
    setForm((f) => ({ ...f, specs: { ...f.specs, [k]: v } }));

  function generateSlugFromName() {
    const next = slugifyBg(form.name || "");
    if (next.length >= 2) setForm((f) => ({ ...f, slug: next }));
  }

  async function onUploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const slug = form.slug.trim();
    if (slug.length < 2) {
      alert("Попълнете slug (мин. 2 знака). Под него в Cloudinary се създава отделна папка за снимките на този продукт.");
      e.target.value = "";
      return;
    }
    if (form.images.length >= MAX_PRODUCT_IMAGES) {
      alert(`Максимум ${MAX_PRODUCT_IMAGES} снимки на продукт.`);
      e.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", cloudinaryKind);
    fd.append("slug", slug);
    const res = await fetch("/api/admin/uploads/image", { method: "POST", credentials: "include", body: fd });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Качването се провали");
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
    <div style={{ display: "grid", gap: 12 }}>
      {/* Suggestions (dropdown while keeping manual typing) */}
      <datalist id="energy-class-options">
        {ENERGY_CLASS_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="refrigerant-options">
        {REFRIGERANT_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="warranty-months-options">
        {WARRANTY_MONTHS_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="coverage-m2-options">
        {COVERAGE_M2_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="noise-db-options">
        {NOISE_DB_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="cooling-kw-options">
        {COOLING_KW_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="heating-kw-options">
        {HEATING_KW_OPTIONS.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <label>
        <div style={{ ...lab, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            Slug{" "}
            <InfoBadge text="Slug = технически идентификатор (уникален). Ползва се за URL и за папката на снимките в Cloudinary: smolyanklima/klimatici/<slug>/. Обикновено не се променя често." />
          </span>
          <button
            type="button"
            onClick={generateSlugFromName}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
            title="Генерирай slug от името"
          >
            Генерирай
          </button>
        </div>
        <input
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          placeholder="napr. daikin-perfera-ftxm25r"
          style={inp}
        />
      </label>
      <label>
        <FieldTitle
          label="Име"
          info="Показваното име за клиента (може да е дълго и с интервали/кирилица). Може да се редактира свободно без да чупи папки/URL."
        />
        <input
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((prev) => {
              if (prev.slug.trim().length >= 2) return { ...prev, name };
              const nextSlug = slugifyBg(name);
              return { ...prev, name, slug: nextSlug.length >= 2 ? nextSlug : prev.slug };
            });
          }}
          style={inp}
        />
      </label>
      <label>
        <FieldTitle label="Описание" info="Кратко описание/текст за продукта. Показва се на детайлната страница." />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={5}
          style={{ ...inp, resize: "vertical" }}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>
          <FieldTitle label="Марка" info="Производител/бранда на уреда (Daikin, Mitsubishi и т.н.)." />
          <select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })} style={inp}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <FieldTitle label="Тип" info="Тип продукт (стенен, мулти-сплит, касетъчен и т.н.). Ползва се за филтри и групиране." />
          <select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })} style={inp}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <FieldTitle label="Състояние" info="Основна подкатегория за климатици: Нови или Втора употреба." />
        <select
          value={form.productCondition}
          onChange={(e) => setForm({ ...form, productCondition: e.target.value as AdminProductForm["productCondition"] })}
          style={inp}
        >
          <option value="new">Нови</option>
          <option value="used">Втора употреба</option>
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <label>
          <FieldTitle label="Цена (EUR)" info="Цена на уреда (без монтаж), в евро." />
          <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} style={inp} />
        </label>
        <label>
          <FieldTitle label="Цена с монтаж" info="Цена с включен стандартен монтаж (по избор). Ако е празно, системата може да изчислява ориентировъчно." />
          <input value={form.priceWithMount} onChange={(e) => setForm({ ...form, priceWithMount: e.target.value })} placeholder="по избор" style={inp} />
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>
          <FieldTitle label="Наличност" info="Статус на наличност: в наличност / изчерпан / по поръчка." />
          <select value={form.stockStatus} onChange={(e) => setForm({ ...form, stockStatus: e.target.value as AdminProductForm["stockStatus"] })} style={inp}>
            <option value="in_stock">В наличност</option>
            <option value="out_of_stock">Изчерпан</option>
            <option value="on_order">По поръчка</option>
          </select>
        </label>
        <label>
          <FieldTitle label="Количество (бр.)" info="Брой налични бройки (по избор). Полезно за вътрешен контрол." />
          <input type="number" min={0} value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: Math.max(0, Number(e.target.value)) })} style={inp} />
        </label>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          Активен <InfoBadge text="Ако е изключено, продуктът няма да се показва публично в каталога." />
        </span>
      </label>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          Избран <InfoBadge text="Маркира продукта като специален/препоръчан (ползва се за витрини/секции по избор)." />
        </span>
      </label>

      <h2 style={{ fontSize: 14, fontWeight: 900, margin: "8px 0 0" }}>Технически данни</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>
          <FieldTitle label="Площ (м²)" info="Препоръчителна квадратура/покритие на помещението (по спецификация)." />
          <input
            value={form.specs.coverage_m2}
            onChange={(e) => setSpec("coverage_m2", e.target.value)}
            list="coverage-m2-options"
            placeholder="25"
            style={inp}
          />
        </label>
        <label>
          <FieldTitle label="Шум (dB)" info="Ниво на шум (обикновено вътрешно тяло), в децибели. По-ниско = по-тих." />
          <input
            value={form.specs.noise_db}
            onChange={(e) => setSpec("noise_db", e.target.value)}
            list="noise-db-options"
            placeholder="19"
            style={inp}
          />
        </label>
        <label>
          <FieldTitle label="Охлаждане (kW)" info="Номинална охладителна мощност в kW (по спецификация)." />
          <input
            value={form.specs.cooling_power_kw}
            onChange={(e) => setSpec("cooling_power_kw", e.target.value)}
            list="cooling-kw-options"
            placeholder="2.5"
            style={inp}
          />
        </label>
        <label>
          <FieldTitle label="Отопление (kW)" info="Номинална отоплителна мощност в kW (по спецификация)." />
          <input
            value={form.specs.heating_power_kw}
            onChange={(e) => setSpec("heating_power_kw", e.target.value)}
            list="heating-kw-options"
            placeholder="3.2"
            style={inp}
          />
        </label>
        <label>
          <FieldTitle label="Хладилен агент" info="Тип хладилен агент (напр. R-32). Взима се от табелката/документацията." />
          <input
            value={form.specs.refrigerant}
            onChange={(e) => setSpec("refrigerant", e.target.value)}
            list="refrigerant-options"
            placeholder="R-32"
            style={inp}
          />
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
          <input type="checkbox" checked={form.specs.wifi} onChange={(e) => setSpec("wifi", e.target.checked)} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            WiFi <InfoBadge text="Отбележете дали моделът има вграден WiFi модул/управление." />
          </span>
        </label>
        <label>
          <FieldTitle label="Енергиен клас (охлаждане)" info="Енергиен клас при охлаждане (напр. A+++). Ползва се и в каталога." />
          <input
            value={form.specs.energy_class_cool}
            onChange={(e) => setSpec("energy_class_cool", e.target.value)}
            list="energy-class-options"
            placeholder="A+++"
            style={inp}
          />
        </label>
        <label>
          <FieldTitle label="Енергиен клас (отопление)" info="Енергиен клас при отопление (напр. A++)." />
          <input
            value={form.specs.energy_class_heat}
            onChange={(e) => setSpec("energy_class_heat", e.target.value)}
            list="energy-class-options"
            placeholder="A++"
            style={inp}
          />
        </label>
        <label>
          <div style={{ ...lab, display: "flex", alignItems: "center", gap: 8 }}>
            SEER{" "}
            <InfoBadge text="SEER (Seasonal Energy Efficiency Ratio) — сезонна ефективност при охлаждане. Колкото е по-висок, толкова по-икономично охлажда през сезона. Ако не сте сигурни, оставете празно." />
          </div>
          <input value={form.specs.seer} onChange={(e) => setSpec("seer", e.target.value)} style={inp} />
        </label>
        <label>
          <div style={{ ...lab, display: "flex", alignItems: "center", gap: 8 }}>
            SCOP{" "}
            <InfoBadge text="SCOP (Seasonal Coefficient of Performance) — сезонна ефективност при отопление. Колкото е по-висок, толкова по-икономично отоплява през сезона. Ако не сте сигурни, оставете празно." />
          </div>
          <input value={form.specs.scop} onChange={(e) => setSpec("scop", e.target.value)} style={inp} />
        </label>
        <label>
          <FieldTitle label="Гаранция (месеци)" info="Гаранционен срок в месеци (по избор). Пример: 36 = 3 години." />
          <input
            value={form.specs.warranty_months}
            onChange={(e) => setSpec("warranty_months", e.target.value)}
            list="warranty-months-options"
            placeholder="36"
            style={inp}
          />
        </label>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 900, margin: "8px 0 0" }}>Снимки (до {MAX_PRODUCT_IMAGES}, Cloudinary)</h2>
      <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
        Всяка снимка се качва в отделна папка по slug: <code>smolyanklima/{cloudinaryKind === "accessory" ? "aksesoari" : "klimatici"}/&lt;slug&gt;/</code>. В базата се пази само URL.
      </p>
      <label>
        <FieldTitle
          label="Качи файл (изисква попълнен slug)"
          info="Качва снимка в Cloudinary в папка по slug. Първата снимка по подразбиране става главна."
        />
        <input type="file" accept="image/*" onChange={onUploadFile} disabled={form.images.length >= MAX_PRODUCT_IMAGES} />
      </label>
      <div style={{ display: "grid", gap: 8 }}>
        {form.images.map((im, idx) => (
          <div key={`${im.url}-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
            <input
              value={im.url}
              onChange={(e) => {
                const images = [...form.images];
                images[idx] = { ...images[idx], url: e.target.value };
                setForm({ ...form, images });
              }}
              placeholder="URL"
              title="URL към снимката (обикновено Cloudinary). Може да добавите ръчно URL или чрез качване."
              style={inp}
            />
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, whiteSpace: "nowrap" }}>
              <input type="radio" name="mainimg" checked={im.is_main} onChange={() => {
                setForm({
                  ...form,
                  images: form.images.map((row, i) => ({ ...row, is_main: i === idx })),
                });
              }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Главна <InfoBadge text="Главната снимка се показва първа в каталога и детайлната страница." />
              </span>
            </label>
            <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, i) => i !== idx) })} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c", background: "#fff" }}>
              Махни
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={form.images.length >= MAX_PRODUCT_IMAGES}
          onClick={() =>
            setForm({
              ...form,
              images: [...form.images, { url: "", sort_order: form.images.length, is_main: form.images.length === 0 }],
            })
          }
          title="Добавя нов ред за ръчно поставяне на URL към снимка."
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            fontWeight: 700,
            opacity: form.images.length >= MAX_PRODUCT_IMAGES ? 0.5 : 1,
          }}
        >
          + Ред с URL
        </button>
      </div>
    </div>
  );
}
