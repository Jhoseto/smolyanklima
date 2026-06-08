"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";
import { ChevronRight, GripVertical, Truck } from "lucide-react";
import { Card, AdminContactMetaLine } from "./ui";
import { SupplierOrderDetailModal } from "./SupplierOrderDetailModal";
import { notifyAdminCalendarReload } from "@/lib/admin/calendarReload";
import type { NormalizedSupplierOrderRow } from "@/lib/admin/supplierOrderRow";

function displayName(row: NormalizedSupplierOrderRow): string {
  const prod = row.products;
  if (!prod) return row.title;
  return (
    [prod.brand_name, prod.name, prod.model_code ? `(${prod.model_code})` : null].filter(Boolean).join(" ") ||
    row.title
  );
}

function formatBgDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("bg-BG");
}

function formatBgDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reorderByDrag<T extends { id: string }>(items: T[], dragId: string, targetId: string): T[] {
  if (dragId === targetId) return items;
  const from = items.findIndex((i) => i.id === dragId);
  const to = items.findIndex((i) => i.id === targetId);
  if (from < 0 || to < 0) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function SupplierOrdersPanel({
  initialRows,
  readOnly,
  canReorder = false,
}: {
  initialRows: NormalizedSupplierOrderRow[];
  readOnly: boolean;
  /** master_admin — плъзгане за ръчен ред в опашката */
  canReorder?: boolean;
}) {
  const [rows, setRows] = useState<NormalizedSupplierOrderRow[]>(initialRows);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/supplier-orders", { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setRows((json as { data?: NormalizedSupplierOrderRow[] }).data ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function persistOrder(nextRows: NormalizedSupplierOrderRow[], prevRows: NormalizedSupplierOrderRow[]) {
    setReorderBusy(true);
    setReorderError(null);
    setRows(nextRows);
    try {
      const res = await fetch("/api/admin/supplier-orders/reorder", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: nextRows.map((r) => r.id) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при запис на реда");
    } catch (e: unknown) {
      setRows(prevRows);
      setReorderError(String(e instanceof Error ? e.message : e));
    } finally {
      setReorderBusy(false);
      setDragId(null);
    }
  }

  function handleDragStart(e: DragEvent, id: string) {
    if (!canReorder || reorderBusy) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: DragEvent) {
    if (!canReorder || !dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(targetId: string) {
    if (!canReorder || !dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const next = reorderByDrag(rows, dragId, targetId);
    void persistOrder(next, rows);
  }

  function handleCancelled(orderId: string) {
    setSelectedOrderId(null);
    setRows((prev) => prev.filter((r) => r.id !== orderId));
    void refresh();
    notifyAdminCalendarReload();
  }

  const count = rows.length;
  const dragEnabled = canReorder && !reorderBusy;

  return (
    <>
      <Card className="flex h-full min-h-[280px] flex-col overflow-hidden border-l-4 border-l-violet-500 p-0 shadow-sm ring-1 ring-slate-200/70">
        <div className="shrink-0 border-b border-slate-100 bg-violet-50/60 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 text-violet-600" />
                <div className="text-sm font-bold text-slate-900">Поръчки</div>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {canReorder
                  ? "Кликнете за подробности или плъзнете ⋮⋮ за промяна на реда."
                  : "Климатици чакащи доставка. Кликнете върху поръчка за подробности."}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-violet-800">
              {count}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          {reorderError ? (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-800">
              {reorderError}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 space-y-2">
            {count === 0 ? (
              <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-4 py-6 text-center text-sm text-violet-700/70">
                Няма активни поръчки от доставчик.
              </div>
            ) : (
              rows.map((row) => {
                const isDragging = dragId === row.id;
                return (
                  <div
                    key={row.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(row.id);
                    }}
                    className={`flex items-stretch gap-1 rounded-xl border bg-white shadow-sm transition-all ${
                      isDragging
                        ? "border-violet-400 opacity-60 ring-2 ring-violet-200"
                        : "border-slate-200/80 hover:border-violet-300 hover:shadow-md"
                    }`}
                  >
                    {canReorder ? (
                      <button
                        type="button"
                        draggable={dragEnabled}
                        disabled={reorderBusy}
                        onDragStart={(e) => handleDragStart(e, row.id)}
                        onDragEnd={() => setDragId(null)}
                        className="flex shrink-0 cursor-grab items-center px-1.5 text-slate-400 active:cursor-grabbing disabled:opacity-40"
                        title="Плъзнете за промяна на реда"
                        aria-label="Промени ред"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => !readOnly && setSelectedOrderId(row.id)}
                      className="min-w-0 flex-1 px-2 py-2.5 text-left disabled:cursor-default disabled:opacity-70"
                    >
                      <p className="text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
                        {displayName(row)}
                      </p>
                      <AdminContactMetaLine
                        name={row.customer_name ?? row.contacts?.full_name}
                        phone={row.customer_phone ?? row.contacts?.phone}
                        className="mt-1 block text-xs text-slate-500"
                      />
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {row.due_date
                          ? `Поръчано: ${formatBgDate(row.due_date)}`
                          : `Добавено: ${formatBgDateTime(row.created_at)}`}
                        {row.unit_price != null ? ` · €${Number(row.unit_price).toLocaleString()}` : ""}
                      </p>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3 shrink-0 border-t border-slate-100 pt-3">
            {readOnly ? (
              <p className="text-xs text-slate-400">Пълният списък е достъпен за офис и администратор.</p>
            ) : (
              <a
                href="/admin/supplier-orders"
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800"
              >
                Пълна хронология
                <ChevronRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </Card>

      {selectedOrderId && (
        <SupplierOrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onCancelled={handleCancelled}
          onUpdated={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            notifyAdminCalendarReload();
          }}
          onFulfilled={() => {
            setSelectedOrderId(null);
            void refresh();
            notifyAdminCalendarReload();
          }}
        />
      )}
    </>
  );
}
