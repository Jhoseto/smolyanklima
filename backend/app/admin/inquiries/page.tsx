"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

export default function AdminInquiriesPage() {
  return <AdminInquiriesClient />;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: `${color}20`, color }}>
      {label}
    </span>
  );
}

function statusLabel(status: string) {
  if (status === "new") return { label: "Ново", color: "#ea580c" };
  if (status === "in_progress") return { label: "В работа", color: "#0284c7" };
  if (status === "done") return { label: "Приключено", color: "#16a34a" };
  if (status === "spam") return { label: "Спам", color: "#991b1b" };
  return { label: status || "—", color: "#6b7280" };
}

function priorityLabel(priority: string) {
  if (priority === "high") return { label: "Висок", color: "#b91c1c" };
  if (priority === "medium") return { label: "Среден", color: "#a16207" };
  if (priority === "low") return { label: "Нисък", color: "#374151" };
  return { label: priority || "—", color: "#6b7280" };
}

type Inquiry = {
  id: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  message?: string | null;
  service_type?: string | null;
  status: string;
  priority: string;
  assigned_to?: string | null;
  created_at: string;
};

function AdminInquiriesClient() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [status, q]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries${queryString}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  async function quickUpdate(id: string, patch: { status?: string; priority?: string }) {
    setError(null);
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Грешка");
      return;
    }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...(patch as any) } : it)));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900 }}>Запитвания</h1>
        <button onClick={load} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 800 }}>
          Обнови
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Статус</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
            <option value="">Всички</option>
            <option value="new">Ново</option>
            <option value="in_progress">В работа</option>
            <option value="done">Приключено</option>
            <option value="spam">Спам</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Търсене</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Име, телефон, имейл, текст..." style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", width: "100%" }} />
        </label>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div>Зареждане...</div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                {["Клиент", "Контакт", "Статус", "Приоритет", "Източник", "Създадено", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#374151" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const s = statusLabel(i.status);
                const p = priorityLabel(i.priority);
                return (
                  <tr key={i.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 900 }}>{i.customer_name}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                      <div>{i.customer_phone}</div>
                      {i.customer_email ? <div>{i.customer_email}</div> : null}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={s.label} color={s.color} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={p.label} color={p.color} />
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{i.source}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{new Date(i.created_at).toLocaleString()}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => quickUpdate(i.id, { status: "in_progress" })} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800 }}>
                          В работа
                        </button>
                        <button onClick={() => quickUpdate(i.id, { status: "done" })} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800 }}>
                          Приключи
                        </button>
                        <button onClick={() => quickUpdate(i.id, { status: "spam" })} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 800 }}>
                          Спам
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 14, color: "#6b7280" }}>
                    Няма запитвания.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

