"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, ChevronDown } from "lucide-react";

export interface ProductSuggestion {
  id: string;
  name: string;
  slug: string;
  model_number?: string | null;
  model_code?: string | null;
  brand_name?: string | null;
  brands?: { name?: string | null } | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
}

function brandFromProduct(p: ProductSuggestion): string {
  const nested = p.brands?.name?.trim();
  if (nested) return nested;
  return p.brand_name?.trim() ?? "";
}

/** Етикет за показване в полето: „Марка Модел“. */
export function productCatalogLabel(p: ProductSuggestion): string {
  const brand = brandFromProduct(p);
  const model = (p.model_code || p.model_number || "").trim();
  if (brand && model) return `${brand} ${model}`;
  if (brand && p.name) {
    if (p.name.toLowerCase().startsWith(brand.toLowerCase())) return p.name;
    return `${brand} ${p.name}`;
  }
  return p.name;
}

/** Разделя избор от каталога на ac_brand / ac_model. */
export function splitProductSelection(p: ProductSuggestion): { brand: string; model: string } {
  const brand = brandFromProduct(p);
  const modelCode = (p.model_code || p.model_number || "").trim();
  if (brand && modelCode) return { brand, model: modelCode };
  if (brand && p.name.toLowerCase().startsWith(brand.toLowerCase())) {
    return { brand, model: p.name.slice(brand.length).trim() || p.name };
  }
  if (brand) return { brand, model: p.name };
  return { brand: "", model: p.name };
}

function normalizeProductRow(raw: Record<string, unknown>): ProductSuggestion {
  const brands = raw.brands as ProductSuggestion["brands"] | undefined;
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    model_number: (raw.model_number as string | null | undefined) ?? null,
    model_code: (raw.model_code as string | null | undefined) ?? null,
    brand_name: brandFromProduct({
      id: "",
      name: "",
      slug: "",
      brands,
      brand_name: (raw.brand_name as string | null | undefined) ?? null,
    }) || null,
    brands: brands ?? null,
    indoor_unit_serial: (raw.indoor_unit_serial as string | null | undefined) ?? null,
    outdoor_unit_serial: (raw.outdoor_unit_serial as string | null | undefined) ?? null,
  };
}

interface Props {
  value: string;
  onChange: (name: string, product?: ProductSuggestion) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export function ProductAutocomplete({ value, onChange, placeholder = "Въведи или избери...", label, disabled }: Props) {
  const [query, setQuery]         = useState(value);
  const [results, setResults]     = useState<ProductSuggestion[]>([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) setQuery(value);
  }, [value, selected]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/products?q=${encodeURIComponent(q)}&perPage=10`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const json = await res.json() as { data?: Record<string, unknown>[] };
      const list = (json.data ?? []).map(normalizeProductRow);
      setResults(list);
      setOpen(list.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    setSelected(false);
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 280);
  };

  const handleSelect = (p: ProductSuggestion) => {
    const label = productCatalogLabel(p);
    setQuery(label);
    setSelected(true);
    setOpen(false);
    onChange(label, p);
  };

  const handleClear = () => {
    setQuery("");
    setSelected(false);
    setResults([]);
    setOpen(false);
    onChange("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative">
      {label && (
        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <Search className="absolute left-0 bottom-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => query && results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 pl-6 pr-8 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="absolute right-0 bottom-2 flex items-center gap-1">
          {loading && (
            <span className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          )}
          {query && !loading && !disabled && (
            <button type="button" onClick={handleClear} className="text-slate-400 active:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          )}
          {!query && <ChevronDown className="w-4 h-4 text-slate-300" />}
        </div>
      </div>

      {open && results.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-56 overflow-y-auto"
        >
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 border-b border-slate-50 last:border-b-0"
            >
              <p className="text-sm font-semibold text-slate-800 truncate">{productCatalogLabel(p)}</p>
              <div className="flex flex-wrap gap-2 mt-0.5">
                {brandFromProduct(p) && (
                  <span className="text-xs text-slate-500">{brandFromProduct(p)}</span>
                )}
                {(p.model_code || p.model_number) && (
                  <span className="text-xs text-slate-400">{p.model_code || p.model_number}</span>
                )}
                {(p.indoor_unit_serial || p.outdoor_unit_serial) && (
                  <span className="text-xs text-emerald-600 font-medium">
                    + серийни №
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
