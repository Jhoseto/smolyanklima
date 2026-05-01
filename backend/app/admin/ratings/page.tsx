"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpRow, SectionTitle, HelpCard, Card, Input, Select, Button, Table, Th, Td } from "../ui";
import { RefreshCw, Trash2, Star } from "lucide-react";
import { ProductQuickViewButton } from "../ProductQuickView";

type RatingRow = {
  id: string;
  stars: number;
  created_at: string;
  products?: { id?: string; slug?: string; name?: string } | null;
};

export default function AdminRatingsPage() {
  const [items, setItems] = useState<RatingRow[]>([]);
  const [q, setQ] = useState("");
  const [stars, setStars] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (stars) sp.set("stars", stars);
    sp.set("page", String(page));
    sp.set("perPage", "25");
    return sp.toString();
  }, [q, stars, page]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ratings?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 25, total: 0 });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  async function remove(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    const res = await fetch(`/api/admin/ratings/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при изтриване");
      return;
    }
    setConfirmDeleteId(null);
    await load();
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Оценки" hint="Модерация на клиентски оценки и звезди по продукти." />
        </h1>
        <Button variant="secondary" onClick={load} className="gap-2 shadow-sm">
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Обнови</span>
        </Button>
      </div>

      <HelpCard className="hidden md:block">
        <HelpRow items={["Филтър по звезди за бърза проверка", "Изтриване при невалиден/спам вот", "Общо брой оценки и странициране"]} />
      </HelpCard>

      <Card className="p-3">
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси продукт..." className="flex-1" />
          <Select value={stars} onChange={(e) => { setPage(1); setStars(e.target.value); }} className="w-36 shrink-0">
            <option value="">Всички ★</option>
            <option value="5">★★★★★</option>
            <option value="4">★★★★</option>
            <option value="3">★★★</option>
            <option value="2">★★</option>
            <option value="1">★</option>
          </Select>
        </div>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Продукт</Th>
              <Th>Звезди</Th>
              <Th>Дата</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                <Td className="font-bold text-slate-900">
                  {r.products?.name ? <ProductQuickViewButton productId={r.products.id} productName={r.products.name} /> : "—"}
                </Td>
                <Td>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.stars ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`} />
                    ))}
                  </div>
                </Td>
                <Td className="text-slate-500 font-medium">{new Date(r.created_at).toLocaleString()}</Td>
                <Td className="text-right">
                  <Button variant="danger" size="sm" onClick={() => void remove(r.id)} className="opacity-0 group-hover:opacity-100 transition-opacity gap-1.5 !py-1.5 !px-2.5">
                    <Trash2 className="w-3.5 h-3.5" /> Изтрий
                  </Button>
                </Td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><Td colSpan={4} className="text-center py-8 text-slate-500">Няма намерени оценки.</Td></tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени оценки.</div>
        )}
        {!loading && items.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-sm leading-snug mb-1.5">
                  {r.products?.name ? <ProductQuickViewButton productId={r.products.id} productName={r.products.name} /> : "Неизвестен продукт"}
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < r.stars ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`} />
                  ))}
                </div>
                <div className="text-xs text-slate-400 font-medium mt-1">{new Date(r.created_at).toLocaleDateString("bg-BG")}</div>
              </div>
              <Button variant="danger" size="sm" onClick={() => void remove(r.id)} className="gap-1.5 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">Общо: {meta.total}</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</Button>
          <span className="text-sm font-medium text-slate-600">{page} / {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>›</Button>
        </div>
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 md:p-4 backdrop-blur-md" onClick={() => setConfirmDeleteId(null)}>
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl border border-white/70 bg-white p-6 shadow-[0_-8px_40px_rgba(15,23,42,0.25)] md:shadow-[0_30px_90px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-black text-slate-950">Изтриване на оценка</div>
            <div className="mt-2 text-sm text-slate-500">Сигурни ли сте, че искате да изтриете тази оценка?</div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>Отказ</Button>
              <Button variant="danger" onClick={() => void remove(confirmDeleteId)}>Изтрий</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
