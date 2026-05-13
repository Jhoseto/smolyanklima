"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "../ui";
import { X, Loader2, Settings } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** След успешен запис или масово прилагане — презареди списъка продукти. */
  onApplied: () => void;
  /** Само преглед (напр. сервиз) — без запис. */
  readOnly?: boolean;
};

function parseEur(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function ProductCatalogSettingsModal({ open, onClose, onApplied, readOnly = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mountNew, setMountNew] = useState("");
  const [mountUsed, setMountUsed] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/products/catalog-settings", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { defaultMountNewEur?: number | null; defaultMountUsedEur?: number | null };
      };
      if (!res.ok) throw new Error(json.error || "Грешка при зареждане");
      const d = json.data;
      setMountNew(d?.defaultMountNewEur != null ? String(d.defaultMountNewEur) : "");
      setMountUsed(d?.defaultMountUsedEur != null ? String(d.defaultMountUsedEur) : "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function save() {
    setError(null);
    setSuccess(null);
    const n = parseEur(mountNew);
    const u = parseEur(mountUsed);
    if (n == null || u == null) {
      setError("Попълни две валидни суми (≥ 0) за нови и за втора употреба.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/products/catalog-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultMountNewEur: n,
          defaultMountUsedEur: u,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Грешка при запис");
      setSuccess("Настройките са запазени.");
      onApplied();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 md:p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-h-[90vh] overflow-y-auto md:max-w-lg rounded-t-2xl md:rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Settings className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 leading-tight">Настройки на каталога</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Тук ще се добавят и други опции занапред.</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={() => !saving && onClose()}
            aria-label="Затвори"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 md:px-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Зареждане…
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Стандартен монтаж (EUR)</h3>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Сума, която се <strong>добавя към продажната цена</strong> (без монтаж), за да се получи{" "}
                  <strong>цена с монтаж</strong>.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-[11px] font-semibold text-slate-600">Нови климатици</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={mountNew}
                      onChange={(e) => setMountNew(e.target.value)}
                      placeholder="напр. 500"
                      disabled={saving || readOnly}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] font-semibold text-slate-600">Втора употреба</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={mountUsed}
                      onChange={(e) => setMountUsed(e.target.value)}
                      placeholder="напр. 450"
                      disabled={saving || readOnly}
                    />
                  </label>
                </div>
              </section>

              {readOnly && (
                <p className="text-[11px] text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <strong>Преглед:</strong> промяна на стойностите прави само главният администратор.
                </p>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
                  {success}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
                <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                  Затвори
                </Button>
                {!readOnly && (
                  <Button type="button" variant="primary" onClick={() => void save()} disabled={saving}>
                    {saving ? "Запис…" : "Запиши настройките"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
