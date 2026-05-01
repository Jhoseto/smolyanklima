"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Card, Input, Select, SectionTitle, Table, Td, Th } from "../ui";

type ActivityRow = {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
  admin_users?: { email?: string | null; name?: string | null } | null;
};

export default function AdminActivityPage() {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 30, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (entityType) sp.set("entityType", entityType);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("page", String(page));
    sp.set("perPage", "30");
    return sp.toString();
  }, [q, entityType, from, to, page]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/activity-logs?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 30, total: 0 });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Активност" hint="Одит лог: промени по продукти, контакти, заявки, настройки и системни действия." />
        </h1>
        <Button variant="secondary" onClick={() => void load()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Обнови</span>
        </Button>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-2 md:grid-cols-[1fr_180px_150px_150px] gap-2 md:gap-3 items-end">
          <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси действие..." className="col-span-2 md:col-span-1" />
          <Select value={entityType} onChange={(e) => { setPage(1); setEntityType(e.target.value); }}>
            <option value="">Всички типове</option>
            <option value="product">Product</option>
            <option value="contact">Contact</option>
            <option value="inquiry">Inquiry</option>
            <option value="work_item">Work item</option>
            <option value="settings">Settings</option>
            <option value="email_outbox">Email</option>
            <option value="ai">AI</option>
          </Select>
          <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
      </Card>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Действие</Th>
              <Th>Тип</Th>
              <Th>Потребител</Th>
              <Th>Детайли</Th>
              <Th>Дата</Th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <Td className="font-mono text-xs font-bold text-slate-900">{row.action}</Td>
                <Td>{row.entity_type ?? "—"}</Td>
                <Td>
                  <div className="font-medium text-slate-900">{row.admin_users?.name ?? "—"}</div>
                  <div className="text-xs text-slate-500">{row.admin_users?.email ?? ""}</div>
                </Td>
                <Td>
                  <div className="max-w-[520px] truncate font-mono text-xs text-slate-600" title={JSON.stringify(row.details ?? {})}>
                    {JSON.stringify(row.details ?? {})}
                  </div>
                </Td>
                <Td className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("bg-BG")}</Td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><Td colSpan={5} className="text-center py-8 text-slate-500">Няма намерени записи.</Td></tr>}
            {loading && <tr><Td colSpan={5} className="text-center py-8 text-slate-500">Зареждане...</Td></tr>}
          </tbody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {loading && <div className="text-center py-10 text-slate-500 text-sm">Зареждане...</div>}
        {!loading && items.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени записи.</div>}
        {!loading && items.map((row) => (
          <div key={row.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold text-slate-900 leading-snug">{row.action}</span>
              <span className="text-[10px] text-slate-400 font-medium shrink-0">{new Date(row.created_at).toLocaleDateString("bg-BG")}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {row.entity_type && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700">{row.entity_type}</span>}
              {row.admin_users?.name && <span className="text-xs text-slate-600 font-medium">{row.admin_users.name}</span>}
            </div>
            {row.details && Object.keys(row.details).length > 0 && (
              <div className="font-mono text-[10px] text-slate-500 mt-1.5 truncate">{JSON.stringify(row.details)}</div>
            )}
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
    </div>
  );
}
