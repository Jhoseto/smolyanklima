"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, ChevronDown } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  model_number?: string | null;
}

interface Props {
  value: string;
  onChange: (name: string, product?: Product) => void;
  placeholder?: string;
  label?: string;
}

export function ProductAutocomplete({ value, onChange, placeholder = "Въведи или избери...", label }: Props) {
  const [query, setQuery]         = useState(value);
  const [results, setResults]     = useState<Product[]>([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);

  // Синхронизирай query при промяна на prop
  useEffect(() => {
    if (!selected) setQuery(value);
  }, [value, selected]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/products?q=${encodeURIComponent(q)}&perPage=10`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const json = await res.json();
      setResults(json.data ?? []);
      setOpen((json.data?.length ?? 0) > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    setSelected(false);
    onChange(v);                  // обнови parent с текущия текст
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 280);
  };

  const handleSelect = (p: Product) => {
    setQuery(p.name);
    setSelected(true);
    setOpen(false);
    onChange(p.name, p);
  };

  const handleClear = () => {
    setQuery("");
    setSelected(false);
    setResults([]);
    setOpen(false);
    onChange("");
    inputRef.current?.focus();
  };

  // Затвори при клик извън
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
          onChange={e => handleInput(e.target.value)}
          onFocus={() => query && results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 pl-6 pr-8 bg-transparent"
        />
        <div className="absolute right-0 bottom-2 flex items-center gap-1">
          {loading && (
            <span className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          )}
          {query && !loading && (
            <button onClick={handleClear} className="text-slate-400 active:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          )}
          {!query && <ChevronDown className="w-4 h-4 text-slate-300" />}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-56 overflow-y-auto"
        >
          {results.map(p => (
            <button
              key={p.id}
              onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 border-b border-slate-50 last:border-b-0"
            >
              <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
              {p.model_number && (
                <p className="text-xs text-slate-400 mt-0.5">{p.model_number}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
