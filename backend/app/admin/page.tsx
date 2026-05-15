import { adminSession } from "@/lib/admin/db";
import { EmailOutboxDrain } from "./EmailOutboxDrain";
import { SectionTitle, Card } from "./ui";
import { DashboardPanel } from "./DashboardPanel";
import { CallFollowUpsPanel } from "./CallFollowUpsPanel";
import { WorkItemsPlanner } from "./WorkItemsPlanner";
import { fetchCallFollowUpPanelItems } from "@/lib/admin/call-follow-up-items";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await adminSession();
  const supabase = session.db;
  const readOnlyDashboard = session.role === "service_staff";
  const today = formatDateKey(new Date());

  const [
    products,
    inquiriesNew,
    outboxPending,
    outboxFailed,
    workToday,
    workOverdue,
    latestInquiries,
    todaysItems,
    overdueItems,
    failedEmails,
    callPanelItems,
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .eq("due_date", today)
      .in("status", ["planned", "in_progress"]),
    supabase
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .lt("due_date", today)
      .in("status", ["planned", "in_progress"]),
    supabase
      .from("inquiries")
      .select("id,customer_name,customer_phone,service_type,created_at")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("work_items")
      .select("id,title,status,priority,event_code,customer_name,customer_phone,due_date")
      .eq("due_date", today)
      .in("status", ["planned", "in_progress"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("work_items")
      .select("id,title,status,priority,event_code,customer_name,customer_phone,due_date")
      .lt("due_date", today)
      .in("status", ["planned", "in_progress"])
      .order("due_date", { ascending: true })
      .limit(6),
    supabase
      .from("email_outbox")
      .select("id,to_email,subject,last_error,created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(4),
    fetchCallFollowUpPanelItems(supabase, today),
  ]);

  const nProducts = products.count ?? 0;
  const nInquiries = inquiriesNew.count ?? 0;
  const nOutbox = outboxPending.count ?? 0;
  const nFailedEmails = outboxFailed.count ?? 0;
  const nWorkToday = workToday.count ?? 0;
  const nWorkOverdue = workOverdue.count ?? 0;

  return (
    <div className="w-full space-y-3">
      {/* Operations planner — top of dashboard */}
      <WorkItemsPlanner readOnly={readOnlyDashboard} />

      <div>
        <h1 className="text-lg md:text-xl font-bold text-slate-900 mb-0.5 leading-tight">
          <SectionTitle
            title="Оперативно табло"
            hint={
              readOnlyDashboard
                ? "Преглед на KPI и календар. Създаване и редакция на събития са достъпни за офис и администратор."
                : "Основният работен екран: KPI + бързи действия."
            }
          />
        </h1>
        {readOnlyDashboard && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            Преглед само за четене — не можете да добавяте или редактирате събития от календара.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Продукти", value: String(nProducts) },
          { label: "Нови запитвания", value: String(nInquiries) },
          { label: "Днес / просрочени", value: `${nWorkToday} / ${nWorkOverdue}` },
        ].map((card) => (
          <Card key={card.label} className="p-4 shadow-sm ring-1 ring-slate-200/70 bg-white">
            <div className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{card.label}</div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 md:mt-2 tabular-nums">{card.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
        <DashboardPanel
          title="Днес"
          description="Задачи и събития, които трябва да се обработят днес."
          href="/admin/history"
          empty="Няма задачи за днес."
          badge={nWorkToday}
          readOnly={readOnlyDashboard}
          items={(todaysItems.data ?? []).map((item) => ({
            title: item.title,
            meta: [eventLabel(item.event_code), item.customer_name, item.customer_phone].filter(Boolean).join(" · "),
            detail: {
              title: item.title,
              subtitle: "Задача за днес",
              fields: [
                { label: "Тип", value: eventLabel(item.event_code) },
                { label: "Статус", value: workStatusLabel(item.status) },
                { label: "Приоритет", value: priorityLabel(item.priority) },
                { label: "Клиент", value: item.customer_name },
                { label: "Телефон", value: item.customer_phone },
                { label: "Дата", value: formatBgDate(item.due_date) },
              ],
            },
          }))}
        />
        <DashboardPanel
          title="Просрочени"
          description="Задачи с минала дата, които още чакат действие."
          href="/admin/history"
          empty="Няма просрочени задачи."
          badge={nWorkOverdue}
          tone={nWorkOverdue > 0 ? "danger" : "neutral"}
          readOnly={readOnlyDashboard}
          items={(overdueItems.data ?? []).map((item) => ({
            title: item.title,
            meta: [formatBgDate(item.due_date), item.customer_name, item.customer_phone].filter(Boolean).join(" · "),
            detail: {
              title: item.title,
              subtitle: "Просрочена задача",
              fields: [
                { label: "Тип", value: eventLabel(item.event_code) },
                { label: "Статус", value: workStatusLabel(item.status) },
                { label: "Приоритет", value: priorityLabel(item.priority) },
                { label: "Клиент", value: item.customer_name },
                { label: "Телефон", value: item.customer_phone },
                { label: "Планирана дата", value: formatBgDate(item.due_date) },
              ],
            },
          }))}
        />
        <DashboardPanel
          title="Нови заявки"
          description="Нови клиентски запитвания от сайта, които чакат обработка."
          href="/admin/inquiries"
          empty="Няма нови заявки."
          badge={nInquiries}
          tone={nInquiries > 0 ? "info" : "neutral"}
          readOnly={readOnlyDashboard}
          items={(latestInquiries.data ?? []).map((item) => ({
            title: item.customer_name,
            meta: [item.customer_phone, serviceTypeLabel(item.service_type), formatBgDateTime(item.created_at)].filter(Boolean).join(" · "),
            detail: {
              title: item.customer_name,
              subtitle: "Ново клиентско запитване",
              fields: [
                { label: "Телефон", value: item.customer_phone },
                { label: "Тип заявка", value: serviceTypeLabel(item.service_type) },
                { label: "Получено", value: formatBgDateTime(item.created_at) },
                { label: "Следващо действие", value: "Отвори всички заявки, прегледай съобщението и маркирай като В работа / Контакт / Оглед." },
              ],
            },
          }))}
        />
      </div>

      <CallFollowUpsPanel initialItems={callPanelItems} readOnly={readOnlyDashboard} />

      {!readOnlyDashboard && (nOutbox > 0 || nFailedEmails > 0) && (
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Email outbox</div>
              <div className="text-sm text-slate-500">
                Pending: {nOutbox} · Failed: {nFailedEmails}
              </div>
            </div>
            <EmailOutboxDrain pendingCount={nOutbox} />
          </div>
          {(failedEmails.data ?? []).length > 0 && (
            <div className="mt-3 grid gap-2">
              {(failedEmails.data ?? []).map((email) => (
                <div key={email.id} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm">
                  <div className="font-semibold text-red-900">{email.subject}</div>
                  <div className="mt-0.5 text-xs text-red-700">
                    {email.to_email} · {email.last_error ?? "Грешка при изпращане"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

    </div>
  );
}

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

function eventLabel(value: string | null | undefined) {
  if (value === "sale") return "Продажба";
  if (value === "item_added") return "Добавяне на продукт";
  if (value === "item_removed") return "Премахване на продукт";
  if (value === "service_installation") return "Монтаж";
  if (value === "service_maintenance") return "Профилактика";
  if (value === "service_on_site") return "Сервиз на терен";
  if (value === "service_in_shop") return "Сервиз в склад";
  if (value === "consultation") return "Консултация";
  return "Задача";
}

function serviceTypeLabel(value: string | null | undefined) {
  if (value === "sale") return "Продажба";
  if (value === "installation") return "Монтаж";
  if (value === "maintenance") return "Профилактика";
  if (value === "repair") return "Ремонт";
  return "";
}

function priorityLabel(value: string | null | undefined) {
  if (value === "high") return "Висок";
  if (value === "low") return "Нисък";
  return "Среден";
}

function workStatusLabel(value: string | null | undefined) {
  if (value === "planned") return "Планирана";
  if (value === "in_progress") return "В работа";
  if (value === "done") return "Готова";
  if (value === "cancelled") return "Отказана";
  return "Неизвестен";
}
