"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HelpRow, SectionTitle, HelpCard, Card, Input, Button, Table, Th, Td } from "../ui";
import { RefreshCw, Star, ChevronRight, X, Trash2, Plus, Minus } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Distribution = { 1: number; 2: number; 3: number; 4: number; 5: number };

type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  rating: number;
  reviews_count: number;
  distribution: Distribution;
};

type DetailRow = {
  id: string;
  stars: number;
  rater_key: string;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`}
        />
      ))}
    </div>
  );
}

function DistBar({ dist, total }: { dist: Distribution; total: number }) {
  return (
    <div className="space-y-1 w-full">
      {([5, 4, 3, 2, 1] as const).map((s) => {
        const count = dist[s] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={s} className="flex items-center gap-2 text-xs">
            <span className="w-2 text-slate-500 font-medium">{s}</span>
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-slate-500 font-medium">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  product,
  onClose,
  onRefresh,
}: {
  product: ProductSummary;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, perPage: 50, total: 0 });
  const [page, setPage] = useState(1);
  const [filterStar, setFilterStar] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustments, setAdjustments] = useState<Partial<Distribution>>({});
  const [dist, setDist] = useState<Distribution>({ ...product.distribution });
  const [total, setTotal] = useState(product.reviews_count);
  const [avgRating, setAvgRating] = useState(product.rating);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams({ view: "detail", product_id: product.id, page: String(page), perPage: "50" });
    if (filterStar) sp.set("stars", String(filterStar));
    const res = await fetch(`/api/admin/ratings?${sp}`, { credentials: "include" });
    const json = await res.json();
    setRows(json.data ?? []);
    setMeta(json.meta ?? { page: 1, perPage: 50, total: 0 });
    setLoading(false);
  }, [product.id, page, filterStar]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  async function deleteRow(id: string) {
    await fetch(`/api/admin/ratings/${id}`, { method: "DELETE", credentials: "include" });
    void loadDetail();
    onRefresh();
  }

  function changeAdj(star: keyof Distribution, delta: number) {
    setAdjustments((prev) => {
      const cur = prev[star] ?? 0;
      return { ...prev, [star]: cur + delta };
    });
  }

  async function applyAdjustments() {
    const nonZero = Object.fromEntries(
      Object.entries(adjustments).filter(([, v]) => v !== 0)
    );
    if (!Object.keys(nonZero).length) return;
    const res = await fetch(`/api/admin/ratings?product_id=${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ adjustments: nonZero }),
    });
    if (!res.ok) return;
    setAdjustments({});

    // Optimistically refresh distribution
    const newDist = { ...dist };
    for (const [starStr, delta] of Object.entries(nonZero)) {
      const s = Number(starStr) as keyof Distribution;
      newDist[s] = Math.max(0, (newDist[s] ?? 0) + (delta as number));
    }
    setDist(newDist);
    const newTotal = Object.values(newDist).reduce((a, b) => a + b, 0);
    setTotal(newTotal);
    const newAvg = newTotal > 0
      ? (Object.entries(newDist).reduce((s, [k, v]) => s + Number(k) * v, 0) / newTotal)
      : 0;
    setAvgRating(Math.round(newAvg * 10) / 10);

    void loadDetail();
    onRefresh();
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/60 md:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-3xl md:rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="min-w-0">
            <div className="font-black text-slate-900 text-base leading-snug">{product.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <Stars value={avgRating} size="md" />
              <span className="text-sm font-bold text-amber-500">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-slate-400">({total} оценки)</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Distribution + Adjust */}
          <div className="p-5 border-b border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Bar chart */}
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Разпределение</div>
                <DistBar dist={dist} total={total} />
              </div>

              {/* Manual adjustments */}
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ръчна корекция</div>
                <div className="space-y-1.5">
                  {([5, 4, 3, 2, 1] as const).map((s) => {
                    const adj = adjustments[s] ?? 0;
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <div className="flex gap-0.5 w-[70px]">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className={`w-3.5 h-3.5 ${i <= s ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`} />
                          ))}
                        </div>
                        <button
                          onClick={() => changeAdj(s, -1)}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-300 text-slate-600 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={`w-10 text-center text-sm font-bold ${adj > 0 ? "text-green-600" : adj < 0 ? "text-red-500" : "text-slate-400"}`}>
                          {adj > 0 ? `+${adj}` : adj === 0 ? "0" : adj}
                        </span>
                        <button
                          onClick={() => changeAdj(s, +1)}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-green-50 hover:border-green-300 text-slate-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-slate-400 ml-1">→ {Math.max(0, (dist[s] ?? 0) + adj)}</span>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => void applyAdjustments()}
                  disabled={!Object.values(adjustments).some(v => v !== 0) || adjusting}
                  className="mt-3 w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Приложи промените
                </button>
              </div>
            </div>
          </div>

          {/* Individual rows */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Индивидуални оценки</div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setFilterStar(null); setPage(1); }}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${filterStar === null ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Всички
                </button>
                {[5, 4, 3, 2, 1].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setFilterStar(s); setPage(1); }}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${filterStar === s ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {s}★
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400 text-sm">Зарежда...</div>
            ) : rows.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">Няма оценки.</div>
            ) : (
              <div className="space-y-1">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 group transition-colors">
                    <Stars value={r.stars} />
                    <span className="text-xs text-slate-400 flex-1 truncate ml-2" title={r.rater_key}>{r.rater_key}</span>
                    <span className="text-xs text-slate-400 shrink-0">{new Date(r.created_at).toLocaleDateString("bg-BG")}</span>
                    <button
                      onClick={() => void deleteRow(r.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</Button>
                <span className="text-sm text-slate-500">{page} / {pages}</span>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminRatingsPage() {
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProductSummary | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams({ view: "summary", page: String(page), perPage: "50" });
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [q, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ratings?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 50, total: 0 });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => { void load(); }, [load]);

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Оценки" hint="Преглед и модерация на клиентски оценки по продукти." />
        </h1>
        <Button variant="secondary" onClick={load} className="gap-2 shadow-sm">
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Обнови</span>
        </Button>
      </div>

      <HelpCard className="hidden md:block">
        <HelpRow items={["Кликни на продукт за детайлен изглед", "Ръчна корекция на брой оценки по звезди", "Изтриване на конкретни оценки"]} />
      </HelpCard>

      <Card className="p-3">
        <Input
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
          placeholder="Търси по название на продукт..."
          className="w-full"
        />
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Продукт</Th>
              <Th>Оценка</Th>
              <Th>Брой</Th>
              <Th>Разпределение (5→1★)</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><Td colSpan={5} className="text-center py-8 text-slate-400">Зарежда...</Td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><Td colSpan={5} className="text-center py-8 text-slate-500">Няма намерени продукти с оценки.</Td></tr>
            )}
            {!loading && items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 transition-colors cursor-pointer group"
                onClick={() => setSelected(item)}
              >
                <Td className="font-bold text-slate-900 max-w-[240px] truncate">{item.name}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <Stars value={item.rating} />
                    <span className="text-sm font-bold text-amber-500">{Number(item.rating).toFixed(1)}</span>
                  </div>
                </Td>
                <Td className="font-medium text-slate-700">{item.reviews_count}</Td>
                <Td className="min-w-[180px]">
                  <DistBar dist={item.distribution} total={item.reviews_count} />
                </Td>
                <Td>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {loading && <div className="text-center py-8 text-slate-400 text-sm">Зарежда...</div>}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
            Няма намерени продукти с оценки.
          </div>
        )}
        {!loading && items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => setSelected(item)}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="font-bold text-slate-900 text-sm leading-snug flex-1 min-w-0">{item.name}</div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Stars value={item.rating} />
              <span className="text-sm font-bold text-amber-500">{Number(item.rating).toFixed(1)}</span>
              <span className="text-xs text-slate-400">({item.reviews_count} оценки)</span>
            </div>
            <DistBar dist={item.distribution} total={item.reviews_count} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">Общо: {meta.total} продукта</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</Button>
            <span className="text-sm font-medium text-slate-600">{page} / {pages}</span>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</Button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <DetailModal
          product={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => void load()}
        />
      )}
    </div>
  );
}
