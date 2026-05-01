"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Button, Select, Input, Textarea } from "./ui";
import { CalendarDays, List } from "lucide-react";

type EventCode =
  | "item_added"
  | "item_removed"
  | "sale"
  | "service_installation"
  | "service_inspection"
  | "service_repair"
  | "service_maintenance";

type WorkItem = {
  id: string;
  type: "sale" | "service" | "stock_in" | "stock_out" | "task";
  event_code?: EventCode | null;
  status: "planned" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
  title: string;
  notes?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_amount?: number | null;
  due_date?: string | null;
};

type WorkForm = {
  type: WorkItem["type"];
  eventCode: EventCode;
  title: string;
  dueDate: string;
  priority: WorkItem["priority"];
  status: WorkItem["status"];
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
};

const TYPE_LABEL: Record<WorkItem["type"], string> = {
  sale: "Продажба",
  service: "Услуга",
  stock_in: "Зареждане",
  stock_out: "Изход",
  task: "Задача",
};

const TYPE_COLOR: Record<WorkItem["type"], string> = {
  sale: "#0ea5e9",
  service: "#8b5cf6",
  stock_in: "#10b981",
  stock_out: "#f97316",
  task: "#64748b",
};

const EVENT_OPTIONS: Array<{ id: EventCode; label: string; type: WorkItem["type"] }> = [
  { id: "item_added", label: "Добавяне на артикул", type: "stock_in" },
  { id: "item_removed", label: "Премахване на артикул", type: "stock_out" },
  { id: "sale", label: "Продажба", type: "sale" },
  { id: "service_installation", label: "Услуга: монтаж", type: "service" },
  { id: "service_inspection", label: "Услуга: оглед", type: "service" },
  { id: "service_repair", label: "Услуга: сервиз", type: "service" },
  { id: "service_maintenance", label: "Услуга: профилактика", type: "service" },
];

function createDefaultForm(date = ""): WorkForm {
  return {
    type: "service",
    eventCode: "service_installation",
    title: "",
    dueDate: date,
    priority: "medium",
    status: "planned",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    notes: "",
    quantity: "1",
    unitPrice: "",
    totalAmount: "",
  };
}

export function WorkItemsPlanner() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<WorkForm>(createDefaultForm());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<WorkForm>(createDefaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<WorkForm>(createDefaultForm());
  const [savingBusy, setSavingBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "sales" | "services" | "stock">("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"calendar" | "agenda">("calendar");

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const title = monthStart.toLocaleDateString("bg-BG", { month: "long", year: "numeric" });

  const monthFrom = formatDateKey(monthStart);
  const monthTo = formatDateKey(monthEnd);

  async function load() {
    setError(null);
    const workRes = await fetch(`/api/admin/work-items?from=${monthFrom}&to=${monthTo}&perPage=500`, { credentials: "include" });
    const workJson = await workRes.json().catch(() => ({}));
    if (!workRes.ok) {
      setError((workJson as any).error || "Грешка при зареждане");
      return;
    }
    setItems((workJson as any).data ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  const byDate = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const item of items) {
      const key = String(item.due_date ?? "").slice(0, 10);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const agendaItems = useMemo(() => {
    return [...items]
      .filter(matchesViewMode)
      .sort((a, b) => String(a.due_date ?? "").localeCompare(String(b.due_date ?? "")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, viewMode]);

  const agendaByDate = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const item of agendaItems) {
      const key = String(item.due_date ?? "").slice(0, 10);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [agendaItems]);

  const agendaDates = [...agendaByDate.keys()].sort();

  const days: Date[] = [];
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  for (let i = 0; i < firstWeekday; i++) days.push(new Date(NaN));
  for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
  while (days.length % 7 !== 0) days.push(new Date(NaN));

  function matchesViewMode(item: WorkItem) {
    if (viewMode === "all") return true;
    if (viewMode === "sales") return item.event_code === "sale";
    if (viewMode === "services") {
      return (
        item.event_code === "service_installation" ||
        item.event_code === "service_inspection" ||
        item.event_code === "service_repair" ||
        item.event_code === "service_maintenance"
      );
    }
    return item.event_code === "item_added" || item.event_code === "item_removed";
  }

  const selectedItems = selectedDate ? (byDate.get(selectedDate) ?? []).filter(matchesViewMode) : [];

  async function createFromForm(localForm: WorkForm) {
    if (!localForm.title.trim() || !localForm.dueDate) return false;
    const res = await fetch("/api/admin/work-items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(localForm)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при създаване");
      return false;
    }
    return true;
  }

  async function createItem() {
    setError(null);
    const ok = await createFromForm(form);
    if (!ok) return;
    setCreating(false);
    setForm(createDefaultForm());
    await load();
  }

  async function createItemInDay() {
    setError(null);
    setSavingBusy(true);
    try {
      const ok = await createFromForm(addForm);
      if (!ok) return;
      setAddForm(createDefaultForm(selectedDate ?? ""));
      await load();
    } finally {
      setSavingBusy(false);
    }
  }

  function openDay(dateKey: string) {
    setSelectedDate(dateKey);
    setAddForm(createDefaultForm(dateKey));
    setEditingId(null);
    setEditForm(createDefaultForm(dateKey));
  }

  function closeDayModal() {
    setSelectedDate(null);
    setEditingId(null);
  }

  function startEdit(item: WorkItem) {
    setEditingId(item.id);
    setEditForm({
      type: item.type,
      eventCode: (item.event_code ?? inferEventCode(item.type)) as EventCode,
      title: item.title ?? "",
      dueDate: String(item.due_date ?? "").slice(0, 10),
      priority: item.priority,
      status: item.status,
      customerName: item.customer_name ?? "",
      customerPhone: item.customer_phone ?? "",
      customerAddress: item.customer_address ?? "",
      notes: item.notes ?? "",
      quantity: String(item.quantity ?? 1),
      unitPrice: item.unit_price != null ? String(item.unit_price) : "",
      totalAmount: item.total_amount != null ? String(item.total_amount) : "",
    });
  }

  async function saveEdit(itemId: string) {
    if (!editForm.title.trim() || !editForm.dueDate) return;
    setSavingBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${itemId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editForm)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as any).error || "Грешка при редакция");
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setSavingBusy(false);
    }
  }

  async function removeItem(itemId: string) {
    if (confirmDeleteId !== itemId) {
      setConfirmDeleteId(itemId);
      return;
    }
    setSavingBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as any).error || "Грешка при изтриване");
        return;
      }
      setConfirmDeleteId(null);
      if (editingId === itemId) setEditingId(null);
      await load();
    } finally {
      setSavingBusy(false);
    }
  }

  return (
    <Card className="mt-3 p-3">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 leading-tight">Оперативен календар</div>
          <div className="text-xs text-slate-500 capitalize leading-tight">{title}</div>
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap justify-end items-center">
          {/* Mobile view toggle */}
          <div className="flex md:hidden border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDisplayMode("agenda")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors ${displayMode === "agenda" ? "bg-sky-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <List className="w-3.5 h-3.5" /> Списък
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("calendar")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors ${displayMode === "calendar" ? "bg-sky-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Кал.
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setMonthOffset((x) => x - 1)}>◀</Button>
          <Button variant="secondary" size="sm" onClick={() => setMonthOffset(0)}>Днес</Button>
          <Button variant="secondary" size="sm" onClick={() => setMonthOffset((x) => x + 1)}>▶</Button>
          <Button variant="primary" size="sm" onClick={() => setCreating((v) => !v)}>+ Събитие</Button>
        </div>
      </div>

      {/* View mode filters */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {[
          { id: "all", label: "Всички" },
          { id: "sales", label: "Продажби" },
          { id: "services", label: "Услуги" },
          { id: "stock", label: "Склад" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setViewMode(m.id as typeof viewMode)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors ${
              viewMode === m.id
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Quick create form */}
      {creating && (
        <div className="border border-slate-200 rounded-xl p-3 mb-3 bg-slate-50">
          <div className="text-xs font-bold text-slate-700 mb-2">Бързо добавяне на събитие</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            <FormField label="Тип събитие"><EventSelect form={form} setForm={setForm} /></FormField>
            <FormField label="Заглавие"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></FormField>
            <FormField label="Дата"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></FormField>
            <FormField label="Статус"><StatusSelect form={form} setForm={setForm} /></FormField>
            <FormField label="Приоритет"><PrioritySelect form={form} setForm={setForm} /></FormField>
            <FormField label="Контактно лице"><Input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} /></FormField>
            <FormField label="Телефон"><Input value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} /></FormField>
            <FormField label="Адрес"><Input value={form.customerAddress} onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))} /></FormField>
            <FormField label="Брой"><Input value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} type="number" min={1} /></FormField>
            <FormField label="Единична цена"><Input value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} type="number" min={0} /></FormField>
            <FormField label="Обща сума"><Input value={form.totalAmount} onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))} type="number" min={0} /></FormField>
            <FormField label="Бележки" full><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="min-h-[3rem]" /></FormField>
            <div className="col-span-full flex justify-end">
              <Button variant="primary" onClick={() => void createItem()}>Запази събитие</Button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 mb-2 text-xs font-medium">{error}</div>}

      {/* DESKTOP: Calendar grid (always visible on md+, hidden on mobile when agenda mode) */}
      <div className={`${displayMode === "agenda" ? "hidden md:block" : "block"}`}>
        <div className="grid grid-cols-7 gap-1">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
            <div key={d} className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-wide">{d}</div>
          ))}
          {days.map((d, idx) => {
            const valid = !Number.isNaN(d.getTime());
            const dateKey = valid ? formatDateKey(d) : "";
            const dayItems = valid ? (byDate.get(dateKey) ?? []).filter(matchesViewMode) : [];
            const isToday = valid && dateKey === formatDateKey(new Date());
            return (
              <button
                key={idx}
                type="button"
                onClick={() => valid && openDay(dateKey)}
                className={`min-h-[52px] md:min-h-[64px] border rounded-md p-1 md:p-1.5 text-left transition-colors ${
                  valid
                    ? isToday
                      ? "border-sky-400 bg-sky-50 hover:border-sky-500 cursor-pointer"
                      : "border-slate-200 bg-white hover:border-sky-300 cursor-pointer"
                    : "border-transparent bg-slate-50 cursor-default"
                }`}
                disabled={!valid}
              >
                {valid && (
                  <>
                    <div className={`text-[11px] font-bold mb-0.5 tabular-nums ${isToday ? "text-sky-700" : "text-slate-700"}`}>{d.getDate()}</div>
                    <div className="grid gap-0.5">
                      {dayItems.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="text-[9px] font-medium leading-tight border-l-2 pl-1 text-slate-800 truncate opacity-90"
                          style={{ borderLeftColor: eventColor(item) }}
                          title={`${eventCodeLabel(item)} (${statusLabel(item.status)})`}
                        >
                          {eventCodeLabel(item)}
                        </div>
                      ))}
                      {dayItems.length > 2 && <div className="text-[9px] text-slate-500 font-medium">+{dayItems.length - 2}</div>}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-medium text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" /> Продажби</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Добавени</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" /> Премахнати</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" /> Услуги</span>
        </div>
      </div>

      {/* MOBILE: Agenda view */}
      <div className={`${displayMode === "agenda" ? "block md:hidden" : "hidden"}`}>
        {agendaItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">Няма събития за {title}.</div>
        ) : (
          <div className="space-y-3">
            {agendaDates.map((dateKey) => {
              const dayEvts = agendaByDate.get(dateKey) ?? [];
              const d = new Date(`${dateKey}T00:00:00`);
              const isToday = dateKey === formatDateKey(new Date());
              return (
                <div key={dateKey}>
                  <button
                    type="button"
                    onClick={() => openDay(dateKey)}
                    className="w-full text-left"
                  >
                    <div className={`text-xs font-bold mb-1.5 px-1 ${isToday ? "text-sky-700" : "text-slate-500"}`}>
                      {d.toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" })}
                      {isToday && " · Днес"}
                    </div>
                  </button>
                  <div className="space-y-1.5">
                    {dayEvts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openDay(dateKey)}
                        className="w-full text-left bg-white rounded-xl border border-slate-200 px-3 py-3 flex items-start gap-3 hover:border-sky-200 active:bg-slate-50 transition-colors shadow-sm"
                      >
                        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: eventColor(item) }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900 leading-tight">{item.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{eventCodeLabel(item)}</div>
                          {(item.customer_name || item.customer_phone) && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {[item.customer_name, item.customer_phone].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        <span className={statusPillClass(item.status)}>{statusLabel(item.status)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Day modal — bottom sheet on mobile, centered panel on desktop */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-start justify-center md:overflow-y-auto bg-slate-900/40 md:p-4 backdrop-blur-sm"
          onClick={() => !savingBusy && closeDayModal()}
        >
          <div
            className="w-full max-h-[92vh] md:max-h-[calc(100vh-2rem)] md:my-4 md:max-w-6xl flex flex-col overflow-hidden rounded-t-3xl md:rounded-xl border border-slate-200 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.2)] md:shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle - mobile only */}
            <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-5 md:py-4">
              <div className="min-w-0">
                <h2 className="text-base md:text-xl font-semibold text-slate-900 leading-tight">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("bg-BG", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <p className="mt-0.5 text-xs md:text-sm text-slate-500">
                  {selectedItems.length} {selectedItems.length === 1 ? "събитие" : "събития"}
                  {selectedItems.filter((x) => x.event_code === "sale").length > 0 && (
                    <> · {selectedItems.filter((x) => x.event_code === "sale").length} продажби</>
                  )}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={closeDayModal}>
                Затвори
              </Button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-200 overflow-hidden lg:flex-row lg:divide-x lg:divide-y-0">
              {/* Само тук има вертикален скрол — списъкът със събития */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white p-4 lg:max-w-none">
                <h3 className="mb-3 shrink-0 text-sm font-semibold text-slate-800">Събития за деня</h3>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                  {selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-200 border-l-[3px] bg-white p-4 transition-colors hover:border-slate-300"
                      style={{ borderLeftColor: eventColor(item) }}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-500">{eventCodeLabel(item)}</div>
                          <div className="mt-0.5 text-base font-semibold text-slate-900">{item.title}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          <span className={statusPillClass(item.status)}>{statusLabel(item.status)}</span>
                          <Button variant="secondary" size="sm" onClick={() => startEdit(item)}>
                            Редакция
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => void removeItem(item.id)}>
                            Изтрий
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-slate-600">
                        {[item.customer_name, item.customer_phone, item.customer_address].filter(Boolean).join(" · ") || "Без контакт"}
                      </div>
                      {item.notes && <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{item.notes}</div>}

                      {editingId === item.id && (
                        <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                          <FormField label="Тип събитие"><EventSelect form={editForm} setForm={setEditForm} /></FormField>
                          <FormField label="Заглавие"><Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></FormField>
                          <FormField label="Дата"><Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} /></FormField>
                          <FormField label="Статус"><StatusSelect form={editForm} setForm={setEditForm} /></FormField>
                          <FormField label="Приоритет"><PrioritySelect form={editForm} setForm={setEditForm} /></FormField>
                          <FormField label="Контактно лице"><Input value={editForm.customerName} onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))} /></FormField>
                          <FormField label="Телефон"><Input value={editForm.customerPhone} onChange={(e) => setEditForm((f) => ({ ...f, customerPhone: e.target.value }))} /></FormField>
                          <FormField label="Адрес"><Input value={editForm.customerAddress} onChange={(e) => setEditForm((f) => ({ ...f, customerAddress: e.target.value }))} /></FormField>
                          <FormField label="Брой"><Input type="number" min={1} value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))} /></FormField>
                          <FormField label="Единична цена"><Input type="number" min={0} value={editForm.unitPrice} onChange={(e) => setEditForm((f) => ({ ...f, unitPrice: e.target.value }))} /></FormField>
                          <FormField label="Обща сума"><Input type="number" min={0} value={editForm.totalAmount} onChange={(e) => setEditForm((f) => ({ ...f, totalAmount: e.target.value }))} /></FormField>
                          <FormField label="Бележки" full><Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="min-h-[2.75rem]" /></FormField>
                          <div className="col-span-full flex gap-2 mt-2">
                            <Button variant="primary" onClick={() => void saveEdit(item.id)} disabled={savingBusy}>
                              {savingBusy ? "Запис..." : "Запази"}
                            </Button>
                            <Button variant="secondary" onClick={() => setEditingId(null)} disabled={savingBusy}>Отказ</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedItems.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">Няма събития за този ден.</div>
                  )}
                </div>
              </div>

              {/* Без скрол — компактни полета; фиксирана ширина на широк екран */}
              <div className="shrink-0 overflow-hidden bg-slate-50/90 p-3 lg:w-[320px] lg:max-w-[34%] xl:w-[340px]">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ново събитие</h3>
                <div
                  className="grid grid-cols-1 gap-2 md:grid-cols-2 [&_label]:gap-1 [&_label>span]:text-[10px] [&_label>span]:font-medium [&_label>span]:text-slate-500 [&_input]:!min-h-0 [&_input]:!rounded-md [&_input]:!px-2 [&_input]:!py-1 [&_input]:!text-[11px] [&_select]:!rounded-md [&_select]:!px-2 [&_select]:!py-1 [&_select]:!text-[11px] [&_textarea]:!rounded-md [&_textarea]:!px-2 [&_textarea]:!py-1 [&_textarea]:!text-[11px] [&_textarea]:!min-h-[2.25rem]"
                >
                  <FormField label="Тип събитие"><EventSelect form={addForm} setForm={setAddForm} /></FormField>
                  <FormField label="Заглавие"><Input value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} /></FormField>
                  <FormField label="Дата"><Input type="date" value={addForm.dueDate} onChange={(e) => setAddForm((f) => ({ ...f, dueDate: e.target.value }))} /></FormField>
                  <FormField label="Статус"><StatusSelect form={addForm} setForm={setAddForm} /></FormField>
                  <FormField label="Приоритет"><PrioritySelect form={addForm} setForm={setAddForm} /></FormField>
                  <FormField label="Контактно лице"><Input value={addForm.customerName} onChange={(e) => setAddForm((f) => ({ ...f, customerName: e.target.value }))} /></FormField>
                  <FormField label="Телефон"><Input value={addForm.customerPhone} onChange={(e) => setAddForm((f) => ({ ...f, customerPhone: e.target.value }))} /></FormField>
                  <FormField label="Адрес" full><Input value={addForm.customerAddress} onChange={(e) => setAddForm((f) => ({ ...f, customerAddress: e.target.value }))} /></FormField>
                  <FormField label="Брой"><Input type="number" min={1} value={addForm.quantity} onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))} /></FormField>
                  <FormField label="Единична цена"><Input type="number" min={0} value={addForm.unitPrice} onChange={(e) => setAddForm((f) => ({ ...f, unitPrice: e.target.value }))} /></FormField>
                  <FormField label="Обща сума" full><Input type="number" min={0} value={addForm.totalAmount} onChange={(e) => setAddForm((f) => ({ ...f, totalAmount: e.target.value }))} /></FormField>
                  <FormField label="Бележки" full><Textarea value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></FormField>
                  <div className="col-span-full shrink-0 pt-1">
                    <Button variant="primary" size="sm" className="w-full !py-2 !text-xs" type="button" onClick={() => void createItemInDay()} disabled={savingBusy}>
                      {savingBusy ? "Записване…" : "Добави събитие"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center md:p-4 bg-slate-950/55 backdrop-blur-md" onClick={() => setConfirmDeleteId(null)}>
          <div className="w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-white/70 bg-white p-6 shadow-[0_-8px_40px_rgba(15,23,42,0.25)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
            <div className="text-xl font-black text-slate-950">Изтриване на събитие</div>
            <div className="mt-2 text-sm text-slate-500">Сигурни ли сте, че искате да изтриете това събитие от календара?</div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDeleteId(null)} disabled={savingBusy}>Отказ</Button>
              <Button variant="danger" onClick={() => void removeItem(confirmDeleteId)} disabled={savingBusy}>Изтрий</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function FormField({ label, full = false, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 ${full ? "col-span-full" : ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function EventSelect({ form, setForm }: { form: WorkForm; setForm: React.Dispatch<React.SetStateAction<WorkForm>> }) {
  return (
    <Select
      value={form.eventCode}
      onChange={(e) => {
        const eventCode = e.target.value as EventCode;
        const matched = EVENT_OPTIONS.find((x) => x.id === eventCode);
        setForm((f) => ({ ...f, eventCode, type: matched?.type ?? f.type }));
      }}
    >
      {EVENT_OPTIONS.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}

function StatusSelect({ form, setForm }: { form: WorkForm; setForm: React.Dispatch<React.SetStateAction<WorkForm>> }) {
  return (
    <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as WorkItem["status"] }))}>
      <option value="planned">Чака</option>
      <option value="in_progress">В процес</option>
      <option value="done">Изпълнена</option>
      <option value="cancelled">Отказана</option>
    </Select>
  );
}

function PrioritySelect({ form, setForm }: { form: WorkForm; setForm: React.Dispatch<React.SetStateAction<WorkForm>> }) {
  return (
    <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as WorkItem["priority"] }))}>
      <option value="low">Нисък</option>
      <option value="medium">Среден</option>
      <option value="high">Висок</option>
    </Select>
  );
}

function toPayload(form: WorkForm) {
  return {
    type: form.type,
    eventCode: form.eventCode,
    title: form.title.trim(),
    dueDate: form.dueDate,
    priority: form.priority,
    status: form.status,
    customerName: form.customerName.trim() || null,
    customerPhone: form.customerPhone.trim() || null,
    customerAddress: form.customerAddress.trim() || null,
    notes: form.notes.trim() || null,
    quantity: Number(form.quantity || 1),
    unitPrice: form.unitPrice.trim() ? Number(form.unitPrice) : null,
    totalAmount: form.totalAmount.trim() ? Number(form.totalAmount) : null,
  };
}

function inferEventCode(type: WorkItem["type"]): EventCode {
  if (type === "sale") return "sale";
  if (type === "stock_in") return "item_added";
  if (type === "stock_out") return "item_removed";
  return "service_repair";
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eventCodeLabel(item: WorkItem): string {
  switch (item.event_code) {
    case "item_added":
      return "Добавяне на артикул";
    case "item_removed":
      return "Премахване на артикул";
    case "sale":
      return "Продажба";
    case "service_installation":
      return "Услуга: монтаж";
    case "service_inspection":
      return "Услуга: оглед";
    case "service_repair":
      return "Услуга: сервиз";
    case "service_maintenance":
      return "Услуга: профилактика";
    default:
      return `${TYPE_LABEL[item.type]}: ${item.title}`;
  }
}

function statusLabel(status: WorkItem["status"]): string {
  if (status === "done") return "Изпълнена";
  if (status === "in_progress") return "В процес";
  if (status === "cancelled") return "Отказана";
  return "Чака";
}

function statusPillClass(status: WorkItem["status"]): string {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-sky-100 border-sky-200 text-sky-800`;
  if (status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-amber-100 border-amber-200 text-amber-800`;
}

function eventColor(item: WorkItem): string {
  if (item.event_code === "item_added") return "#10b981"; // green-500
  if (item.event_code === "item_removed") return "#f97316"; // orange-500
  if (item.event_code === "sale") return "#0ea5e9"; // sky-500
  if (
    item.event_code === "service_installation" ||
    item.event_code === "service_inspection" ||
    item.event_code === "service_repair" ||
    item.event_code === "service_maintenance"
  ) return "#8b5cf6"; // violet-500
  return TYPE_COLOR[item.type];
}
