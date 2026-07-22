"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, ChevronDown, Package } from "lucide-react";
import {
  buildSpecsFromProduct,
  resolveInstallPrice,
  type OfferSpecRow,
} from "@/lib/offers/buildSpecsFromProduct";

export type CatalogProductPick = {
  productId: string;
  name: string;
  brandName: string | null;
  typeName: string | null;
  modelCode: string | null;
  imageUrl: string | null;
  description: string | null;
  specs: OfferSpecRow[];
  unitPrice: number;
  installPrice: number;
};

type PublicListRow = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price?: number;
  price_with_mount?: number | null;
  model_code?: string | null;
  brands?: { name?: string } | null;
  product_types?: { name?: string } | null;
  product_specs?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  product_images?: Array<{ url: string; is_main?: boolean }>;
};

interface Props {
  onPick: (product: CatalogProductPick) => void;
  disabled?: boolean;
}

function firstSpec(specs: PublicListRow["product_specs"]): Record<string, unknown> | null {
  if (!specs) return null;
  if (Array.isArray(specs)) return (specs[0] as Record<string, unknown>) ?? null;
  return specs as Record<string, unknown>;
}

function toPick(p: PublicListRow): CatalogProductPick {
  const images = p.product_images ?? [];
  const main = images.find((i) => i.is_main) ?? images[0];
  const unitPrice = Number(p.price) || 0;
  return {
    productId: p.id,
    name: p.name,
    brandName: p.brands?.name ?? null,
    typeName: p.product_types?.name ?? null,
    modelCode: p.model_code ?? null,
    imageUrl: main?.url ?? null,
    description: p.description ?? null,
    specs: buildSpecsFromProduct(firstSpec(p.product_specs) as Parameters<typeof buildSpecsFromProduct>[0]),
    unitPrice,
    installPrice: resolveInstallPrice(p.price, p.price_with_mount),
  };
}

export function CatalogProductAutocomplete({ onPick, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicListRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      // Само видими в публичния каталог (is_active + show_in_public_catalog + наличност)
      const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&perPage=10`);
      if (!res.ok) return;
      const json = (await res.json()) as { data?: PublicListRow[] };
      const list = json.data ?? [];
      setResults(list);
      setOpen(list.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 280);
  };

  const handleSelect = async (row: PublicListRow) => {
    setFetchingDetail(true);
    setOpen(false);
    setQuery("");
    try {
      // Пълна продуктова страница — описание + specs + снимки
      const res = await fetch(`/api/products/${encodeURIComponent(row.slug || row.id)}`);
      if (res.ok) {
        const json = (await res.json()) as { data?: PublicListRow };
        if (json.data) {
          onPick(toPick(json.data));
          return;
        }
      }
      onPick(toPick(row));
    } catch {
      onPick(toPick(row));
    } finally {
      setFetchingDetail(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled || fetchingDetail}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => query && results.length > 0 && setOpen(true)}
          placeholder="Търси климатик от публичния каталог…"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 outline-none focus:border-brand-orange-500 focus:ring-2 focus:ring-brand-orange-500/20 disabled:opacity-50"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {(loading || fetchingDetail) && (
            <span className="h-3.5 w-3.5 border-2 border-slate-300 border-t-brand-orange-500 rounded-full animate-spin" />
          )}
          {query && !loading && !disabled && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setOpen(false);
              }}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {!query && !loading && <ChevronDown className="h-4 w-4 text-slate-300" />}
        </div>
      </div>

      {open && results.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => void handleSelect(r)}
              className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-brand-orange-50/60 border-b border-slate-50 last:border-0"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 overflow-hidden">
                {r.product_images?.[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.product_images[0].url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {r.brands?.name ? `${r.brands.name} ` : ""}
                  {r.model_code || r.name}
                </div>
                <div className="text-xs text-slate-500 truncate">{r.name}</div>
              </div>
              {r.price != null && (
                <div className="text-xs font-bold text-brand-orange-600 tabular-nums shrink-0">
                  €{Number(r.price).toLocaleString("bg-BG", { minimumFractionDigits: 2 })}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
