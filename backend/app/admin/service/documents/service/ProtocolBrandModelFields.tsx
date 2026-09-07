"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import {
  productCatalogLabel,
  splitProductSelection,
  type ProductSuggestion,
} from "../acceptance/ProductAutocomplete";

type BrandOption = { id: string; name: string };

export interface ProtocolBrandModelValue {
  ac_brand: string;
  ac_model: string;
  product_id: string | null;
  indoor_unit_serial?: string;
  outdoor_unit_serial?: string;
}

interface Props {
  value: Pick<ProtocolBrandModelValue, "ac_brand" | "ac_model">;
  disabled?: boolean;
  onChange: (next: ProtocolBrandModelValue) => void;
}

function normalizeProductRow(raw: Record<string, unknown>): ProductSuggestion {
  const brands = raw.brands as ProductSuggestion["brands"] | undefined;
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    model_number: (raw.model_number as string | null | undefined) ?? null,
    model_code: (raw.model_code as string | null | undefined) ?? null,
    brand_name: (brands?.name as string | null | undefined) ?? null,
    brands: brands ?? null,
    indoor_unit_serial: (raw.indoor_unit_serial as string | null | undefined) ?? null,
    outdoor_unit_serial: (raw.outdoor_unit_serial as string | null | undefined) ?? null,
  };
}

export function ProtocolBrandModelFields({ value, disabled, onChange }: Props) {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [modelQuery, setModelQuery] = useState(value.ac_model);
  const [modelResults, setModelResults] = useState<ProductSuggestion[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setModelQuery(value.ac_model);
  }, [value.ac_model]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBrandsLoading(true);
      try {
        const res = await fetch("/api/brands", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json() as { data?: BrandOption[] };
        if (!cancelled) setBrands(json.data ?? []);
      } finally {
        if (!cancelled) setBrandsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const brandId = brands.find(
    (b) => b.name.trim().toLowerCase() === value.ac_brand.trim().toLowerCase(),
  )?.id;

  const searchModels = useCallback(async (q: string) => {
    if (!q.trim()) {
      setModelResults([]);
      setModelOpen(false);
      return;
    }
    setModelLoading(true);
    try {
      const params = new URLSearchParams({ q, perPage: "12" });
      if (brandId) params.set("brandId", brandId);
      const res = await fetch(`/api/admin/products?${params}`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json() as { data?: Record<string, unknown>[] };
      const list = (json.data ?? []).map(normalizeProductRow);
      setModelResults(list);
      setModelOpen(list.length > 0);
    } finally {
      setModelLoading(false);
    }
  }, [brandId]);

  const handleBrandChange = (brandName: string) => {
    onChange({
      ac_brand: brandName,
      ac_model: value.ac_model,
      product_id: null,
    });
  };

  const handleModelInput = (v: string) => {
    setModelQuery(v);
    onChange({
      ac_brand: value.ac_brand,
      ac_model: v,
      product_id: null,
    });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchModels(v), 280);
  };

  const handleSelectProduct = (p: ProductSuggestion) => {
    const split = splitProductSelection(p);
    const label = productCatalogLabel(p);
    setModelQuery(split.model || label);
    setModelOpen(false);
    onChange({
      ac_brand: split.brand || value.ac_brand,
      ac_model: split.model || label,
      product_id: p.id,
      indoor_unit_serial: p.indoor_unit_serial?.trim() ?? undefined,
      outdoor_unit_serial: p.outdoor_unit_serial?.trim() ?? undefined,
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!modelWrapRef.current?.contains(e.target as Node)) setModelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Марка
        </label>
        <div className="relative">
          <select
            value={value.ac_brand}
            disabled={disabled || brandsLoading}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="w-full appearance-none px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400 disabled:opacity-60 disabled:cursor-not-allowed pr-9"
          >
            <option value="">— Избери марка —</option>
            {value.ac_brand &&
              !brands.some((b) => b.name.toLowerCase() === value.ac_brand.toLowerCase()) && (
              <option value={value.ac_brand}>{value.ac_brand} (legacy)</option>
            )}
            {brands.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          {brandsLoading && (
            <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
          )}
        </div>
      </div>

      <div ref={modelWrapRef} className="relative">
        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Модел
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={modelQuery}
            disabled={disabled}
            onChange={(e) => handleModelInput(e.target.value)}
            onFocus={() => modelQuery && modelResults.length > 0 && setModelOpen(true)}
            placeholder={value.ac_brand ? "Търси модел в каталога…" : "Първо избери марка"}
            autoComplete="off"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {modelLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
          )}
        </div>
        {modelOpen && modelResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {modelResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProduct(p)}
                className="w-full text-left px-3 py-2.5 hover:bg-brand-blue-50 border-b border-slate-100 last:border-0"
              >
                <div className="text-sm font-medium text-slate-800">{productCatalogLabel(p)}</div>
                {(p.indoor_unit_serial || p.outdoor_unit_serial) && (
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                    {[p.indoor_unit_serial, p.outdoor_unit_serial].filter(Boolean).join(" / ")}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
