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

type ContactWorkItemRow = {
  id: string;
  contact_id: string | null;
  status: string;
  due_date: string | null;
  event_code: string | null;
  title: string | null;
  customer_name: string | null;
  customer_phone: string | null;
};

function workItemEventLabel(code: string | null | undefined) {
  if (code === "consultation") return "Консултация";
  if (code === "sale") return "Продажба";
  if (code === "service_installation") return "Монтаж";
  if (code === "service_maintenance") return "Поддръжка";
  if (code === "service_on_site") return "Сервиз на място";
  if (code === "service_in_shop") return "Сервиз в сервиз";
  return "Задача";
}

function isPendingWorkItemStatus(status: string) {
  return status === "planned" || status === "in_progress";
}

function canCompleteFromCallFollowUpPanel(row: ContactWorkItemRow | null): boolean {
  if (!row || !isPendingWorkItemStatus(row.status)) return false;
  return row.event_code !== "sale";
}

function groupContactWorkItems(rows: ContactWorkItemRow[]): Map<string, ContactWorkItemRow[]> {
  const map = new Map<string, ContactWorkItemRow[]>();
  for (const row of rows) {
    if (!row.contact_id) continue;
    const list = map.get(row.contact_id) ?? [];
    list.push(row);
    map.set(row.contact_id, list);
  }
  return map;
}

function mapContactFollowUpItem(
  contact: {
    id: string;
    full_name: string;
    phone: string;
    customer_status: string | null;
    next_follow_up_at: string | null;
    last_contacted_at: string | null;
  },
  linkedTask: ContactWorkItemRow | null,
  statusKind: FollowUpStatusKind,
): DashboardPanelItem {
  const taskLabel = linkedTask ? workItemEventLabel(linkedTask.event_code) : null;
  const title = linkedTask?.title || contact.full_name;
  const canCompleteLinkedTask = canCompleteFromCallFollowUpPanel(linkedTask);
  return {
    id: linkedTask ? `contact-task-${linkedTask.id}` : `contact-${contact.id}`,
    contactFollowUpId: contact.id,
    followUpWorkItemId: canCompleteLinkedTask ? linkedTask?.id : undefined,
    consultationWorkItemId: linkedTask?.event_code === "consultation" && isPendingWorkItemStatus(linkedTask.status)
      ? linkedTask.id
      : undefined,
    consultationDueDate: linkedTask?.due_date ?? contact.next_follow_up_at,
    consultationCustomerName: linkedTask?.customer_name ?? contact.full_name,
    consultationCustomerPhone: linkedTask?.customer_phone ?? contact.phone,
    title,
    statusKind,
    meta: [
      linkedTask?.customer_phone ?? contact.phone,
      taskLabel ?? customerStatusLabel(contact.customer_status),
      formatBgDate(linkedTask?.due_date ?? contact.next_follow_up_at),
    ]
      .filter(Boolean)
      .join(" · "),
    detail: {
      title,
      subtitle: linkedTask ? `CRM · ${taskLabel}` : "Контакт за обаждане",
      fields: [
        { label: "Тип", value: linkedTask ? workItemEventLabel(linkedTask.event_code) : "CRM обаждане" },
        { label: "Статус", value: statusKind === "done" ? "Завършено" : "Чака" },
        { label: "Клиент", value: contact.full_name },
        { label: "Телефон", value: contact.phone },
        { label: "CRM статус", value: customerStatusLabel(contact.customer_status) },
        { label: "Планирано", value: formatBgDate(linkedTask?.due_date ?? contact.next_follow_up_at) },
        { label: "Последен контакт", value: formatBgDate(contact.last_contacted_at) },
      ],
    },
  };
}

/** CRM контакти, консултации и нови запитвания за панела „Контакти за обаждане“. */
export async function fetchCallFollowUpPanelItems(
  db: SupabaseClient,
  today = formatDateKey(new Date()),
): Promise<DashboardPanelItem[]> {
  const followUpContactsRes = await db
    .from("contacts")
    .select("id,full_name,phone,customer_status,next_follow_up_at,last_contacted_at")
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", today)
    .neq("customer_status", "lost")
    .order("next_follow_up_at", { ascending: true })
    .limit(8);

  const contactIds = (followUpContactsRes.data ?? []).map((c) => c.id);

  const [contactWorkItemsRes, pendingConsultations, doneConsultations, recentInquiries] = await Promise.all([
    contactIds.length
      ? db
          .from("work_items")
          .select("id,contact_id,status,due_date,event_code,title,customer_name,customer_phone")
          .in("contact_id", contactIds)
          .lte("due_date", today)
          .neq("status", "cancelled")
          .not("event_code", "in", '("item_added","item_removed","supplier_order")')
          .order("due_date", { ascending: true })
      : Promise.resolve({ data: [] as ContactWorkItemRow[] }),
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
      .limit(8),
    db
      .from("inquiries")
      .select("id,customer_name,customer_phone,service_type,created_at,status,updated_at")
      .neq("status", "spam")
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  const workItemsByContact = groupContactWorkItems((contactWorkItemsRes.data ?? []) as ContactWorkItemRow[]);

  const allInquiryRows = (recentInquiries.data ?? []) as InquiryRow[];
  const latestInquiryByPhone = buildLatestInquiryByPhone(allInquiryRows);
  const newInquiryRows = allInquiryRows.filter((inq) => inq.status === "new");
  const inquiryIdsFromContacts = new Set<string>();

  const waitingConsultations = (pendingConsultations.data ?? []).filter((row) => !row.contact_id);
  const waitingConsultationsWithContact = (pendingConsultations.data ?? []).filter((row) => Boolean(row.contact_id));
  const doneRows = doneConsultations.data ?? [];
  const consultationContactIds = new Set(
    [...(pendingConsultations.data ?? []), ...doneRows]
      .map((row) => row.contact_id)
      .filter((id): id is string => Boolean(id)),
  );

  const waitingContacts: DashboardPanelItem[] = [];
  const doneInquiryItems: DashboardPanelItem[] = [];
  const doneContactItems: DashboardPanelItem[] = [];

  for (const contact of followUpContactsRes.data ?? []) {
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

    const related = workItemsByContact.get(contact.id) ?? [];
    const pendingTask = related.find((row) => isPendingWorkItemStatus(row.status));
    const doneTask = [...related].reverse().find((row) => row.status === "done");

    if (pendingTask) {
      waitingContacts.push(mapContactFollowUpItem(contact, pendingTask, "waiting"));
      continue;
    }

    if (doneTask) {
      doneContactItems.push(mapContactFollowUpItem(contact, doneTask, "done"));
      continue;
    }

    waitingContacts.push(mapContactFollowUpItem(contact, null, "waiting"));
  }

  const standaloneInquiries = newInquiryRows
    .filter((inq) => !inquiryIdsFromContacts.has(inq.id))
    .map(mapInquiryToPanelItem);

  const consultationWaiting: DashboardPanelItem[] = [
    ...waitingConsultations.map((item) => ({
      id: `consultation-${item.id}`,
      followUpWorkItemId: item.id,
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
    })),
    ...waitingConsultationsWithContact.map((item) => ({
      id: `consultation-${item.id}`,
      followUpWorkItemId: item.id,
      consultationWorkItemId: item.id,
      contactFollowUpId: item.contact_id ?? undefined,
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
    })),
  ];

  const doneItems: DashboardPanelItem[] = [
    ...doneInquiryItems,
    ...doneContactItems,
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
