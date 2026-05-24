"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Button, Select, Input, Textarea } from "./ui";
import { ContactPersonPicker } from "./ContactPersonPicker";
import { InstallationMountDetailModal } from "./InstallationMountDetailModal";
import { SupplierOrderDetailModal } from "./SupplierOrderDetailModal";
import { CalendarDays, CheckCircle2, List } from "lucide-react";
import { notifyFollowUpCallsChanged } from "@/lib/admin/follow-up-calls-events";

type EventCode =
  | "item_added"
  | "item_removed"
  | "sale"
  | "service_installation"
  | "service_maintenance"
  | "service_on_site"
  | "service_in_shop"
  | "consultation"
  | "supplier_order";

type WorkItem = {
  id: string;
  type: "sale" | "service" | "stock_in" | "stock_out" | "task";
  contact_id?: string | null;
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
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  product_id?: string | null;
  sale_work_item_id?: string | null;
  products?: { id?: string; name?: string; slug?: string } | null;
};

type WorkForm = {
  type: WorkItem["type"];
  eventCode: EventCode;
  title: string;
  dueDate: string;
  priority: WorkItem["priority"];
  status: WorkItem["status"];
  /** CRM контакт (UUID), празно ако е свободен текст */
  contactId: string;
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

/** Ръчно създавани типове в календара (без продажби; склад от каталога е само автоматичен). */
const PLANNER_CREATABLE_EVENT_OPTIONS: Array<{ id: EventCode; label: string; type: WorkItem["type"] }> = [
  { id: "service_installation", label: "Монтаж", type: "service" },
  { id: "service_maintenance", label: "Профилактика", type: "service" },
  { id: "service_on_site", label: "Сервиз на терен", type: "service" },
  { id: "service_in_shop", label: "Сервиз в склад", type: "service" },
  { id: "consultation", label: "Консултация", type: "task" },
];

/** Типове събития в календара — multi on/off филтри (по подразбиране всички включени). */
const CALENDAR_EVENT_FILTERS: Array<{ id: EventCode; label: string }> = [
  { id: "item_added", label: "Добавяне на продукт" },
  { id: "item_removed", label: "Премахване на продукт" },
  { id: "service_installation", label: "Монтаж" },
  { id: "service_maintenance", label: "Профилактика" },
  { id: "service_on_site", label: "Сервиз на терен" },
  { id: "service_in_shop", label: "Сервиз в склад" },
  { id: "consultation", label: "Консултация" },
  { id: "supplier_order", label: "Поръчка от доставчик" },
];

const ALL_CALENDAR_FILTER_IDS = CALENDAR_EVENT_FILTERS.map((f) => f.id);

/** Запомня избора между табове/екрани; липса на ключ = първо посещение → всички включени. */
const CALENDAR_EVENT_FILTERS_STORAGE_KEY = "sk-admin-calendar-event-filters";
const CALENDAR_EVENT_FILTERS_STORAGE_VERSION = 2;

type StoredCalendarFiltersPayload = {
  v: number;
  enabled: EventCode[];
};

function createAllCalendarFiltersEnabled(): Set<EventCode> {
  return new Set(ALL_CALENDAR_FILTER_IDS);
}

function areAllCalendarFiltersEnabled(enabled: Set<EventCode>) {
  return ALL_CALENDAR_FILTER_IDS.every((id) => enabled.has(id));
}

function isCalendarFilterId(value: unknown): value is EventCode {
  return typeof value === "string" && ALL_CALENDAR_FILTER_IDS.includes(value as EventCode);
}

/** Стари записи без supplier_order — добавяме го само ако потребителят е имал всички останали включени. */
function migrateLegacyCalendarFilters(set: Set<EventCode>): Set<EventCode> {
  const withoutSupplier = ALL_CALENDAR_FILTER_IDS.filter((id) => id !== "supplier_order");
  const hadAllOldTypes =
    withoutSupplier.every((id) => set.has(id)) && !set.has("supplier_order");
  if (hadAllOldTypes) set.add("supplier_order");
  return set;
}

function loadCalendarEventFiltersFromStorage(): Set<EventCode> {
  if (typeof window === "undefined") return createAllCalendarFiltersEnabled();
  try {
    const raw = localStorage.getItem(CALENDAR_EVENT_FILTERS_STORAGE_KEY);
    if (raw === null) return createAllCalendarFiltersEnabled();
    const parsed: unknown = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const set = new Set(parsed.filter(isCalendarFilterId));
      return migrateLegacyCalendarFilters(set);
    }

    if (parsed && typeof parsed === "object" && "enabled" in parsed) {
      const payload = parsed as StoredCalendarFiltersPayload;
      if (Array.isArray(payload.enabled)) {
        return new Set(payload.enabled.filter(isCalendarFilterId));
      }
    }

    return createAllCalendarFiltersEnabled();
  } catch {
    return createAllCalendarFiltersEnabled();
  }
}

function saveCalendarEventFiltersToStorage(enabled: Set<EventCode>) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredCalendarFiltersPayload = {
      v: CALENDAR_EVENT_FILTERS_STORAGE_VERSION,
      enabled: [...enabled],
    };
    localStorage.setItem(CALENDAR_EVENT_FILTERS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage пълен или блокиран */
  }
}

function createDefaultForm(date = ""): WorkForm {
  return {
    type: "service",
    eventCode: "service_installation",
    title: "",
    dueDate: date,
    priority: "medium",
    status: "planned",
    contactId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    notes: "",
    quantity: "1",
    unitPrice: "",
    totalAmount: "",
  };
}

function ReadonlyMini({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const text = value?.trim() ? value : "—";
  return (
    <div className={className}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 break-words text-sm font-semibold text-slate-900">{text}</div>
    </div>
  );
}

/** След избор на CRM: телефон, адрес, брой и суми само за преглед (без отделни input полета). */
function ContactDerivedSummary({ form }: { form: WorkForm }) {
  const has = Boolean(form.contactId?.trim());
  if (!has) {
    return (
      <div className="col-span-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <div className="text-xs font-bold text-amber-950">Няма избран CRM контакт</div>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-900/95">
          След избор от полето по-горе тук автоматично се показват <strong>телефон</strong>, <strong>адрес</strong>, <strong>брой</strong> и{" "}
          <strong>суми</strong> към събитието (само за преглед). За смяна на контакт изчистете името и изберете друг.
        </p>
      </div>
    );
  }
  return (
    <div className="col-span-full grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-100/90 p-3 md:grid-cols-3">
      <div className="col-span-full text-[10px] font-bold uppercase tracking-wide text-slate-500">
        От контакт и събитието <span className="font-semibold normal-case text-slate-600">(само преглед)</span>
      </div>
      <ReadonlyMini label="Телефон" value={form.customerPhone} />
      <ReadonlyMini label="Адрес" value={form.customerAddress} className="md:col-span-2" />
      <ReadonlyMini label="Брой" value={form.quantity} />
      <ReadonlyMini label="Единична цена" value={form.unitPrice.trim() ? form.unitPrice : "—"} />
      <ReadonlyMini label="Обща сума" value={form.totalAmount.trim() ? form.totalAmount : "—"} />
    </div>
  );
}

export function WorkItemsPlanner({
  readOnly = false,
  canDeleteEvents = false,
}: {
  readOnly?: boolean;
  /** Изтриване на събития — само master_admin (сървърът също валидира). */
  canDeleteEvents?: boolean;
}) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<WorkForm>(createDefaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<WorkForm>(createDefaultForm());
  const [savingBusy, setSavingBusy] = useState(false);
  const [enabledEventFilters, setEnabledEventFilters] = useState<Set<EventCode>>(createAllCalendarFiltersEnabled);
  const calendarFiltersHydrated = useRef(false);

  useEffect(() => {
    if (!calendarFiltersHydrated.current) {
      calendarFiltersHydrated.current = true;
      setEnabledEventFilters(loadCalendarEventFiltersFromStorage());
      return;
    }
    saveCalendarEventFiltersToStorage(enabledEventFilters);
  }, [enabledEventFilters]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCompleteItem, setConfirmCompleteItem] = useState<WorkItem | null>(null);
  const [displayMode, setDisplayMode] = useState<"calendar" | "agenda">("agenda");
  const [mountDetailId, setMountDetailId] = useState<string | null>(null);
  const [supplierOrderDetailId, setSupplierOrderDetailId] = useState<string | null>(null);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  // Precomputed once per render cycle — avoids calling formatDateKey(new Date()) inside every calendar cell
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const monthEnd = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0), [now]);
  const title = useMemo(() => monthStart.toLocaleDateString("bg-BG", { month: "long", year: "numeric" }), [monthStart]);

  const monthFrom = formatDateKey(monthStart);
  const monthTo = formatDateKey(monthEnd);

  async function load() {
    setError(null);
    const perPage = 500;
    const collected: WorkItem[] = [];
    let page = 1;
    let total = 0;
    try {
      // Месецът може да има >500 събития (напр. масови item_removed) — дърпаме всички страници.
      do {
        const workRes = await fetch(
          `/api/admin/work-items?from=${monthFrom}&to=${monthTo}&perPage=${perPage}&page=${page}`,
          { credentials: "include" },
        );
        const workJson = (await workRes.json().catch(() => ({}))) as {
          error?: string;
          data?: WorkItem[];
          meta?: { total?: number };
        };
        if (!workRes.ok) {
          setError(workJson.error || "Грешка при зареждане");
          return;
        }
        const batch = workJson.data ?? [];
        total = workJson.meta?.total ?? batch.length;
        collected.push(...batch);
        page += 1;
      } while (collected.length < total && page <= 40);
      setItems(collected);
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? e));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  useEffect(() => {
    const onReload = () => void load();
    window.addEventListener("sk-admin-calendar-reload", onReload);
    return () => window.removeEventListener("sk-admin-calendar-reload", onReload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthFrom, monthTo]);

  useEffect(() => {
    if (!readOnly) return;
    setEditingId(null);
    setConfirmDeleteId(null);
  }, [readOnly]);

  /** Продажбите не се показват в календара; поръчките от доставчик (supplier_order) — да. */
  const plannerItems = useMemo(
    () =>
      items.filter((item) => {
        if (item.event_code === "supplier_order") return true;
        if (item.event_code === "sale" || item.type === "sale") return false;
        return true;
      }),
    [items],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const item of plannerItems) {
      const key = String(item.due_date ?? "").slice(0, 10);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [plannerItems]);

  const enabledFiltersKey = useMemo(
    () => ALL_CALENDAR_FILTER_IDS.filter((id) => enabledEventFilters.has(id)).join(","),
    [enabledEventFilters],
  );

  const agendaItems = useMemo(() => {
    return [...plannerItems]
      .filter(matchesViewMode)
      .sort((a, b) => String(a.due_date ?? "").localeCompare(String(b.due_date ?? "")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerItems, enabledFiltersKey]);

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

  // Memoize expensive calendar grid — avoids recomputing on every render tick
  const days = useMemo<Date[]>(() => {
    const grid: Date[] = [];
    const firstWeekday = (monthStart.getDay() + 6) % 7;
    for (let i = 0; i < firstWeekday; i++) grid.push(new Date(NaN));
    for (let d = 1; d <= monthEnd.getDate(); d++) grid.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
    while (grid.length % 7 !== 0) grid.push(new Date(NaN));
    return grid;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart.getTime(), monthEnd.getTime()]);

  function matchesViewMode(item: WorkItem) {
    if (item.event_code === "supplier_order") return true;
    const code = item.event_code;
    if (!code) return enabledEventFilters.size > 0;
    const inFilterList = ALL_CALENDAR_FILTER_IDS.includes(code);
    if (!inFilterList) {
      return areAllCalendarFiltersEnabled(enabledEventFilters);
    }
    return enabledEventFilters.has(code);
  }

  function toggleAllEventFilters() {
    setEnabledEventFilters((prev) =>
      areAllCalendarFiltersEnabled(prev) ? new Set() : createAllCalendarFiltersEnabled(),
    );
  }

  function toggleEventFilter(code: EventCode) {
    setEnabledEventFilters((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const allEventFiltersOn = areAllCalendarFiltersEnabled(enabledEventFilters);

  const selectedItems = selectedDate ? (byDate.get(selectedDate) ?? []).filter(matchesViewMode) : [];

  async function createFromForm(localForm: WorkForm) {
    const title =
      localForm.title.trim() ||
      (localForm.eventCode === "consultation" && localForm.customerName.trim()
        ? `Консултация: ${localForm.customerName.trim()}`
        : "");
    if (!title || !localForm.dueDate) return false;
    if (localForm.eventCode === "sale" || localForm.type === "sale") {
      setError("Продажбите се записват от панела „Продажби“ (каталог → Продажба), не от оперативния календар.");
      return false;
    }
    if (localForm.eventCode === "item_added" || localForm.eventCode === "item_removed") {
      setError(
        "Добавянето и премахването на продукт в календара се записват автоматично при нов продукт или изтриване от каталога.",
      );
      return false;
    }
    if (localForm.eventCode === "supplier_order") {
      setError('Поръчките от доставчик се записват от каталога („По поръчка“ → Поръчване), не ръчно от календара.');
      return false;
    }
    const cid = localForm.contactId.trim();
    if (!cid || !isContactUuid(cid)) {
      setError("Задължително изберете контакт от CRM (полето със синята рамка). Ползвайте ▼ за списък или + за нов контакт.");
      return false;
    }
    const res = await fetch("/api/admin/work-items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload({ ...localForm, title })),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при създаване");
      return false;
    }
    return true;
  }

  async function createItemInDay() {
    setError(null);
    setSavingBusy(true);
    try {
      const ok = await createFromForm(addForm);
      if (!ok) return;
      setAddForm(createDefaultForm(selectedDate ?? ""));
      await load();
      notifyFollowUpCallsChanged();
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
      contactId: item.contact_id ? String(item.contact_id) : "",
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
    const title =
      editForm.title.trim() ||
      (editForm.eventCode === "consultation" && editForm.customerName.trim()
        ? `Консултация: ${editForm.customerName.trim()}`
        : "");
    if (!title || !editForm.dueDate) return;
    const catalogStock =
      editForm.eventCode === "item_added" || editForm.eventCode === "item_removed";
    const supplierOrder = editForm.eventCode === "supplier_order";
    if (!catalogStock && !supplierOrder) {
      const ecid = editForm.contactId.trim();
      if (!ecid || !isContactUuid(ecid)) {
        setError("За запис е задължителен избран контакт от CRM (синьото поле по-горе).");
        return;
      }
    }
    setSavingBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${itemId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload({ ...editForm, title })),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as any).error || "Грешка при редакция");
        return;
      }
      setEditingId(null);
      await load();
      notifyFollowUpCallsChanged();
    } finally {
      setSavingBusy(false);
    }
  }

  async function markWorkItemDone(item: WorkItem) {
    if (readOnly || item.status === "done" || item.status === "cancelled") return;
    setSavingBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${item.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as any).error || "Грешка при маркиране като изпълнено");
        return;
      }
      await load();
      setConfirmCompleteItem(null);
      if (item.event_code === "consultation") notifyFollowUpCallsChanged();
    } finally {
      setSavingBusy(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!canDeleteEvents) return;
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
      notifyFollowUpCallsChanged();
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
              className={`flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs font-semibold transition-colors ${displayMode === "agenda" ? "bg-brand-blue-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <List className="w-3.5 h-3.5" /> Списък
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("calendar")}
              className={`flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs font-semibold transition-colors ${displayMode === "calendar" ? "bg-brand-blue-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Кал.
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setMonthOffset((x) => x - 1)}>◀</Button>
          <Button variant="secondary" size="sm" onClick={() => setMonthOffset(0)}>Днес</Button>
          <Button variant="secondary" size="sm" onClick={() => setMonthOffset((x) => x + 1)}>▶</Button>
        </div>
      </div>

      {/* Multi on/off филтри по тип събитие */}
      <div className="flex gap-1.5 mb-2 flex-wrap">
        <button
          type="button"
          onClick={toggleAllEventFilters}
          className={`rounded-full px-3 py-2 min-h-[36px] text-xs font-bold border transition-colors ${
            allEventFiltersOn
              ? "border-brand-blue-500 bg-brand-blue-50 text-brand-blue-700"
              : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          Всички
        </button>
        {CALENDAR_EVENT_FILTERS.map((m) => {
          const on = enabledEventFilters.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleEventFilter(m.id)}
              className={`rounded-full px-3 py-2 min-h-[36px] text-xs font-bold border transition-colors ${
                on
                  ? "border-brand-blue-500 bg-brand-blue-50 text-brand-blue-700"
                  : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50 opacity-60"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

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
            const isToday = valid && dateKey === todayKey;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => valid && openDay(dateKey)}
                className={`min-h-[52px] md:min-h-[64px] border rounded-md p-1 md:p-1.5 text-left transition-colors ${
                  valid
                    ? isToday
                      ? "border-brand-blue-400 bg-brand-blue-50 hover:border-brand-blue-500 cursor-pointer"
                      : "border-slate-200 bg-white hover:border-brand-blue-300 cursor-pointer"
                    : "border-transparent bg-slate-50 cursor-default"
                }`}
                disabled={!valid}
              >
                {valid && (
                  <>
                    <div className={`text-[11px] font-bold mb-0.5 tabular-nums ${isToday ? "text-brand-blue-700" : "text-slate-700"}`}>{d.getDate()}</div>
                    <div className="grid gap-0.5">
                      {dayItems.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="text-[9px] font-medium leading-tight border-l-2 pl-1 text-slate-800 truncate opacity-90"
                          style={{ borderLeftColor: eventColor(item) }}
                          title={`${eventCodeLabel(item)} (${statusLabel(item.status, item.event_code)})`}
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

        <div className="flex gap-2 mt-2 overflow-x-auto md:overflow-x-visible md:flex-wrap flex-nowrap pb-0.5 -mx-0.5 px-0.5 text-xs font-medium text-slate-500 scrollbar-hide">
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Добавяне на продукт</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" /> Премахване на продукт</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-sky-600 shrink-0" /> Монтаж</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" /> Профилактика</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" /> Сервиз на терен</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" /> Сервиз в склад</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" /> Консултация</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-violet-600 shrink-0" /> Поръчка от доставчик</span>
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
              const isToday = dateKey === todayKey;
              return (
                <div key={dateKey}>
                  <button
                    type="button"
                    onClick={() => openDay(dateKey)}
                    className="w-full text-left"
                  >
                    <div className={`text-xs font-bold mb-1.5 px-1 ${isToday ? "text-brand-blue-700" : "text-slate-500"}`}>
                      {d.toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" })}
                      {isToday && " · Днес"}
                    </div>
                  </button>
                  <div className="space-y-1.5">
                    {dayEvts.map((item) => (
                      <div key={item.id} className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openDay(dateKey)}
                          className={`flex-1 text-left rounded-xl border px-3 py-3 flex items-start gap-3 transition-colors shadow-sm ${
                            item.status === "done"
                              ? "border-green-200 bg-green-50 hover:border-green-300"
                              : "border-slate-200 bg-white hover:border-brand-blue-200 active:bg-slate-50"
                          }`}
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
                          <span className={workItemStatusPillClass(item)}>{statusLabel(item.status, item.event_code)}</span>
                        </button>
                        <WorkItemCompleteControl
                          item={item}
                          readOnly={readOnly}
                          savingBusy={savingBusy}
                          variant="compact"
                          onRequestComplete={() => setConfirmCompleteItem(item)}
                        />
                        {item.event_code === "service_installation" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMountDetailId(item.id);
                            }}
                            className="shrink-0 self-center px-3 py-2.5 min-h-[44px] text-xs font-bold uppercase text-brand-blue-700 bg-brand-blue-50 rounded-lg border border-brand-blue-100"
                          >
                            Инфо
                          </button>
                        )}
                        {item.event_code === "supplier_order" && item.status !== "done" && item.status !== "cancelled" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSupplierOrderDetailId(item.id);
                            }}
                            className="shrink-0 self-center px-3 py-2.5 min-h-[44px] text-xs font-bold uppercase text-violet-800 bg-violet-50 rounded-lg border border-violet-200"
                          >
                            Детайли
                          </button>
                        )}
                      </div>
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
                      className={`rounded-lg border border-l-[3px] p-4 transition-colors ${
                        item.status === "done"
                          ? "border-green-200 bg-green-50/90 hover:border-green-300"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                      style={{ borderLeftColor: eventColor(item) }}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-500">{eventCodeLabel(item)}</div>
                          <div className="mt-0.5 text-base font-semibold text-slate-900">{item.title}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          <span className={workItemStatusPillClass(item)}>{statusLabel(item.status, item.event_code)}</span>
                          <WorkItemCompleteControl
                            item={item}
                            readOnly={readOnly}
                            savingBusy={savingBusy}
                            variant="full"
                            onRequestComplete={() => setConfirmCompleteItem(item)}
                          />
                          {item.event_code === "service_installation" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMountDetailId(item.id);
                              }}
                            >
                              Детайли монтаж
                            </Button>
                          )}
                          {item.event_code === "supplier_order" && item.status !== "done" && item.status !== "cancelled" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSupplierOrderDetailId(item.id);
                              }}
                            >
                              Поръчка
                            </Button>
                          )}
                          {!readOnly && (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => startEdit(item)}>
                                Редакция
                              </Button>
                              {canDeleteEvents && (
                                <Button variant="danger" size="sm" onClick={() => void removeItem(item.id)}>
                                  Изтрий
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-slate-600">
                        {[item.customer_name, item.customer_phone, item.customer_address].filter(Boolean).join(" · ") || "Без контакт"}
                      </div>
                      {item.notes && <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{item.notes}</div>}

                      {editingId === item.id && !readOnly && (
                        <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                          <FormField label="Тип събитие">
                            <EventSelect
                              form={editForm}
                              setForm={setEditForm}
                              catalogEventLocked={
                                item.event_code === "item_added" ||
                                item.event_code === "item_removed" ||
                                item.event_code === "supplier_order"
                              }
                            />
                          </FormField>
                          <FormField label="Заглавие"><Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></FormField>
                          <FormField label="Дата"><Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} /></FormField>
                          <FormField label="Статус"><StatusSelect form={editForm} setForm={setEditForm} /></FormField>
                          <FormField label="Приоритет"><PrioritySelect form={editForm} setForm={setEditForm} /></FormField>
                          {item.event_code !== "item_added" && item.event_code !== "item_removed" ? (
                            <>
                              <div className="col-span-full md:col-span-2">
                                <ContactPersonPicker
                                  variant="planner"
                                  instanceId="edit"
                                  readOnly={readOnly}
                                  customerName={editForm.customerName}
                                  customerPhone={editForm.customerPhone}
                                  customerAddress={editForm.customerAddress}
                                  contactId={editForm.contactId}
                                  onPatch={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                                />
                              </div>
                              <ContactDerivedSummary form={editForm} />
                            </>
                          ) : (
                            <div className="col-span-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                              Без CRM контакт — събитието е от каталога с продукти.
                            </div>
                          )}
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

              {!readOnly && (
              <div className="shrink-0 overflow-visible bg-slate-50/90 p-3 lg:w-[320px] lg:max-w-[34%] xl:w-[340px]">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ново събитие</h3>
                <div
                  className="grid grid-cols-1 gap-2 md:grid-cols-2 overflow-visible [&_label]:gap-1 [&_label>span]:text-[10px] [&_label>span]:font-medium [&_label>span]:text-slate-500 [&_input]:!min-h-0 [&_input]:!rounded-md [&_input]:!px-2 [&_input]:!py-1 [&_input]:!text-[11px] [&_select]:!rounded-md [&_select]:!px-2 [&_select]:!py-1 [&_select]:!text-[11px] [&_textarea]:!rounded-md [&_textarea]:!px-2 [&_textarea]:!py-1 [&_textarea]:!text-[11px] [&_textarea]:!min-h-[2.25rem]"
                >
                  <FormField label="Тип събитие"><EventSelect form={addForm} setForm={setAddForm} /></FormField>
                  <FormField label="Заглавие"><Input value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} /></FormField>
                  <FormField label="Дата"><Input type="date" value={addForm.dueDate} onChange={(e) => setAddForm((f) => ({ ...f, dueDate: e.target.value }))} /></FormField>
                  <FormField label="Статус"><StatusSelect form={addForm} setForm={setAddForm} /></FormField>
                  <FormField label="Приоритет"><PrioritySelect form={addForm} setForm={setAddForm} /></FormField>
                  <div className="col-span-full md:col-span-2">
                    <ContactPersonPicker
                      variant="planner"
                      instanceId="day-add"
                      readOnly={readOnly}
                      customerName={addForm.customerName}
                      customerPhone={addForm.customerPhone}
                      customerAddress={addForm.customerAddress}
                      contactId={addForm.contactId}
                      onPatch={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
                    />
                  </div>
                  <div className="col-span-full md:col-span-2">
                    <ContactDerivedSummary form={addForm} />
                  </div>
                  <FormField label="Бележки" full><Textarea value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></FormField>
                  <div className="col-span-full shrink-0 pt-1">
                    <Button variant="primary" size="sm" className="w-full !py-2 !text-xs" type="button" onClick={() => void createItemInDay()} disabled={savingBusy}>
                      {savingBusy ? "Записване…" : "Добави събитие"}
                    </Button>
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      <InstallationMountDetailModal
        workItemId={mountDetailId}
        readOnly={readOnly}
        onClose={() => setMountDetailId(null)}
        onCompleted={() => void load()}
      />

      {supplierOrderDetailId && (
        <SupplierOrderDetailModal
          orderId={supplierOrderDetailId}
          onClose={() => setSupplierOrderDetailId(null)}
          onCancelled={() => {
            setSupplierOrderDetailId(null);
            void load();
          }}
          onUpdated={() => void load()}
          onFulfilled={() => {
            setSupplierOrderDetailId(null);
            void load();
          }}
        />
      )}

      {confirmCompleteItem && (
        <WorkItemCompleteConfirmModal
          item={confirmCompleteItem}
          savingBusy={savingBusy}
          onCancel={() => setConfirmCompleteItem(null)}
          onConfirm={() => void markWorkItemDone(confirmCompleteItem)}
        />
      )}

      {canDeleteEvents && confirmDeleteId && (
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

function EventSelect({
  form,
  setForm,
  catalogEventLocked = false,
}: {
  form: WorkForm;
  setForm: React.Dispatch<React.SetStateAction<WorkForm>>;
  catalogEventLocked?: boolean;
}) {
  if (catalogEventLocked) {
    const label =
      form.eventCode === "item_added"
        ? "Добавяне на продукт"
        : form.eventCode === "item_removed"
          ? "Премахване на продукт"
          : form.eventCode === "supplier_order"
            ? "Поръчка от доставчик"
            : form.eventCode;
    const hint =
      form.eventCode === "supplier_order"
        ? "Записва се при поръчване от каталога (продукт „По поръчка“); типът не се сменя оттук."
        : "Автоматично от каталога с продукти; типът не се сменя оттук.";
    return (
      <div className="grid gap-1">
        <Select value={form.eventCode} disabled className="opacity-90">
          <option value={form.eventCode}>{label}</option>
        </Select>
        <p className="text-[10px] leading-snug text-slate-500">{hint}</p>
      </div>
    );
  }
  return (
    <Select
      value={form.eventCode}
      onChange={(e) => {
        const eventCode = e.target.value as EventCode;
        const matched = PLANNER_CREATABLE_EVENT_OPTIONS.find((x) => x.id === eventCode);
        setForm((f) => {
          const next: WorkForm = { ...f, eventCode, type: matched?.type ?? f.type };
          if (eventCode === "consultation") {
            next.status = "planned";
            if (!next.title.trim() && next.customerName.trim()) {
              next.title = `Консултация: ${next.customerName.trim()}`;
            }
          }
          return next;
        });
      }}
    >
      {PLANNER_CREATABLE_EVENT_OPTIONS.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}

function StatusSelect({ form, setForm }: { form: WorkForm; setForm: React.Dispatch<React.SetStateAction<WorkForm>> }) {
  if (form.eventCode === "consultation") {
    return (
      <Select value={form.status === "done" ? "done" : "planned"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as WorkItem["status"] }))}>
        <option value="planned">Чака</option>
        <option value="done">Завършено</option>
      </Select>
    );
  }
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

function isContactUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function toPayload(form: WorkForm) {
  return {
    type: form.type,
    eventCode: form.eventCode,
    title: form.title.trim(),
    dueDate: form.dueDate,
    priority: form.priority,
    status: form.status,
    contactId: form.contactId.trim() || null,
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
  return "service_on_site";
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
      return "Добавяне на продукт";
    case "item_removed":
      return "Премахване на продукт";
    case "sale":
      return "Продажба";
    case "service_installation":
      return "Монтаж";
    case "service_maintenance":
      return "Профилактика";
    case "service_on_site":
      return "Сервиз на терен";
    case "service_in_shop":
      return "Сервиз в склад";
    case "consultation":
      return "Консултация";
    case "supplier_order":
      return "Поръчка от доставчик";
    default:
      return `${TYPE_LABEL[item.type]}: ${item.title}`;
  }
}

function statusLabel(status: WorkItem["status"], eventCode?: EventCode | null): string {
  if (eventCode === "consultation") {
    if (status === "done") return "Завършено";
    return "Чака";
  }
  if (status === "done") return "Изпълнена";
  if (status === "in_progress") return "В процес";
  if (status === "cancelled") return "Отказана";
  return "Чака";
}

function completeActionLabel(eventCode: EventCode | null | undefined, done: boolean): string {
  if (eventCode === "consultation") return done ? "Завършено" : "Завърши";
  return done ? "Изпълнено" : "Изпълни";
}

function formatDueDateBg(due: string | null | undefined): string {
  if (!due) return "без дата";
  return new Date(`${String(due).slice(0, 10)}T00:00:00`).toLocaleDateString("bg-BG");
}

function completeConfirmContent(item: WorkItem): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  const eventName = eventCodeLabel(item);
  const who = item.customer_name?.trim() || "контакта";
  const phone = item.customer_phone?.trim();
  const when = formatDueDateBg(item.due_date);
  const contactLine = phone ? `${who} (${phone})` : who;

  switch (item.event_code) {
    case "consultation":
      return {
        title: "Завършване на консултация",
        description: `Ще маркирате обаждането за консултация с ${contactLine} на ${when} като завършено. Събитието излиза от чакащите обаждания; планираното CRM follow-up се нулира.`,
        confirmLabel: "Завърши",
      };
    case "service_installation":
      return {
        title: "Потвърждение: монтаж изпълнен",
        description: `Ще маркирате монтажа „${item.title}“ за ${contactLine} на ${when} като изпълнен. Събитието ще се покаже в зелено и няма да се брои като чакащо.`,
        confirmLabel: "Изпълни",
      };
    case "service_maintenance":
      return {
        title: "Потвърждение: профилактика изпълнена",
        description: `Ще маркирате профилактиката „${item.title}“ за ${contactLine} на ${when} като изпълнена.`,
        confirmLabel: "Изпълни",
      };
    case "service_on_site":
      return {
        title: "Потвърждение: сервиз на терен изпълнен",
        description: `Ще маркирате сервиза на терен „${item.title}“ за ${contactLine} на ${when} като изпълнен.`,
        confirmLabel: "Изпълни",
      };
    case "service_in_shop":
      return {
        title: "Потвърждение: сервиз в склад изпълнен",
        description: `Ще маркирате сервиза в склад „${item.title}“ за ${contactLine} на ${when} като изпълнен.`,
        confirmLabel: "Изпълни",
      };
    case "item_added":
      return {
        title: "Потвърждение: добавяне на продукт",
        description: `Ще маркирате събитието „${item.title}“ (${eventName}) на ${when} като изпълнено — операцията по каталога се счита за приключена.`,
        confirmLabel: "Изпълни",
      };
    case "item_removed":
      return {
        title: "Потвърждение: премахване на продукт",
        description: `Ще маркирате събитието „${item.title}“ (${eventName}) на ${when} като изпълнено — операцията по каталога се счита за приключена.`,
        confirmLabel: "Изпълни",
      };
    default:
      return {
        title: "Потвърждение за изпълнение",
        description: `Ще маркирате „${item.title}“ (${eventName}) за ${contactLine} на ${when} като изпълнено.`,
        confirmLabel: "Изпълни",
      };
  }
}

function WorkItemCompleteConfirmModal({
  item,
  savingBusy,
  onCancel,
  onConfirm,
}: {
  item: WorkItem;
  savingBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = completeConfirmContent(item);
  const who = item.customer_name?.trim();
  const phone = item.customer_phone?.trim();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-md md:items-center"
      onClick={() => !savingBusy && onCancel()}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl border border-white/70 bg-white p-6 shadow-[0_-8px_40px_rgba(15,23,42,0.25)] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex justify-center md:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="text-xs font-bold uppercase tracking-wide text-green-700">Маркиране като изпълнено</div>
        <div className="mt-1 text-xl font-black text-slate-950">{copy.title}</div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{copy.description}</p>
        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>
            <span className="font-semibold text-slate-500">Събитие: </span>
            <span className="font-semibold text-slate-900">{eventCodeLabel(item)}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">Заглавие: </span>
            <span className="font-semibold text-slate-900">{item.title}</span>
          </div>
          {who && (
            <div>
              <span className="font-semibold text-slate-500">Клиент: </span>
              <span className="font-semibold text-slate-900">{who}</span>
              {phone ? <span className="text-slate-600"> · {phone}</span> : null}
            </div>
          )}
          <div>
            <span className="font-semibold text-slate-500">Дата: </span>
            <span className="font-semibold text-slate-900">{formatDueDateBg(item.due_date)}</span>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={savingBusy}>
            Отказ
          </Button>
          <Button
            variant="primary"
            className="!border-green-700 !bg-green-600 hover:!bg-green-700"
            onClick={onConfirm}
            disabled={savingBusy}
          >
            {savingBusy ? "Запис..." : copy.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WorkItemCompleteControl({
  item,
  readOnly,
  savingBusy,
  variant,
  onRequestComplete,
}: {
  item: WorkItem;
  readOnly: boolean;
  savingBusy: boolean;
  variant: "compact" | "full";
  onRequestComplete: () => void;
}) {
  if (readOnly || item.status === "cancelled") return null;
  if (item.event_code === "supplier_order") return null;

  const done = item.status === "done";
  const label = completeActionLabel(item.event_code, done);

  if (done) {
    const badgeClass =
      "inline-flex shrink-0 items-center gap-1 rounded-lg border border-green-400 bg-green-100 px-2.5 py-1.5 text-[10px] font-bold text-green-900";
    return (
      <span className={badgeClass} title={label}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRequestComplete();
        }}
        disabled={savingBusy}
        className="shrink-0 self-center inline-flex items-center gap-1 rounded-lg border border-green-700 bg-green-600 px-2.5 py-2 text-[10px] font-bold text-white hover:bg-green-700 disabled:opacity-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      type="button"
      className="!border-green-700 !bg-green-600 hover:!bg-green-700"
      onClick={onRequestComplete}
      disabled={savingBusy}
    >
      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function workItemStatusPillClass(item: WorkItem): string {
  const base = "rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap border";
  if (item.status === "done") {
    return `${base} bg-green-200 border-green-400 text-green-900`;
  }
  if (item.event_code === "consultation" || item.status === "planned") {
    return `${base} bg-amber-100 border-amber-300 text-amber-900`;
  }
  return statusPillClass(item.status);
}

function statusPillClass(status: WorkItem["status"]): string {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700`;
  if (status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-amber-100 border-amber-200 text-amber-800`;
}

function eventColor(item: WorkItem): string {
  if (item.event_code === "item_added") return "#10b981";
  if (item.event_code === "item_removed") return "#f97316";
  if (item.event_code === "sale") return "#0ea5e9";
  if (item.event_code === "service_installation") return "#0284c7";
  if (item.event_code === "service_maintenance") return "#14b8a6";
  if (item.event_code === "service_on_site") return "#6366f1";
  if (item.event_code === "service_in_shop") return "#a855f7";
  if (item.status === "done") return "#22c55e";
  if (item.event_code === "consultation") return "#ec4899";
  if (item.event_code === "supplier_order") return "#7c3aed";
  return TYPE_COLOR[item.type];
}
