import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardPanelItem, FollowUpStatusKind } from "@/app/admin/DashboardPanel";
import { inquiryServiceTypeLabel } from "@/lib/inquiry/serviceTypeLabels";

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatBgDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("bg-BG");
}

function formatBgDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function customerStatusLabel(value: string | null | undefined) {
  if (value === "vip") return "VIP";
  if (value === "active") return "Активен";
  if (value === "lost") return "Загубен";
  return "Нов";
}

function normalizePhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/[^\d+]/g, "").trim();
}

function consultationStatusKind(status: string): FollowUpStatusKind {
  return status === "done" ? "done" : "waiting";
}

function inquiryStatusLabel(status: string) {
  if (status === "new") return "Ново";
  if (status === "in_progress") return "В работа";
  if (status === "done") return "Приключено";
  return status;
}

function inquiryStatusKind(status: string): FollowUpStatusKind {
  return status === "done" ? "done" : "waiting";
}

type InquiryRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_type?: string | null;
  created_at: string;
  status: string;
};

function mapInquiryToPanelItem(inq: InquiryRow): DashboardPanelItem {
  const kind = inquiryStatusKind(inq.status);
  return {
    id: `inquiry-${inq.id}`,
    inquiryId: inq.id,
    title: inq.customer_name,
    statusKind: kind,
    meta: [inq.customer_phone, inquiryServiceTypeLabel(inq.service_type), formatBgDateTime(inq.created_at)]
      .filter(Boolean)
      .join(" · "),
    detail: {
      title: inq.customer_name,
      subtitle: "Клиентско запитване",
      fields: [
        { label: "Тип", value: "Запитване" },
        { label: "Статус", value: inquiryStatusLabel(inq.status) },
        { label: "Телефон", value: inq.customer_phone },
        { label: "Тип заявка", value: inquiryServiceTypeLabel(inq.service_type) },
        { label: "Получено", value: formatBgDateTime(inq.created_at) },
      ],
    },
  };
}

function buildLatestInquiryByPhone(rows: InquiryRow[]): Map<string, InquiryRow> {
  const map = new Map<string, InquiryRow>();
  for (const inq of rows) {
    const key = normalizePhone(inq.customer_phone);
    if (key && !map.has(key)) map.set(key, inq);
  }
  return map;
}

/** CRM контакти, консултации и нови запитвания за панела „Контакти за обаждане“. */
export async function fetchCallFollowUpPanelItems(
  db: SupabaseClient,
  today = formatDateKey(new Date()),
): Promise<DashboardPanelItem[]> {
  const [followUpContacts, pendingConsultations, doneConsultations, recentInquiries] = await Promise.all([
    db
      .from("contacts")
      .select("id,full_name,phone,customer_status,next_follow_up_at,last_contacted_at")
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", today)
      .neq("customer_status", "lost")
      .order("next_follow_up_at", { ascending: true })
      .limit(8),
    db
      .from("work_items")
      .select("id,title,status,due_date,customer_name,customer_phone,contact_id")
      .eq("event_code", "consultation")
      .in("status", ["planned", "in_progress"])
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(8),
    db
      .from("work_items")
      .select("id,title,status,due_date,customer_name,customer_phone,contact_id,completed_at")
      .eq("event_code", "consultation")
      .eq("status", "done")
      .lte("due_date", today)
      .order("completed_at", { ascending: false })
      .limit(4),
    db
      .from("inquiries")
      .select("id,customer_name,customer_phone,service_type,created_at,status,updated_at")
      .neq("status", "spam")
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  const allInquiryRows = (recentInquiries.data ?? []) as InquiryRow[];
  const latestInquiryByPhone = buildLatestInquiryByPhone(allInquiryRows);
  const newInquiryRows = allInquiryRows.filter((inq) => inq.status === "new");
  const inquiryIdsFromContacts = new Set<string>();

  const waitingConsultations = pendingConsultations.data ?? [];
  const doneRows = doneConsultations.data ?? [];
  const consultationContactIds = new Set(
    [...waitingConsultations, ...doneRows].map((row) => row.contact_id).filter((id): id is string => Boolean(id)),
  );

  const waitingContacts: DashboardPanelItem[] = [];
  const doneInquiryItems: DashboardPanelItem[] = [];

  for (const contact of followUpContacts.data ?? []) {
    if (consultationContactIds.has(contact.id)) continue;

    const latest = latestInquiryByPhone.get(normalizePhone(contact.phone));
    if (latest) {
      inquiryIdsFromContacts.add(latest.id);
      const item: DashboardPanelItem = {
        ...mapInquiryToPanelItem(latest),
        id: `inquiry-contact-${latest.id}`,
      };
      if (latest.status === "done") {
        doneInquiryItems.push(item);
      } else {
        waitingContacts.push(item);
      }
      continue;
    }

    waitingContacts.push({
      id: `contact-${contact.id}`,
      title: contact.full_name,
      statusKind: "waiting",
      meta: [contact.phone, customerStatusLabel(contact.customer_status), formatBgDate(contact.next_follow_up_at)]
        .filter(Boolean)
        .join(" · "),
      detail: {
        title: contact.full_name,
        subtitle: "Контакт за обаждане",
        fields: [
          { label: "Телефон", value: contact.phone },
          { label: "CRM статус", value: customerStatusLabel(contact.customer_status) },
          { label: "Планирано обаждане", value: formatBgDate(contact.next_follow_up_at) },
          { label: "Последен контакт", value: formatBgDate(contact.last_contacted_at) },
        ],
      },
    });
  }

  const standaloneInquiries = newInquiryRows
    .filter((inq) => !inquiryIdsFromContacts.has(inq.id))
    .map(mapInquiryToPanelItem);

  const consultationWaiting: DashboardPanelItem[] = waitingConsultations.map((item) => ({
    id: `consultation-${item.id}`,
    consultationWorkItemId: item.id,
    consultationDueDate: item.due_date,
    consultationCustomerName: item.customer_name,
    consultationCustomerPhone: item.customer_phone,
    title: item.title || item.customer_name || "Консултация",
    statusKind: "waiting" as const,
    meta: [item.customer_phone, "Консултация", formatBgDate(item.due_date)].filter(Boolean).join(" · "),
    detail: {
      title: item.title || item.customer_name || "Консултация",
      subtitle: "Обаждане за консултация",
      fields: [
        { label: "Тип", value: "Консултация" },
        { label: "Статус", value: "Чака" },
        { label: "Клиент", value: item.customer_name },
        { label: "Телефон", value: item.customer_phone },
        { label: "Планирана дата", value: formatBgDate(item.due_date) },
      ],
    },
  }));

  const doneItems: DashboardPanelItem[] = [
    ...doneInquiryItems,
    ...doneRows.map((item) => ({
      id: `consultation-${item.id}`,
      title: item.title || item.customer_name || "Консултация",
      statusKind: consultationStatusKind(item.status),
      meta: [item.customer_phone, "Консултация", formatBgDate(item.due_date)].filter(Boolean).join(" · "),
      detail: {
        title: item.title || item.customer_name || "Консултация",
        subtitle: "Обаждане за консултация",
        fields: [
          { label: "Тип", value: "Консултация" },
          { label: "Статус", value: "Завършено" },
          { label: "Клиент", value: item.customer_name },
          { label: "Телефон", value: item.customer_phone },
          { label: "Планирана дата", value: formatBgDate(item.due_date) },
        ],
      },
    })),
  ];

  return [...standaloneInquiries, ...consultationWaiting, ...waitingContacts, ...doneItems].slice(0, 12);
}

export function countWaitingFollowUps(items: DashboardPanelItem[]): number {
  return items.filter((item) => item.statusKind !== "done").length;
}
