"use client";

import type { ReactElement, ReactNode } from "react";
import { Eye } from "lucide-react";
import { Button, Table, Th, Td, AdminPhoneLink, AdminTableLoading } from "../ui";
import { ContactNameButton, type ContactHistoryTarget } from "../contacts/ContactHistoryModal";

type ServiceRow = {
  id: string;
  status: "planned" | "in_progress" | "done" | "cancelled";
  title: string;
  contact_id?: string | null;
  contacts?:
    | { id: string; full_name?: string | null; phone?: string | null }
    | Array<{ id: string; full_name?: string | null; phone?: string | null }>
    | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  total_amount?: number | null;
  unit_price?: number | null;
  due_date?: string | null;
  completed_at?: string | null;
};

function contactTargetFromRow(row: ServiceRow): ContactHistoryTarget {
  const embedded = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
  return {
    contactId: embedded?.id ?? row.contact_id ?? null,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? embedded?.phone ?? null,
  };
}

export type ServiceSortField =
  | "status"
  | "customer_name"
  | "customer_phone"
  | "customer_address"
  | "total_amount"
  | "sale_date";

type SortDir = "asc" | "desc";

const STATUS_TEXT: Record<ServiceRow["status"], string> = {
  planned: "Чака",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

function statusPillClass(status: ServiceRow["status"]): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700`;
  if (status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-amber-100 border-amber-200 text-amber-800`;
}

function saleDateDisplay(row: ServiceRow): string {
  const raw = row.completed_at ?? row.due_date ?? null;
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("bg-BG");
  } catch {
    return "—";
  }
}

function SortableTh({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
  className = "",
}: {
  label: string;
  field: ServiceSortField;
  sortBy: ServiceSortField;
  sortDir: SortDir;
  onSort: (f: ServiceSortField) => void;
  className?: string;
}) {
  const isActive = sortBy === field;
  return (
    <Th className={`p-0 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`w-full px-3 py-2 inline-flex items-center gap-0.5 text-left text-xs font-bold transition-colors hover:bg-slate-100 ${
          isActive ? "text-brand-blue-700 bg-brand-blue-50/60" : "text-slate-600"
        }`}
      >
        <span className="truncate">{label}</span>
      </button>
    </Th>
  );
}

export function ServiceSalesTable({
  items,
  sortBy,
  sortDir,
  onSort,
  onDetail,
  onContactOpen,
  emptyMessage,
  loading = false,
}: {
  items: ServiceRow[];
  sortBy: ServiceSortField;
  sortDir: SortDir;
  onSort: (f: ServiceSortField) => void;
  onDetail: (id: string) => void;
  onContactOpen?: (target: ContactHistoryTarget) => void;
  emptyMessage: string;
  loading?: boolean;
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table loading={loading}>
          <thead>
            <tr>
              <Th>Заглавие</Th>
              <SortableTh label="Статус" field="status" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableTh label="Контакт" field="customer_name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableTh label="Телефон" field="customer_phone" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableTh label="Адрес" field="customer_address" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableTh label="Цена (€)" field="total_amount" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableTh label="Дата" field="sale_date" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const amount = row.total_amount ?? row.unit_price;
              return (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <Td className="font-medium text-slate-800 max-w-[220px] truncate" title={row.title}>
                    {row.title}
                  </Td>
                  <Td>
                    <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status]}</span>
                  </Td>
                  <Td>
                    {onContactOpen ? (
                      <ContactNameButton
                        name={row.customer_name}
                        contactId={contactTargetFromRow(row).contactId}
                        customerPhone={row.customer_phone}
                        onOpen={onContactOpen}
                        className="text-sm text-slate-700"
                      />
                    ) : (
                      <span className="font-medium text-slate-700">{row.customer_name || "—"}</span>
                    )}
                  </Td>
                  <Td className="text-slate-600">
                    <AdminPhoneLink phone={row.customer_phone} showIcon={false} className="font-medium text-slate-600" />
                  </Td>
                  <Td className="text-slate-600 max-w-[180px] truncate" title={row.customer_address ?? ""}>
                    {row.customer_address || "—"}
                  </Td>
                  <Td className="font-semibold text-slate-900">
                    {amount != null ? `€${Number(amount).toLocaleString()}` : "—"}
                  </Td>
                  <Td className="text-xs text-slate-500 font-medium">{saleDateDisplay(row)}</Td>
                  <Td className="text-right">
                    <Button variant="secondary" size="sm" className="!text-xs font-bold" onClick={() => onDetail(row.id)}>
                      <Eye className="w-3.5 h-3.5 inline mr-1" />
                      Детайли
                    </Button>
                  </Td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr>
                <Td colSpan={8} className="text-center py-8 text-slate-500">
                  {emptyMessage}
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <div className="md:hidden space-y-2">
        {loading ? (
          <AdminTableLoading />
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">{emptyMessage}</div>
        ) : (
        items.map((row) => {
          const amount = row.total_amount ?? row.unit_price;
          return (
            <div key={row.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">{row.title}</div>
                  <div className="mt-1">
                    {onContactOpen ? (
                      <ContactNameButton
                        name={row.customer_name}
                        contactId={contactTargetFromRow(row).contactId}
                        customerPhone={row.customer_phone}
                        onOpen={onContactOpen}
                        className="font-semibold text-slate-700 text-sm"
                      />
                    ) : (
                      <div className="font-semibold text-slate-700 text-sm">{row.customer_name || "—"}</div>
                    )}
                  </div>
                  {row.customer_phone && (
                    <AdminPhoneLink
                      phone={row.customer_phone}
                      className="text-xs font-medium mt-0.5 block"
                      showIcon={false}
                    />
                  )}
                  {row.customer_address && <div className="text-xs text-slate-500 mt-0.5">{row.customer_address}</div>}
                </div>
                <div className="text-right shrink-0">
                  {amount != null ? (
                    <div className="text-lg font-black text-slate-900">€{Number(amount).toLocaleString()}</div>
                  ) : (
                    <div className="text-sm text-slate-400">—</div>
                  )}
                  <div className="mt-1">
                    <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                <span className="text-xs text-slate-400 font-medium">{saleDateDisplay(row)}</span>
                <Button variant="secondary" size="sm" className="font-bold !text-xs" onClick={() => onDetail(row.id)}>
                  Детайли
                </Button>
              </div>
            </div>
          );
        })
        )}
      </div>
    </>
  );
}

export function ServiceStatusChips({
  statuses,
  onToggle,
  ChipToggle,
}: {
  statuses: ServiceRow["status"][];
  onToggle: (s: ServiceRow["status"]) => void;
  ChipToggle: (props: {
    active: boolean;
    tone?: "neutral" | "success" | "warning" | "danger" | "brand" | "amber";
    onClick: () => void;
    children: ReactNode;
  }) => ReactElement;
}) {
  const chips: Array<{ id: ServiceRow["status"]; label: string; tone?: "warning" | "brand" | "success" | "danger" }> = [
    { id: "planned", label: "Чака", tone: "warning" },
    { id: "in_progress", label: "В процес", tone: "brand" },
    { id: "done", label: "Изпълнена", tone: "success" },
    { id: "cancelled", label: "Отказана", tone: "danger" },
  ];
  return (
    <>
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Статус:</span>
      {chips.map((c) => (
        <ChipToggle key={c.id} active={statuses.includes(c.id)} tone={c.tone} onClick={() => onToggle(c.id)}>
          {c.label}
        </ChipToggle>
      ))}
    </>
  );
}
