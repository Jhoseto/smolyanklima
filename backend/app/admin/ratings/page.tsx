"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

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
    if (!confirm("Да изтрия ли оценката?")) return;
    const res = await fetch(`/api/admin/ratings/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при изтриване");
      return;
    }
    await load();
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  return (
    <div>
      <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Оценки</h1>
      <p style={{ marginTop: 0, color: "#64748b", fontSize: 13, marginBottom: 12 }}>Модерация на клиентските звезди</p>

      <div style={{ border: "1px solid #e2e8f0", background: "white", borderRadius: 16, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 10 }}>
        <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси продукт..." style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
        <select value={stars} onChange={(e) => { setPage(1); setStars(e.target.value); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
          <option value="">Всички звезди</option>
          <option value="5">5 звезди</option>
          <option value="4">4 звезди</option>
          <option value="3">3 звезди</option>
          <option value="2">2 звезди</option>
          <option value="1">1 звезда</option>
        </select>
        <button onClick={load} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontWeight: 700 }}>Обнови</button>
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>{error}</div>}

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              {["Продукт", "Звезди", "Дата", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#334155" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && items.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.products?.name ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</td>
                <td style={{ padding: "10px 12px", color: "#64748b" }}>{new Date(r.created_at).toLocaleString()}</td>
                <td style={{ padding: "10px 12px" }}>
                  <button onClick={() => void remove(r.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #fecaca", color: "#b91c1c", background: "white", fontWeight: 700 }}>
                    Изтрий
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={4} style={{ padding: 14, color: "#64748b" }}>Няма оценки.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{ color: "#64748b", fontSize: 13 }}>Общо: {meta.total}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pager(page > 1)}>Предишна</button>
          <span style={{ fontSize: 13, color: "#475569", alignSelf: "center" }}>Стр. {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={pager(page < pages)}>Следваща</button>
        </div>
      </div>
    </div>
  );
}

function pager(enabled: boolean): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    fontWeight: 700,
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
