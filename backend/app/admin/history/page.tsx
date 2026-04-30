"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type EventCode =
  | "item_added"
  | "item_removed"
  | "sale"
  | "service_installation"
  | "service_inspection"
  | "service_repair"
  | "service_maintenance";

type WorkRow = {
  id: string;
  type: "sale" | "service" | "stock_in" | "stock_out" | "task";
  event_code?: EventCode | null;
  status: "planned" | "in_progress" | "done" | "cancelled";
  title: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_amount?: number | null;
  due_date?: string | null;
  created_at: string;
  notes?: string | null;
};

const EVENT_OPTIONS: Array<{ id: EventCode; label: string }> = [
  { id: "item_added", label: "Добавяне на артикул" },
  { id: "item_removed", label: "Премахване на артикул" },
  { id: "sale", label: "Продажба" },
  { id: "service_installation", label: "Услуга: монтаж" },
  { id: "service_inspection", label: "Услуга: оглед" },
  { id: "service_repair", label: "Услуга: сервиз" },
  { id: "service_maintenance", label: "Услуга: профилактика" },
];

const STATUS_BG: Record<WorkRow["status"], string> = {
  planned: "#fef3c7",
  in_progress: "#e0f2fe",
  done: "#dcfce7",
  cancelled: "#fee2e2",
};

const STATUS_TEXT: Record<WorkRow["status"], string> = {
  planned: "Чака",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

export default function AdminHistoryPage() {
  const [items, setItems] = useState<WorkRow[]>([]);
  const [q, setQ] = useState("");
  const [eventCode, setEventCode] = useState<"" | EventCode>("");
  const [status, setStatus] = useState<"" | WorkRow["status"]>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 30, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (eventCode) sp.set("eventCode", eventCode);
    if (status) sp.set("status", status);
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    sp.set("page", String(page));
    sp.set("perPage", "30");
    return sp.toString();
  }, [q, eventCode, status, fromDate, toDate, page]);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 30, total: 0 });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));
  return (
    <div>
      <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>История</h1>
      <div style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 220px 180px 160px 160px auto", gap: 10 }}>
        <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси по събитие/клиент/телефон/адрес..." style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
        <select value={eventCode} onChange={(e) => { setPage(1); setEventCode(e.target.value as EventCode | ""); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
          <option value="">Всички събития</option>
          {EVENT_OPTIONS.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as WorkRow["status"] | ""); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
          <option value="">Всички статуси</option>
          <option value="planned">Чака</option>
          <option value="in_progress">В процес</option>
          <option value="done">Изпълнена</option>
          <option value="cancelled">Отказана</option>
        </select>
        <input value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} type="date" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
        <input value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} type="date" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
        <button onClick={load} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", fontWeight: 700 }}>Обнови</button>
      </div>
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>{error}</div>}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              {["Събитие", "Статус", "Контакт", "Телефон", "Адрес", "Стойност", "Дата"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#334155" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                  {EVENT_OPTIONS.find((x) => x.id === row.event_code)?.label ?? row.title}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ background: STATUS_BG[row.status], borderRadius: 999, fontSize: 11, padding: "3px 8px", color: "#334155", fontWeight: 700 }}>
                    {STATUS_TEXT[row.status]}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "#475569" }}>{row.customer_name || "—"}</td>
                <td style={{ padding: "10px 12px", color: "#475569" }}>{row.customer_phone || "—"}</td>
                <td style={{ padding: "10px 12px", color: "#475569" }}>{row.customer_address || "—"}</td>
                <td style={{ padding: "10px 12px", color: "#475569" }}>
                  {row.total_amount != null ? `€${Number(row.total_amount).toLocaleString()}` : row.unit_price != null ? `€${Number(row.unit_price).toLocaleString()}` : "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "#64748b" }}>{new Date(row.due_date || row.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} style={{ padding: 14, color: "#64748b" }}>Няма записи.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pager(page > 1)}>Предишна</button>
        <span style={{ fontSize: 13, color: "#475569", alignSelf: "center" }}>Стр. {page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={pager(page < pages)}>Следваща</button>
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
