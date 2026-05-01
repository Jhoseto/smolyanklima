"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionTitle, Card, Input, Select, Button, Table, Th, Td } from "../ui";
import { RefreshCw } from "lucide-react";

type EventCode =
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

function statusPillClass(status: WorkRow["status"]): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-sky-100 border-sky-200 text-sky-800`;
  if (status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-amber-100 border-amber-200 text-amber-800`;
}

const STATUS_TEXT: Record<WorkRow["status"], string> = {
  planned: "Чака",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

export default function AdminHistoryPage() {
  const [items, setItems] = useState<WorkRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | WorkRow["status"]>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 30, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    sp.set("eventCode", "sale");
    if (status) sp.set("status", status);
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    sp.set("page", String(page));
    sp.set("perPage", "30");
    return sp.toString();
  }, [q, status, fromDate, toDate, page]);

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
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1 leading-tight">
            <SectionTitle title="История на продажбите" hint="Само реални продажби. Другите действия са в Активност." />
          </h1>
        </div>
        <Button variant="secondary" onClick={load} className="gap-2 shadow-sm">
          <RefreshCw className="w-4 h-4" /> Обнови
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-4 items-end">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Търсене</span>
            <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси по събитие/клиент/телефон/адрес..." />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Статус</span>
            <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as WorkRow["status"] | ""); }}>
              <option value="">Всички статуси</option>
              <option value="planned">Чака</option>
              <option value="in_progress">В процес</option>
              <option value="done">Изпълнена</option>
              <option value="cancelled">Отказана</option>
            </Select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">От дата</span>
            <Input value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} type="date" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">До дата</span>
            <Input value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} type="date" />
          </label>
        </div>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">{error}</div>}

      <Table>
        <thead>
          <tr>
            <Th>Събитие</Th>
            <Th>Статус</Th>
            <Th>Контакт</Th>
            <Th>Телефон</Th>
            <Th>Адрес</Th>
            <Th>Стойност</Th>
            <Th>Дата</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
              <Td className="font-bold text-slate-900">
                Продажба
              </Td>
              <Td>
                <span className={statusPillClass(row.status)}>
                  {STATUS_TEXT[row.status]}
                </span>
              </Td>
              <Td className="font-medium text-slate-700">{row.customer_name || "—"}</Td>
              <Td className="text-slate-600">{row.customer_phone || "—"}</Td>
              <Td className="text-slate-600">{row.customer_address || "—"}</Td>
              <Td className="font-semibold text-slate-900">
                {row.total_amount != null ? `€${Number(row.total_amount).toLocaleString()}` : row.unit_price != null ? `€${Number(row.unit_price).toLocaleString()}` : "—"}
              </Td>
              <Td className="text-xs text-slate-500 font-medium">{new Date(row.due_date || row.created_at).toLocaleString()}</Td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><Td colSpan={7} className="text-center py-8 text-slate-500">Няма намерени продажби.</Td></tr>
          )}
        </tbody>
      </Table>

      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">Общо: {meta.total}</span>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Предишна</Button>
          <span className="text-sm font-medium text-slate-600">Стр. {page} / {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Следваща</Button>
        </div>
      </div>
    </div>
  );
}
