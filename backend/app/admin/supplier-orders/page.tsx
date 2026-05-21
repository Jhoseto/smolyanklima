"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionTitle, Card, Input, Select, Button, Table, Th, Td } from "../ui";
import { RefreshCw, Eye, Receipt } from "lucide-react";
import { SupplierOrderDetailModal } from "../SupplierOrderDetailModal";
import { SupplierOrderSaleModal } from "./SupplierOrderSaleModal";
import { ProductQuickViewButton } from "../ProductQuickView";
import { notifyAdminCalendarReload } from "@/lib/admin/calendarReload";
import { canRecordProductSale } from "@/lib/admin/recordProductSale";
import type { NormalizedSupplierOrderRow } from "@/lib/admin/supplierOrderRow";

type PhaseFilter = "" | "ordered" | "delivered" | "cancelled" | "all";

function orderPhaseLabel(row: NormalizedSupplierOrderRow): string {
  if (row.status === "cancelled") return "Отказана";
  if (row.status === "done") return "Доставена";
  return "Поръчана";
}

function orderPhasePillClass(row: NormalizedSupplierOrderRow): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  if (row.status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (row.status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-violet-100 border-violet-200 text-violet-900`;
}

function statusPillClass(status: string): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-50 border-green-200 text-green-800`;
  if (status === "cancelled") return `${base} bg-red-50 border-red-200 text-red-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-50 border-brand-blue-200 text-brand-blue-700`;
  return `${base} bg-amber-50 border-amber-200 text-amber-800`;
}

const STATUS_TEXT: Record<string, string> = {
  planned: "Планирана",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

function displayName(row: NormalizedSupplierOrderRow): string {
  const prod = row.products;
  if (!prod) return row.title;
  return (
    [prod.brand_name, prod.name, prod.model_code ? `(${prod.model_code})` : null].filter(Boolean).join(" ") ||
    row.title
  );
}

function catalogProductId(row: NormalizedSupplierOrderRow): string | null {
  return row.product_id ?? row.products?.id ?? null;
}

function OrderProductTitle({
  row,
  className = "",
}: {
  row: NormalizedSupplierOrderRow;
  className?: string;
}) {
  const name = displayName(row);
  return (
    <ProductQuickViewButton
      productId={catalogProductId(row)}
      productName={name}
      className={className}
    />
  );
}

function canSellDelivered(row: NormalizedSupplierOrderRow) {
  const dp = row.delivered_product;
  return row.status === "done" && dp != null && canRecordProductSale(dp.stock_status);
}

export default function SupplierOrdersHistoryPage() {
  const [items, setItems] = useState<NormalizedSupplierOrderRow[]>([]);
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<PhaseFilter>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 30, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saleOrder, setSaleOrder] = useState<NormalizedSupplierOrderRow | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (phase) sp.set("phase", phase);
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    sp.set("page", String(page));
    sp.set("perPage", "30");
    return sp.toString();
  }, [q, phase, fromDate, toDate, page]);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/supplier-orders?${qs}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      setItems((json as { data?: NormalizedSupplierOrderRow[] }).data ?? []);
      setMeta((json as { meta?: typeof meta }).meta ?? { page: 1, perPage: 30, total: 0 });
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold leading-tight text-slate-900 md:text-xl">
          <SectionTitle
            title="Поръчки"
            hint="Пълна хронология: поръчани, доставени и отказани. Управление на доставка и продажба след получаване."
          />
        </h1>
        <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm">
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Обнови</span>
        </Button>
      </div>

      <Card className="p-3 md:p-4">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 md:grid-cols-[1fr_auto_auto_auto] md:gap-4">
          <label className="grid gap-1">
            <span className="hidden text-xs font-bold uppercase tracking-wide text-slate-700 md:block">Търсене</span>
            <Input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Клиент, телефон, продукт..."
            />
          </label>
          <Select
            value={phase}
            onChange={(e) => {
              setPage(1);
              setPhase(e.target.value as PhaseFilter);
            }}
          >
            <option value="">Всички статуси</option>
            <option value="ordered">Поръчани (чакат доставка)</option>
            <option value="delivered">Доставени</option>
            <option value="cancelled">Отказани</option>
            <option value="all">Всички записи</option>
          </Select>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setPage(1);
              setFromDate(e.target.value);
            }}
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => {
              setPage(1);
              setToDate(e.target.value);
            }}
          />
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>
      )}

      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Продукт</Th>
              <Th>Фаза</Th>
              <Th>Оперативен</Th>
              <Th>Клиент</Th>
              <Th>Телефон</Th>
              <Th>Договорена</Th>
              <Th>Дата</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50">
                <Td className="max-w-[220px] min-w-0">
                  <OrderProductTitle
                    row={row}
                    className="block truncate text-sm font-semibold text-slate-800"
                  />
                </Td>
                <Td>
                  <span className={orderPhasePillClass(row)}>{orderPhaseLabel(row)}</span>
                </Td>
                <Td>
                  <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status] ?? row.status}</span>
                </Td>
                <Td className="font-medium text-slate-700">{row.customer_name ?? row.contacts?.full_name ?? "—"}</Td>
                <Td className="text-slate-600">{row.customer_phone ?? row.contacts?.phone ?? "—"}</Td>
                <Td className="font-semibold text-slate-900">
                  {row.unit_price != null ? `€${Number(row.unit_price).toLocaleString()}` : "—"}
                </Td>
                <Td className="text-xs font-medium text-slate-500">
                  {row.due_date
                    ? new Date(`${String(row.due_date).slice(0, 10)}T00:00:00`).toLocaleDateString("bg-BG")
                    : "—"}
                </Td>
                <Td className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button variant="secondary" size="sm" className="!text-xs font-bold" onClick={() => setDetailId(row.id)}>
                      <Eye className="mr-1 inline h-3.5 w-3.5" />
                      Детайли
                    </Button>
                    {canSellDelivered(row) && (
                      <Button variant="primary" size="sm" className="!text-xs font-bold" onClick={() => setSaleOrder(row)}>
                        <Receipt className="mr-1 inline h-3.5 w-3.5" />
                        Продажба
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <Td colSpan={8} className="py-8 text-center text-slate-500">
                  Няма намерени поръчки.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Няма намерени поръчки.
          </div>
        )}
        {items.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <OrderProductTitle row={row} className="line-clamp-2 text-sm font-bold text-slate-900" />
                <div className="mt-1 text-xs text-slate-500">
                  {row.customer_name ?? row.contacts?.full_name ?? "—"}
                  {(row.customer_phone ?? row.contacts?.phone) && ` · ${row.customer_phone ?? row.contacts?.phone}`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {row.unit_price != null && (
                  <div className="text-lg font-black text-slate-900">€{Number(row.unit_price).toLocaleString()}</div>
                )}
                <div className="mt-1 flex flex-col items-end gap-1">
                  <span className={orderPhasePillClass(row)}>{orderPhaseLabel(row)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" className="font-bold !text-xs" onClick={() => setDetailId(row.id)}>
                <Eye className="mr-1 inline h-3.5 w-3.5" />
                Детайли
              </Button>
              {canSellDelivered(row) && (
                <Button variant="primary" size="sm" className="font-bold !text-xs" onClick={() => setSaleOrder(row)}>
                  Продажба
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">Общо: {meta.total}</span>
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

      {detailId && (
        <SupplierOrderDetailModal
          orderId={detailId}
          onClose={() => setDetailId(null)}
          onCancelled={() => {
            setDetailId(null);
            void load();
            notifyAdminCalendarReload();
          }}
          onUpdated={() => void load()}
          onFulfilled={() => {
            setDetailId(null);
            void load();
            notifyAdminCalendarReload();
          }}
          onRequestSale={(order) => {
            setDetailId(null);
            setSaleOrder(order);
          }}
        />
      )}

      {saleOrder && (
        <SupplierOrderSaleModal
          order={saleOrder}
          onClose={() => setSaleOrder(null)}
          onSuccess={() => {
            void load();
            notifyAdminCalendarReload();
          }}
        />
      )}
    </div>
  );
}
