"use client";

/**
 * Combobox за поле „Марка" в ProductForm.
 *
 * Поведение:
 *   • Текстов input + dropdown с autocomplete от съществуващите марки.
 *   • Filtering в реално време по substring (case-insensitive).
 *   • Ако написаното НЕ съществува, последна опция е „+ Създай: <X>“,
 *     която прави POST към /api/admin/meta/brands и веднага избира
 *     новата марка.
 *   • Идемпотентно — ако друг админ е създал марката паралелно, бекендът
 *     връща съществуващия id (без дубликат).
 *
 * Защита от UX издънки:
 *   • При focus → отваря dropdown-а, дори input-ът е празен.
 *   • Click извън компонента → затваря dropdown-а БЕЗ да изтрива
 *     избора (selected stays).
 *   • Keyboard: ↑/↓ за навигация, Enter за избор, Esc за close.
 *   • При loading на „Създаване“ → input/dropdown disabled-нати.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";

export type BrandOption = { id: string; name: string };

type Props = {
  /** Списък на наличните марки (от parent — обикновено state). */
  brands: BrandOption[];
  /** Избран brand id („" = нищо избрано). */
  value: string;
  /** Сетва избрания brand id. */
  onChange: (brandId: string) => void;
  /** Callback при УСПЕШНО създаване на нова марка — parent-ът трябва да
   *  добави към `brands` списъка, иначе newly created brand ще изчезне
   *  при следващ render. */
  onBrandCreated?: (brand: BrandOption) => void;
  /** Highlight на AI-попълнено поле. */
  aiHighlighted?: boolean;
  /** Disabled. */
  disabled?: boolean;
  /** Placeholder в input-а. */
  placeholder?: string;
};

export function BrandCombobox({
  brands,
  value,
  onChange,
  onBrandCreated,
  aiHighlighted = false,
  disabled = false,
  placeholder = "Избери или напиши марка…",
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  /** Текст в input-а (search query). Различен е от selected name, защото
   *  потребителят може да филтрира без да е избрал нищо. */
  const [query, setQuery] = useState("");
  /** Active index в dropdown-а (за keyboard navigation). */
  const [activeIndex, setActiveIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === value) ?? null,
    [brands, value],
  );

  // При промяна на value отвън (напр. AI попълни марката) — синхронизираме
  // query-то да показва името. Това е важно при initial load на edit form.
  useEffect(() => {
    if (!open) setQuery(selectedBrand ? selectedBrand.name : "");
  }, [selectedBrand, open]);

  // Filter brands по query (case-insensitive substring).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  /** Дали трябва да покажем опцията „+ Създай“ — само когато няма точно
   *  съвпадение по име и query-то не е празно/невалидно. */
  const trimmedQuery = query.trim();
  const exactMatchExists = useMemo(
    () => brands.some((b) => b.name.trim().toLowerCase() === trimmedQuery.toLowerCase()),
    [brands, trimmedQuery],
  );
  const canCreate =
    trimmedQuery.length >= 2 &&
    /[A-Za-zА-Яа-я0-9]/.test(trimmedQuery) &&
    !exactMatchExists;

  // Items за keyboard nav = filtered brands + (евентуално) „+ Създай“ row.
  const items = useMemo(() => {
    const base: Array<
      { kind: "brand"; brand: BrandOption } | { kind: "create"; name: string }
    > = filtered.map((b) => ({ kind: "brand", brand: b }));
    if (canCreate) base.push({ kind: "create", name: trimmedQuery });
    return base;
  }, [filtered, canCreate, trimmedQuery]);

  // Reset active index when items change.
  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, open]);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selectedBrand ? selectedBrand.name : "");
        setError(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, selectedBrand]);

  const handleSelectBrand = useCallback(
    (brand: BrandOption) => {
      onChange(brand.id);
      setQuery(brand.name);
      setOpen(false);
      setError(null);
    },
    [onChange],
  );

  const handleCreateBrand = useCallback(
    async (name: string) => {
      if (creating) return;
      const clean = name.trim();
      if (clean.length < 2) {
        setError("Името на марката е твърде късо.");
        return;
      }
      setCreating(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/meta/brands", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: clean }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: BrandOption;
          error?: string;
        };
        if (!res.ok || !json.data) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        // Известяваме parent-а — той трябва да добави към brands списъка.
        onBrandCreated?.(json.data);
        // Изборът се прави едва след като знаем че парентът ще add-не.
        handleSelectBrand(json.data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Грешка при създаване на марка.");
      } finally {
        setCreating(false);
      }
    },
    [creating, handleSelectBrand, onBrandCreated],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[activeIndex];
      if (!it) return;
      if (it.kind === "brand") {
        handleSelectBrand(it.brand);
      } else {
        void handleCreateBrand(it.name);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery(selectedBrand ? selectedBrand.name : "");
    }
  }

  function handleClear() {
    onChange("");
    setQuery("");
    setOpen(true);
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const showValueChrome = !open && selectedBrand && query === selectedBrand.name;

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`relative flex items-center gap-1.5 rounded-lg border bg-white transition-colors ${
          aiHighlighted
            ? "border-emerald-300 bg-emerald-50/40"
            : open
              ? "border-brand-blue-400 ring-2 ring-brand-blue-100"
              : "border-slate-300 hover:border-slate-400"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {open ? (
          <Search className="ml-2 w-4 h-4 text-slate-400 shrink-0" />
        ) : selectedBrand ? (
          <Check className="ml-2 w-4 h-4 text-emerald-500 shrink-0" />
        ) : (
          <Search className="ml-2 w-4 h-4 text-slate-400 shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(null);
            // Ако потребителят изтрие написаното, изчиства и selection-а.
            if (!e.target.value.trim()) {
              onChange("");
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled || creating}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent px-1 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none disabled:cursor-not-allowed"
        />
        {creating && (
          <Loader2 className="w-4 h-4 text-brand-blue-500 animate-spin mr-1.5 shrink-0" />
        )}
        {!creating && showValueChrome && query.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            tabIndex={-1}
            className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Изчисти"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (disabled || creating) return;
            setOpen((o) => !o);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          tabIndex={-1}
          className="mr-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title={open ? "Затвори" : "Отвори списъка"}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mt-1 text-[11px] font-medium text-red-600">{error}</div>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5">
          {items.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-slate-500">
              {trimmedQuery
                ? `Няма марка „${trimmedQuery}“. Напиши поне 2 знака за да създадеш нова.`
                : "Няма налични марки. Напиши името на нова."}
            </div>
          ) : (
            <ul className="py-1" role="listbox">
              {items.map((it, idx) => {
                const isActive = idx === activeIndex;
                if (it.kind === "brand") {
                  const isSelected = it.brand.id === value;
                  return (
                    <li
                      key={it.brand.id}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectBrand(it.brand);
                      }}
                      className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer ${
                        isActive
                          ? "bg-brand-blue-50 text-brand-blue-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate font-medium">{it.brand.name}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-brand-blue-600 shrink-0" />
                      )}
                    </li>
                  );
                }
                return (
                  <li
                    key="create"
                    role="option"
                    aria-selected={false}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void handleCreateBrand(it.name);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 text-sm border-t border-slate-100 cursor-pointer ${
                      isActive
                        ? "bg-emerald-50 text-emerald-900"
                        : "text-emerald-800 hover:bg-emerald-50/70"
                    }`}
                  >
                    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                      <Plus className="w-3 h-3" />
                    </span>
                    <span className="truncate">
                      Създай нова марка: <strong>„{it.name}“</strong>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
