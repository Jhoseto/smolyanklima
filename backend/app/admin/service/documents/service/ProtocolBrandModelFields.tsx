"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { productStockLocationLabelCompact } from "@/lib/admin/productStockLocation";
import { productCatalogLabel, splitProductSelection, type ProductSuggestion } from "../acceptance/ProductAutocomplete";

type BrandOption = { id: string; name: string };
type UnitOption = ProductSuggestion & {
  stock_status?: string;
  stock_location?: string | null;
  container?: { name?: string | null } | null;
};

export interface ProtocolBrandModelValue {
  ac_brand: string;
  ac_model: string;
  product_id: string | null;
  indoor_unit_serial?: string;
  outdoor_unit_serial?: string;
}

interface Props {
  value: ProtocolBrandModelValue;
  disabled?: boolean;
  onChange: (next: ProtocolBrandModelValue) => void;
}

const PAGE_SIZE = 20;
const STOCK_LABELS: Record<string, string> = {
  in_stock: "Наличен", out_of_stock: "Продаден / изчерпан", reserved: "Резервиран",
  on_order: "По поръчка", scrapped: "Бракуван",
};

export function ProtocolBrandModelFields({ value, disabled, onChange }: Props) {
  const brandInputId = useId();
  const modelInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandError, setBrandError] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: UnitOption[]; total: number; error?: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadBrands() {
      try {
        const res = await fetch("/api/admin/meta/brands", { credentials: "include", signal: controller.signal });
        if (!res.ok) throw new Error();
        const json = await res.json() as { data?: BrandOption[] };
        if (!controller.signal.aborted) setBrands(json.data ?? []);
      } catch {
        if (!controller.signal.aborted) setBrandError("Марките не се заредиха. Можеш да търсиш по модел или сериен номер.");
      }
    }
    void loadBrands();
    return () => controller.abort();
  }, []);

  const selectedBrand = brands.find((brand) => brand.name === value.ac_brand);
  const params = new URLSearchParams({
    stockScope: "all", catalogKind: "climatics", page: String(page), perPage: String(PAGE_SIZE),
  });
  if (selectedBrand) params.set("brandId", selectedBrand.id);
  if (value.ac_model.trim()) params.set("q", value.ac_model.trim());
  const query = params.toString();

  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products?${query}`, { credentials: "include", signal: controller.signal });
        if (!res.ok) throw new Error();
        const json = await res.json() as { data: UnitOption[]; meta: { total: number } };
        if (!controller.signal.aborted) setResult({ key: query, rows: json.data, total: json.meta.total });
      } catch {
        if (!controller.signal.aborted) {
          setResult({ key: query, rows: [], total: 0, error: "Бройките не се заредиха." });
        }
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, disabled, retry]);

  function editModel(brand: string, model: string) {
    setPage(1);
    setOpen(true);
    onChange({
      ac_brand: brand, ac_model: model, product_id: null,
      ...(value.product_id ? { indoor_unit_serial: "", outdoor_unit_serial: "" } : {}),
    });
  }

  function selectUnit(unit: UnitOption) {
    const { brand, model } = splitProductSelection(unit);
    const keepEnteredSerials = !value.product_id || value.product_id === unit.id;
    setOpen(false);
    onChange({
      ac_brand: brand, ac_model: model, product_id: unit.id,
      indoor_unit_serial: unit.indoor_unit_serial?.trim() || (keepEnteredSerials ? value.indoor_unit_serial : "") || "",
      outdoor_unit_serial: unit.outdoor_unit_serial?.trim() || (keepEnteredSerials ? value.outdoor_unit_serial : "") || "",
    });
  }

  const current = result?.key === query ? result : null;
  const showSelectedUnit = value.product_id && (!open || disabled);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor={brandInputId} className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Марка</label>
        <div className="relative">
          <select id={brandInputId} value={value.ac_brand} disabled={disabled}
            onChange={(event) => { editModel(event.target.value, ""); inputRef.current?.focus(); }}
            className="w-full appearance-none px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400 disabled:opacity-60 pr-9"
          >
            <option value="">Всички марки</option>
            {value.ac_brand && !selectedBrand && <option value={value.ac_brand}>{value.ac_brand}</option>}
            {brands.map((brand) => <option key={brand.id} value={brand.name}>{brand.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
        {brandError && <p className="mt-1 text-xs text-red-600">{brandError}</p>}
      </div>

      <div className="relative" onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }} onKeyDown={(e) => { if (open && e.key === "Escape") { e.stopPropagation(); inputRef.current?.focus(); setOpen(false); } }}>
        <label htmlFor={modelInputId} className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Модел и бройка</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input ref={inputRef} id={modelInputId} type="text" value={value.ac_model} disabled={disabled}
            aria-describedby={showSelectedUnit ? `${modelInputId}-unit` : undefined}
            onChange={(e) => editModel(value.ac_brand, e.target.value)}
            onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
            placeholder="Търси модел или сериен №…" autoComplete="off"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400 disabled:opacity-60"
          />
        </div>
        {showSelectedUnit && (
          <p id={`${modelInputId}-unit`} className="mt-1 text-xs text-slate-600">
            Бройка {value.product_id?.slice(-8)}
          </p>
        )}
        {open && !disabled && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
            {!current ? (
              <p className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Зареждане…</p>
            ) : current.error ? (
              <div className="px-3 py-2 text-xs text-red-700">{current.error}{" "}
                <button type="button" className="underline" onClick={() => { setResult(null); setRetry(n => n + 1); }}>Опитай отново</button>
              </div>
            ) : current.rows.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">Няма съвпадения в каталога. Можеш да въведеш модела ръчно.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {current.rows.map(unit => (
                  <button key={unit.id} type="button" onClick={() => selectUnit(unit)}
                    className="w-full text-left px-3 py-2 hover:bg-brand-blue-50 focus:bg-brand-blue-50 border-b border-slate-100 last:border-0"
                  >
                    <span className="block text-sm font-semibold text-slate-800">{productCatalogLabel(unit)}</span>
                    <span className="block text-xs text-slate-600">
                      {[unit.indoor_unit_serial && `Вътр. № ${unit.indoor_unit_serial}`, unit.outdoor_unit_serial && `Външ. № ${unit.outdoor_unit_serial}`].filter(Boolean).join(" · ") || "Без сериен №"}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {[unit.stock_status && STOCK_LABELS[unit.stock_status], unit.stock_location && productStockLocationLabelCompact(unit.stock_location),
                        unit.container?.name, `Бройка ${unit.id.slice(-8)}`].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {current && !current.error && (page > 1 || current.total > PAGE_SIZE) && (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs">
                <button type="button" disabled={page === 1} onClick={() => { inputRef.current?.focus(); setPage(p => p - 1); }} className="text-brand-blue-700 disabled:text-slate-300">Предишни</button>
                <span className="text-slate-500">{page} / {Math.max(1, Math.ceil(current.total / PAGE_SIZE))}</span>
                <button type="button" disabled={page * PAGE_SIZE >= current.total} onClick={() => { inputRef.current?.focus(); setPage(p => p + 1); }} className="text-brand-blue-700 disabled:text-slate-300">Следващи</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
