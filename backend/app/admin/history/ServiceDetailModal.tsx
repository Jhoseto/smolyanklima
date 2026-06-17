"use client";

import { useEffect, useState } from "react";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";
import { Button, AdminFieldValue } from "../ui";
import { PAID_SERVICE_EVENT_LABELS, type PaidServiceEventCode } from "@/lib/admin/serviceEventCodes";

type ServiceRow = {
  id: string;
  event_code?: PaidServiceEventCode | null;
  status: "planned" | "in_progress" | "done" | "cancelled";
  title: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  total_amount?: number | null;
  unit_price?: number | null;
  due_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
};

const STATUS_TEXT: Record<ServiceRow["status"], string> = {
  planned: "Чака",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("bg-BG");
  } catch {
    return "—";
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 break-words">
        <AdminFieldValue label={label} value={value || "—"} />
      </div>
    </div>
  );
}

export function ServiceDetailModal({
  serviceId,
  onClose,
}: {
  serviceId: string | null;
  onClose: () => void;
}) {
  const [row, setRow] = useState<ServiceRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useAdminBackHandler(Boolean(serviceId), onClose, serviceId ? `service-detail-${serviceId}` : undefined);

  useEffect(() => {
    if (!serviceId) {
      setRow(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/work-items/${serviceId}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Грешка");
        // API returns { data: { work_item, linked_sale, ... } }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!cancelled) setRow((json.data as any)?.work_item ?? null);
      } catch (e: unknown) {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  if (!serviceId) return null;

  const amount = row?.total_amount ?? row?.unit_price;
  const serviceLabel =
    row?.event_code && row.event_code in PAID_SERVICE_EVENT_LABELS
      ? PAID_SERVICE_EVENT_LABELS[row.event_code]
      : "Услуга";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/50 p-0 md:p-4 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl md:rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 pb-safe md:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-2 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="text-lg font-black text-slate-900">{serviceLabel}</div>
        {loading && <p className="mt-3 text-sm text-slate-500">Зареждане…</p>}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {row && !loading && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Заглавие" value={row.title} />
            <Field label="Статус" value={STATUS_TEXT[row.status]} />
            <Field label="Клиент" value={row.customer_name ?? ""} />
            <Field label="Телефон" value={row.customer_phone ?? ""} />
            <div className="sm:col-span-2">
              <Field label="Адрес" value={row.customer_address ?? ""} />
            </div>
            <Field
              label="Цена"
              value={amount != null ? `€${Number(amount).toLocaleString("bg-BG", { minimumFractionDigits: 2 })}` : "—"}
            />
            <Field label="Дата" value={fmtDate(row.completed_at ?? row.due_date)} />
            {row.notes?.trim() && (
              <div className="sm:col-span-2">
                <Field label="Бележки" value={row.notes.trim()} />
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Затвори
          </Button>
        </div>
      </div>
    </div>
  );
}
