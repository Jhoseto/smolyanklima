"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionTitle, Card, Input, Select, Button, Table, Th, Td } from "../ui";
import { RefreshCw, CheckCircle2, Ban } from "lucide-react";

type EventCode =
  | "item_added"
  | "item_removed"
  | "sale"
  | "service_installation"
  | "service_maintenance"
  | "service_on_site"
  | "service_in_shop";

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
  sale_install_state?: "pending_mount" | "completed" | null;
  products?: { id?: string; name?: string; slug?: string } | null;
};

function statusPillClass(status: WorkRow["status"]): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700`;
  if (status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-amber-100 border-amber-200 text-amber-800`;
}

const STATUS_TEXT: Record<WorkRow["status"], string> = {
  planned: "Чака",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

function mountPhaseLabel(row: WorkRow): string {
  if (row.status === "cancelled") return "Отказана";
  if (row.sale_install_state === "pending_mount") return "Чака монтаж";
  if (row.sale_install_state === "completed") return "Завършен";
  if (row.status === "done") return "Завършен";
  return "Чака монтаж";
}

function mountPhasePillClass(row: WorkRow): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  const label = mountPhaseLabel(row);
  if (label === "Завършен") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (label === "Отказана") return `${base} bg-red-100 border-red-200 text-red-900`;
  return `${base} bg-amber-100 border-amber-200 text-amber-900`;
}

type ConfirmKind = "complete" | "cancel";

export default function AdminHistoryPage() {
  const [items, setItems] = useState<WorkRow[]>([]);
  const [q, setQ] = useState("");
  const [saleState, setSaleState] = useState<"" | "pending_mount" | "completed">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 30, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; row: WorkRow } | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    sp.set("eventCode", "sale");
    if (saleState) sp.set("saleInstallState", saleState);
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    sp.set("page", String(page));
    sp.set("perPage", "30");
    return sp.toString();
  }, [q, saleState, fromDate, toDate, page]);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 30, total: 0 });
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  async function performComplete(row: WorkRow) {
    setActionRowId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${row.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleInstallState: "completed" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      await load();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setActionRowId(null);
      setConfirm(null);
    }
  }

  async function performCancel(row: WorkRow) {
    setActionRowId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${row.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      await load();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setActionRowId(null);
      setConfirm(null);
    }
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  const canPendingActions = (row: WorkRow) =>
    row.sale_install_state === "pending_mount" && row.status !== "cancelled";

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle
            title="История на продажбите"
            hint="Статус по монтаж: чака монтаж / завършен / отказана. Събитието „Монтаж“ е в оперативното табло."
          />
        </h1>
        <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm">
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Обнови</span>
        </Button>
      </div>

      <Card className="p-3 md:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_auto_auto_auto] gap-2 md:gap-4 items-end">
          <label className="grid gap-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide hidden md:block">Търсене</span>
            <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси по клиент/телефон/адрес..." />
          </label>
          <Select value={saleState} onChange={(e) => { setPage(1); setSaleState(e.target.value as "" | "pending_mount" | "completed"); }}>
            <option value="">Всички (монтаж)</option>
            <option value="pending_mount">Чака монтаж</option>
            <option value="completed">Завършен</option>
          </Select>
          <Input value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} type="date" />
          <Input value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} type="date" />
        </div>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Продукт</Th>
              <Th>Статус монтаж</Th>
              <Th>Оперативен</Th>
              <Th>Контакт</Th>
              <Th>Телефон</Th>
              <Th>Адрес</Th>
              <Th>Стойност</Th>
              <Th>Дата монтаж</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const productName = row.products?.name ?? "—";
              const showActions = canPendingActions(row);
              return (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <Td className="font-semibold text-slate-800 max-w-[200px] truncate" title={productName}>
                    {productName}
                  </Td>
                  <Td>
                    <span className={mountPhasePillClass(row)}>{mountPhaseLabel(row)}</span>
                  </Td>
                  <Td>
                    <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status]}</span>
                  </Td>
                  <Td className="font-medium text-slate-700">{row.customer_name || "—"}</Td>
                  <Td className="text-slate-600">{row.customer_phone || "—"}</Td>
                  <Td className="text-slate-600 max-w-[180px] truncate" title={row.customer_address ?? ""}>
                    {row.customer_address || "—"}
                  </Td>
                  <Td className="font-semibold text-slate-900">
                    {row.total_amount != null
                      ? `€${Number(row.total_amount).toLocaleString()}`
                      : row.unit_price != null
                        ? `€${Number(row.unit_price).toLocaleString()}`
                        : "—"}
                  </Td>
                  <Td className="text-xs text-slate-500 font-medium">
                    {row.due_date ? new Date(row.due_date).toLocaleDateString("bg-BG") : "—"}
                  </Td>
                  <Td className="text-right">
                    {showActions ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="!text-xs font-bold"
                          disabled={actionRowId === row.id}
                          onClick={() => setConfirm({ kind: "complete", row })}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                          Завърши
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="!text-xs font-bold"
                          disabled={actionRowId === row.id}
                          onClick={() => setConfirm({ kind: "cancel", row })}
                        >
                          <Ban className="w-3.5 h-3.5 inline mr-1" />
                          Отказ
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <Td colSpan={9} className="text-center py-8 text-slate-500">
                  Няма намерени продажби.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {items.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени продажби.</div>
        )}
        {items.map((row) => {
          const amount = row.total_amount != null ? row.total_amount : row.unit_price;
          const productName = row.products?.name ?? "—";
          const showActions = canPendingActions(row);
          return (
            <div key={row.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase text-slate-500 truncate">{productName}</div>
                  <div className="font-bold text-slate-900 text-sm">{row.customer_name || "Неизвестен клиент"}</div>
                  {row.customer_phone && (
                    <a href={`tel:${row.customer_phone}`} className="text-xs text-brand-blue-500 font-medium mt-0.5 block">
                      {row.customer_phone}
                    </a>
                  )}
                  {row.customer_address && <div className="text-xs text-slate-500 mt-0.5">{row.customer_address}</div>}
                </div>
                <div className="text-right shrink-0">
                  {amount != null ? (
                    <div className="text-lg font-black text-slate-900">€{Number(amount).toLocaleString()}</div>
                  ) : (
                    <div className="text-sm text-slate-400">—</div>
                  )}
                  <div className="mt-1 flex flex-col items-end gap-1">
                    <span className={mountPhasePillClass(row)}>{mountPhaseLabel(row)}</span>
                    <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Продажба
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Монтаж: {row.due_date ? new Date(row.due_date).toLocaleDateString("bg-BG") : "—"}
                </span>
              </div>
              {showActions && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="font-bold !text-xs"
                    disabled={actionRowId === row.id}
                    onClick={() => setConfirm({ kind: "complete", row })}
                  >
                    Завърши
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="font-bold !text-xs"
                    disabled={actionRowId === row.id}
                    onClick={() => setConfirm({ kind: "cancel", row })}
                  >
                    Отказ
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">Общо: {meta.total}</span>
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹ Пред.
          </Button>
          <span className="text-sm font-medium text-slate-600">
            {page} / {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Следв. ›
          </Button>
        </div>
      </div>

      {confirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => !actionRowId && setConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-black text-slate-900">
              {confirm.kind === "complete" ? "Потвърждение: завършване" : "Потвърждение: отказ"}
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {confirm.kind === "complete" ? (
                <>
                  Сигурни ли сте, че монтажът е извършен? Статусът на продажбата ще стане <strong>завършен</strong>, а задачата за монтаж в
                  календара — <strong>изпълнена</strong>.
                </>
              ) : (
                <>
                  Сигурни ли сте, че искате да <strong>откажете</strong> тази продажа (чака монтаж)? Продажбата и свързаният монтаж в календара
                  ще бъдат маркирани като <strong>отказани</strong>. Това не възстановява автоматично склада — при нужда коригирайте продукта
                  ръчно.
                </>
              )}
            </p>
            <div className="mt-1 text-xs font-semibold text-slate-500 truncate" title={confirm.row.products?.name ?? confirm.row.title}>
              {confirm.row.products?.name ?? confirm.row.title}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" type="button" disabled={actionRowId !== null} onClick={() => setConfirm(null)}>
                Назад
              </Button>
              <Button
                variant={confirm.kind === "cancel" ? "danger" : "primary"}
                type="button"
                disabled={actionRowId !== null}
                onClick={() => {
                  if (confirm.kind === "complete") void performComplete(confirm.row);
                  else void performCancel(confirm.row);
                }}
              >
                {actionRowId ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Изпълнение…
                  </span>
                ) : (
                  "Потвърди"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
