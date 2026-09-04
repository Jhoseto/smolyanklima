"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, PackageSearch, Pencil } from "lucide-react";
import { productCatalogLabel, splitProductSelection, type ProductSuggestion } from "../acceptance/ProductAutocomplete";

type BatchRow = ProductSuggestion & {
  container_id?: string | null;
  container?: { name?: string | null } | null;
};

export interface RecycleBatchGroup {
  key: string;
  label: string;
  brand: string;
  model: string;
  containerName: string | null;
  count: number;
  /** Всички налични бройки в групата — взаимозаменяеми (без сериен №). */
  productIds: string[];
}

interface Props {
  /** Избран product_id (конкретна бройка, "заключена" за този протокол). */
  value: string | null;
  /** Показван текст за вече избрана бройка, ако вече не е между заредените (напр. финализирана). */
  currentLabel?: string;
  onChange: (productId: string | null, group?: RecycleBatchGroup) => void;
  disabled?: boolean;
}

/**
 * Избор на конкретна анонимна бройка от партида втора употреба (без сериен
 * номер, в наличност), за да се "заключи" за текущия сервизен протокол по
 * рециклиране. Групира резултатите по марка+модел+контейнер, за по-ясен
 * избор от служителя.
 */
export function RecycleBatchPicker({ value, currentLabel, onChange, disabled }: Props) {
  const [groups, setGroups]   = useState<RecycleBatchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // Ако вече има избрана бройка, показваме я "заключена" (без падащ списък),
  // за да не се "загуби" от изгледа, когато вече е финализирана (вече не е
  // в резултата "без сериен №"). Служителят може да натисне "Смени".
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetch(
        "/api/admin/products?condition=used&stockStatus=in_stock&hasSerial=without&perPage=200&catalogKind=climatics",
        { credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Грешка при зареждане на бройки");
      const rows = ((json as { data?: BatchRow[] }).data ?? []);
      const byKey = new Map<string, RecycleBatchGroup>();
      for (const r of rows) {
        const label = productCatalogLabel(r);
        const { brand, model } = splitProductSelection(r);
        const containerName = r.container?.name ?? null;
        const key = `${label}__${containerName ?? ""}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.count += 1;
          existing.productIds.push(r.id);
        } else {
          byKey.set(key, { key, label, brand, model, containerName, count: 1, productIds: [r.id] });
        }
      }
      setGroups([...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, "bg")));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Грешка при зареждане на бройки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedGroup = groups.find((g) => value && g.productIds.includes(value));
  const showPicker = !value || editing;

  // Вече избрана бройка (и не сме в режим "смяна") — заключен изглед.
  if (!showPicker) {
    const label = selectedGroup
      ? `${selectedGroup.label}${selectedGroup.containerName ? ` — ${selectedGroup.containerName}` : ""}`
      : (currentLabel?.trim() || "Избрана бройка");
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
        <p className="text-xs font-semibold text-slate-700">Бройка за сервизиране</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">{label}</p>
          {!disabled && (
            <button
              type="button"
              onClick={() => { setEditing(true); void load(); }}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-blue-700 hover:text-brand-blue-900 shrink-0"
            >
              <Pencil className="w-3 h-3" />
              Смени
            </button>
          )}
        </div>
        {selectedGroup && selectedGroup.count > 1 && (
          <p className="text-[11px] text-slate-500">
            Останалите {selectedGroup.count - 1} от партидата остават чакащи сервиз.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">
          Бройка за сервизиране (партида втора употреба)
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={disabled || loading}
          className="text-slate-400 hover:text-slate-700 disabled:opacity-50 p-1"
          title="Обнови списъка"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {loadErr && <p className="text-xs text-red-600">{loadErr}</p>}

      {!loading && groups.length === 0 && !loadErr && (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <PackageSearch className="w-4 h-4 shrink-0" />
          Няма бройки, чакащи сервиз (всичко в наличност вече има сериен №).
        </div>
      )}

      {groups.length > 0 && (
        <select
          value={value && selectedGroup ? value : ""}
          disabled={disabled}
          onChange={(e) => {
            const productId = e.target.value || null;
            const group = groups.find((g) => productId && g.productIds.includes(productId));
            setEditing(false);
            onChange(productId, group);
          }}
          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="">— избери бройка —</option>
          {groups.map((g) => (
            <option key={g.key} value={g.productIds[0]}>
              {g.label}
              {g.containerName ? ` — ${g.containerName}` : ""} ({g.count} бр. без сериен №)
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
