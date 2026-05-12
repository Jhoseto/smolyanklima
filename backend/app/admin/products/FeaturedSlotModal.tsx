"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, X, Trash2, Loader2, AlertTriangle, Info } from "lucide-react";
import { Button } from "../ui";

// Badge-те, които могат да се появят върху картичката в секцията „Топ продукти“.
// Списъкът ТРЯБВА да съответства на CHECK constraint-а в DB (миграция 0035).
const BADGES = [
  { key: "bestseller", label: "Bestseller", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { key: "top_offer", label: "Топ оферта", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { key: "promo", label: "Промоция", className: "bg-rose-100 text-rose-700 border-rose-200" },
  { key: "top_searched", label: "Най-търсен", className: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "premium", label: "Премиум", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { key: "best_value", label: "Най-изгоден", className: "bg-teal-100 text-teal-800 border-teal-200" },
] as const;
export type BadgeKey = (typeof BADGES)[number]["key"];

type FeaturedItem = {
  id: string;
  name: string;
  slug?: string | null;
  price?: number | null;
  featured_position: number | null;
  featured_badge: BadgeKey | null;
  stock_status?: string | null;
  is_active?: boolean | null;
  brands?: { name?: string } | null;
  product_types?: { name?: string } | null;
  product_images?: Array<{ url: string; is_main?: boolean; sort_order?: number }>;
};

function badgeMeta(key: string | null | undefined) {
  return BADGES.find((b) => b.key === key) ?? null;
}

function pickImage(item?: { product_images?: Array<{ url: string; is_main?: boolean; sort_order?: number }> }) {
  const arr = item?.product_images ?? [];
  if (arr.length === 0) return "";
  const main = arr.find((x) => x.is_main);
  if (main) return main.url;
  return [...arr].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.url ?? "";
}

export function FeaturedSlotModal({
  product,
  onClose,
  onSaved,
}: {
  product: {
    id: string;
    name: string;
    brands?: { name?: string } | null;
    stock_status?: string | null;
    is_active?: boolean | null;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Карта „позиция (1..6) → продукт на нея“. Празните слотове са undefined.
  const slotMap = useMemo(() => {
    const m = new Map<number, FeaturedItem>();
    for (const it of items) {
      if (it.featured_position != null) m.set(it.featured_position, it);
    }
    return m;
  }, [items]);

  // Текущата позиция и badge на отворения продукт (ако е вече в Топ продукти).
  const myExisting = items.find((it) => it.id === product.id);
  const [position, setPosition] = useState<number | null>(myExisting?.featured_position ?? null);
  const [badge, setBadge] = useState<BadgeKey | null>(myExisting?.featured_badge ?? null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/products/featured", { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as any).error || "Грешка при зареждане на Топ продукти");
        if (cancelled) return;
        const data = ((json as any).data ?? []) as FeaturedItem[];
        setItems(data);
        const mine = data.find((d) => d.id === product.id);
        setPosition(mine?.featured_position ?? null);
        setBadge((mine?.featured_badge as BadgeKey | null) ?? null);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  async function save() {
    if (position == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products/featured", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, position, badge }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при запазване");
      onSaved();
      onClose();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function removeFromFeatured() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products/featured", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при премахване");
      onSaved();
      onClose();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // Кой ще бъде „изместен“, ако избраната позиция е заета от друг продукт.
  const occupant = position != null ? slotMap.get(position) : null;
  const willDisplace = occupant && occupant.id !== product.id ? occupant : null;

  const isInFeatured = !!myExisting;
  const slots = [1, 2, 3, 4, 5, 6];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-amber-500">
              <Star className="w-5 h-5 fill-current" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Топ продукти на началната страница</span>
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-900 leading-tight">{product.name}</h2>
            <p className="text-xs text-slate-500">
              {product.brands?.name ?? "—"} · избери позиция (1–6) и опционален badge
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Зареждам слотовете…
            </div>
          ) : (
            <>
              {/* Схема 3×2 */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Избери позиция
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {slots.map((pos) => {
                    const occ = slotMap.get(pos);
                    const isMine = occ?.id === product.id;
                    const isPicked = position === pos;
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setPosition(pos)}
                        className={`relative aspect-[4/3] rounded-2xl border-2 transition-all p-3 flex flex-col text-left ${
                          isPicked
                            ? "border-brand-blue-500 bg-brand-blue-50 ring-4 ring-brand-blue-200/60"
                            : isMine
                              ? "border-emerald-300 bg-emerald-50"
                              : occ
                                ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
                                : "border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`absolute top-2 left-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                          isPicked ? "bg-brand-blue-500 text-white" : "bg-slate-900/80 text-white"
                        }`}>
                          {pos}
                        </span>
                        {occ ? (
                          <div className="ml-7 flex flex-col h-full">
                            {pickImage(occ) ? (
                              <img
                                src={pickImage(occ)}
                                alt={occ.name}
                                className="h-10 w-10 object-contain self-end rounded-md bg-white/70 ring-1 ring-slate-200"
                                draggable={false}
                              />
                            ) : null}
                            <div className="mt-auto">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">
                                {occ.brands?.name ?? "—"}
                              </div>
                              <div className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">
                                {occ.name}
                              </div>
                              {isMine && (
                                <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                  ⭐ Текуща позиция
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="m-auto text-xs font-semibold text-slate-400">Свободна</div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {willDisplace && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      На позиция <strong>#{position}</strong> в момента стои{" "}
                      <strong>{willDisplace.name}</strong>. След запазване той ще бъде премахнат от Топ продукти.
                    </div>
                  </div>
                )}

                {/* Информация за публичната видимост — критично! Ако stock_status
                    е out_of_stock или is_active=false, секцията „Топ продукти“
                    няма да показва продукта (тя ползва същия публичен филтър
                    като каталога). Затова при запазване ще нормализираме тези
                    флагове автоматично. */}
                {(product.stock_status === "out_of_stock" || product.is_active === false) && (
                  <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 text-sky-900 px-3 py-2 text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" />
                    <div>
                      Този продукт в момента е{" "}
                      {product.is_active === false && <strong>скрит (неактивен)</strong>}
                      {product.is_active === false && product.stock_status === "out_of_stock" && " и "}
                      {product.stock_status === "out_of_stock" && <strong>изчерпан</strong>}.
                      При запазване автоматично ще го върнем към{" "}
                      <strong>„Активен“ + „В наличност“</strong>, иначе „Топ продукти“ секцията няма да го показва на началната страница.
                    </div>
                  </div>
                )}
              </div>

              {/* Badge селектор */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Badge (опционално)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBadge(null)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      badge == null
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Без badge
                  </button>
                  {BADGES.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setBadge(b.key)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                        badge === b.key
                          ? "ring-2 ring-offset-1 ring-brand-blue-400 " + b.className
                          : b.className + " hover:brightness-95"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Badge-ът се появява в горния ляв ъгъл на снимката в секцията „Топ продукти“.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            {isInFeatured && (
              <Button
                variant="secondary"
                size="sm"
                onClick={removeFromFeatured}
                disabled={busy}
                className="gap-1.5 !text-rose-700 hover:!bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Премахни от Топ продукти
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Откажи
            </Button>
            <Button
              onClick={save}
              disabled={busy || position == null || loading}
              className="gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
              Запази позиция #{position ?? "—"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
