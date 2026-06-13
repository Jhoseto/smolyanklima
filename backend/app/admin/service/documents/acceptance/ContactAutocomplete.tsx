"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { UserSearch, X, ChevronDown, Phone, MapPin } from "lucide-react";

export interface ContactSuggestion {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface Props {
  value: string;
  onChange: (name: string, contact?: ContactSuggestion) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export function ContactAutocomplete({
  value,
  onChange,
  placeholder = "Иван Иванов",
  label,
  disabled,
}: Props) {
  const [query, setQuery]       = useState(value);
  const [results, setResults]   = useState<ContactSuggestion[]>([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(false);
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
        `/api/admin/contacts?q=${encodeURIComponent(q)}&kind=client&perPage=8`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const json = await res.json() as { data?: ContactSuggestion[] };
      const list = json.data ?? [];
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

  const handleSelect = (c: ContactSuggestion) => {
    setQuery(c.full_name);
    setSelected(true);
    setOpen(false);
    onChange(c.full_name, c);
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
        <UserSearch className="absolute left-0 bottom-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
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
          className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-64 overflow-y-auto"
        >
          {results.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(c); }}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 border-b border-slate-50 last:border-b-0"
            >
              <p className="text-sm font-semibold text-slate-800 truncate">{c.full_name}</p>
              <div className="flex gap-3 mt-0.5">
                {c.phone && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Phone className="w-3 h-3" />{c.phone}
                  </span>
                )}
                {c.address && (
                  <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-[180px]">
                    <MapPin className="w-3 h-3" />{c.address}
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
