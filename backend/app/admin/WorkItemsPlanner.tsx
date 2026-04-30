"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type WorkItem = {
  id: string;
  type: "sale" | "service" | "stock_in" | "stock_out" | "task";
  event_code?:
    | "item_added"
    | "item_removed"
    | "sale"
    | "service_installation"
    | "service_inspection"
    | "service_repair"
    | "service_maintenance"
    | null;
  status: "planned" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
  title: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  due_date?: string | null;
};

type CalendarEntry = {
  id: string;
  label: string;
  color: string;
  subtle?: boolean;
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
  stock_in: "#16a34a",
  stock_out: "#f97316",
  task: "#64748b",
};

export function WorkItemsPlanner() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{
    type: WorkItem["type"];
    eventCode: NonNullable<WorkItem["event_code"]>;
    title: string;
    dueDate: string;
    priority: WorkItem["priority"];
    status: WorkItem["status"];
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    notes: string;
  }>({
    type: "task",
    eventCode: "service_installation",
    title: "",
    dueDate: "",
    priority: "medium",
    status: "planned",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    notes: "",
  });

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const title = monthStart.toLocaleDateString("bg-BG", { month: "long", year: "numeric" });

  async function load() {
    setError(null);
    const from = monthStart.toISOString().slice(0, 10);
    const to = monthEnd.toISOString().slice(0, 10);
    const workRes = await fetch(`/api/admin/work-items?from=${from}&to=${to}&perPage=500`, { credentials: "include" });
    const workJson = await workRes.json().catch(() => ({}));
    if (!workRes.ok) {
      setError((workJson as any).error || "Грешка при зареждане");
      return;
    }
    setItems((workJson as any).data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const item of items) {
      const key = item.due_date || "";
      if (!key) continue;
      const arr = map.get(key) ?? [];
      const eventLabel = eventCodeLabel(item);
      const statusLabel = statusShortLabel(item.status);
      const contact = [item.customer_name, item.customer_phone].filter(Boolean).join(" / ");
      const line = contact ? `${eventLabel} (${statusLabel}) - ${contact}` : `${eventLabel} (${statusLabel})`;
      arr.push({
        id: `work-${item.id}`,
        label: line,
        color: eventColor(item),
        subtle: item.status !== "done",
      });
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const days: Date[] = [];
  const firstWeekday = (monthStart.getDay() + 6) % 7;
  for (let i = 0; i < firstWeekday; i++) days.push(new Date(NaN));
  for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
  while (days.length % 7 !== 0) days.push(new Date(NaN));

  async function createItem() {
    if (!form.title.trim() || !form.dueDate) return;
    setError(null);
    const res = await fetch("/api/admin/work-items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при създаване");
      return;
    }
    setCreating(false);
    setForm({
      type: "task",
      eventCode: "service_installation",
      title: "",
      dueDate: "",
      priority: "medium",
      status: "planned",
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      notes: "",
    });
    await load();
  }

  return (
    <section style={{ marginTop: 18, border: "1px solid #e2e8f0", borderRadius: 16, background: "white", padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>Оперативен календар</div>
          <div style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{title}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMonthOffset((x) => x - 1)} style={btn}>◀</button>
          <button onClick={() => setMonthOffset(0)} style={btn}>Днес</button>
          <button onClick={() => setMonthOffset((x) => x + 1)} style={btn}>▶</button>
          <button onClick={() => setCreating((v) => !v)} style={{ ...btn, borderColor: "#0ea5e9", color: "#0369a1" }}>+ Събитие</button>
        </div>
      </div>
      {creating && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, marginBottom: 10, display: "grid", gridTemplateColumns: "200px 180px 150px 140px 130px auto", gap: 8 }}>
          <select
            value={form.eventCode}
            onChange={(e) => {
              const eventCode = e.target.value as NonNullable<WorkItem["event_code"]>;
              const type: WorkItem["type"] =
                eventCode === "sale" ? "sale" : eventCode === "item_added" ? "stock_in" : eventCode === "item_removed" ? "stock_out" : "service";
              setForm((f) => ({ ...f, eventCode, type }));
            }}
            style={input}
          >
            <option value="item_added">Добавяне на артикул</option>
            <option value="item_removed">Премахване на артикул</option>
            <option value="sale">Продажба</option>
            <option value="service_installation">Услуга: монтаж</option>
            <option value="service_inspection">Услуга: оглед</option>
            <option value="service_repair">Услуга: сервиз</option>
            <option value="service_maintenance">Услуга: профилактика</option>
          </select>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Тема на събитието..." style={input} />
          <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} style={input} />
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as WorkItem["status"] }))} style={input}>
            <option value="planned">Чака</option>
            <option value="in_progress">В процес</option>
            <option value="done">Изпълнена</option>
            <option value="cancelled">Отказана</option>
          </select>
          <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as WorkItem["priority"] }))} style={input}>
            <option value="low">Нисък</option>
            <option value="medium">Среден</option>
            <option value="high">Висок</option>
          </select>
          <button onClick={() => void createItem()} style={{ ...btn, borderColor: "#0ea5e9", color: "#0369a1" }}>Запази</button>

          <input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="Контактно лице" style={{ ...input, gridColumn: "1 / span 2" }} />
          <input value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} placeholder="Телефон" style={input} />
          <input value={form.customerAddress} onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))} placeholder="Адрес" style={{ ...input, gridColumn: "4 / span 3" }} />
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Допълнителни бележки" style={{ ...input, gridColumn: "1 / -1", resize: "vertical" }} />
        </div>
      )}
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 10, padding: 8, marginBottom: 10, fontSize: 12 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
          <div key={d} style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textAlign: "center" }}>{d}</div>
        ))}
        {days.map((d, idx) => {
          const valid = !Number.isNaN(d.getTime());
          const dateKey = valid ? d.toISOString().slice(0, 10) : "";
          const dayItems = valid ? byDate.get(dateKey) ?? [] : [];
          return (
            <div key={idx} style={{ minHeight: 88, border: "1px solid #e2e8f0", borderRadius: 10, padding: 6, background: valid ? "white" : "#f8fafc" }}>
              {valid && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 4 }}>{d.getDate()}</div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {dayItems.slice(0, 4).map((item) => (
                      <div key={item.id} style={{ fontSize: 10, lineHeight: 1.2, borderLeft: `3px solid ${item.color}`, paddingLeft: 4, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: item.subtle ? 0.78 : 1 }} title={item.label}>
                        {item.label}
                      </div>
                    ))}
                    {dayItems.length > 4 && <div style={{ fontSize: 10, color: "#64748b" }}>+{dayItems.length - 4} още</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "#64748b" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#0ea5e9", display: "inline-block" }} /> Продажби</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#16a34a", display: "inline-block" }} /> Добавени артикули</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#f97316", display: "inline-block" }} /> Премахнати артикули</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#8b5cf6", display: "inline-block" }} /> Услуги</span>
      </div>
    </section>
  );
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

function statusShortLabel(status: WorkItem["status"]): string {
  if (status === "done") return "изпълнена";
  if (status === "in_progress") return "в процес";
  if (status === "cancelled") return "отказана";
  return "чака";
}

function eventColor(item: WorkItem): string {
  if (item.event_code === "item_added") return "#16a34a";
  if (item.event_code === "item_removed") return "#f97316";
  if (item.event_code === "sale") return "#0ea5e9";
  if (
    item.event_code === "service_installation" ||
    item.event_code === "service_inspection" ||
    item.event_code === "service_repair" ||
    item.event_code === "service_maintenance"
  ) return "#8b5cf6";
  return TYPE_COLOR[item.type];
}

const btn: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const input: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 12,
  color: "#0f172a",
  background: "white",
};
