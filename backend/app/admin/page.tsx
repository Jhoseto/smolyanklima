import { adminDb } from "@/lib/admin/db";
import { EmailOutboxDrain } from "./EmailOutboxDrain";
import { WorkItemsPlanner } from "./WorkItemsPlanner";
import { SectionTitle, Card } from "./ui";
import { DashboardPanel } from "./DashboardPanel";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await adminDb();
  const today = formatDateKey(new Date());

  const lowStockSetting = await supabase.from("settings").select("value").eq("key", "inventory.low_stock_threshold").maybeSingle();
  const lowStockThreshold = parsePositiveInt(lowStockSetting.data?.value, 2);

  const [
    products,
    articles,
    inquiriesNew,
    outboxPending,
    outboxFailed,
    workToday,
    workOverdue,
    lowStock,
    latestInquiries,
    todaysItems,
    overdueItems,
    lowStockItems,
    failedEmails,
    followUpContacts,
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("is_published", true),
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
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .lte("stock_quantity", lowStockThreshold),
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
      .from("products")
      .select("id,name,stock_quantity,stock_status")
      .eq("is_active", true)
      .lte("stock_quantity", lowStockThreshold)
      .order("stock_quantity", { ascending: true })
      .order("name", { ascending: true })
      .limit(6),
    supabase
      .from("email_outbox")
      .select("id,to_email,subject,last_error,created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("contacts")
      .select("id,full_name,phone,customer_status,next_follow_up_at,last_contacted_at")
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", today)
      .neq("customer_status", "lost")
      .order("next_follow_up_at", { ascending: true })
      .limit(6),
  ]);

  const nProducts = products.count ?? 0;
  const nArticles = articles.count ?? 0;
  const nInquiries = inquiriesNew.count ?? 0;
  const nOutbox = outboxPending.count ?? 0;
  const nFailedEmails = outboxFailed.count ?? 0;
  const nWorkToday = workToday.count ?? 0;
  const nWorkOverdue = workOverdue.count ?? 0;
  const nLowStock = lowStock.count ?? 0;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-1 leading-tight">
          <SectionTitle title="Оперативно табло" hint="Основният работен екран: KPI + календар + бързи действия." />
        </h1>
        <p className="text-sm text-slate-500 leading-snug">
          Център за ежедневна работа: текущ статус, календар със събития и бързи действия.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Продукти", value: String(nProducts) },
          { label: "Публикувани статии", value: String(nArticles) },
          { label: "Нови запитвания", value: String(nInquiries) },
          { label: "Днес / просрочени", value: `${nWorkToday} / ${nWorkOverdue}` },
        ].map((card) => (
          <Card key={card.label} className="p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</div>
            <div className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{card.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
        <DashboardPanel
          title="Днес"
          description="Задачи и събития, които трябва да се обработят днес."
          href="/admin/history"
          empty="Няма задачи за днес."
          badge={nWorkToday}
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
          title="Ниска наличност"
          description={`Активни продукти с наличност ${lowStockThreshold} бр. или по-малко.`}
          href="/admin/products"
          empty={`Няма артикули под ${lowStockThreshold} бр.`}
          badge={nLowStock}
          tone={nLowStock > 0 ? "warning" : "neutral"}
          items={(lowStockItems.data ?? []).map((item) => ({
            title: item.name,
            productId: item.id,
            meta: `Наличност: ${item.stock_quantity} бр. · ${stockStatusLabel(item.stock_status)}`,
            detail: {
              title: item.name,
              subtitle: "Продукт с ниска наличност",
              fields: [
                { label: "Налични бройки", value: `${item.stock_quantity} бр.` },
                { label: "Складов статус", value: stockStatusLabel(item.stock_status) },
                { label: "Какво означава", value: "Провери дали трябва зареждане, скриване от каталога или промяна на статуса." },
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

      <DashboardPanel
        title="Контакти за обаждане"
        description="CRM контакти с планирано обаждане до днес."
        href="/admin/contacts"
        empty="Няма планирани обаждания за днес."
        badge={(followUpContacts.data ?? []).length}
        tone={(followUpContacts.data ?? []).length > 0 ? "info" : "neutral"}
        items={(followUpContacts.data ?? []).map((contact) => ({
          title: contact.full_name,
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
        }))}
      />

      {(nOutbox > 0 || nFailedEmails > 0) && (
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

      <div>
        {nOutbox === 0 && nFailedEmails === 0 ? null : null}
      </div>
      
      <WorkItemsPlanner />
    </div>
  );
}

function parsePositiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

function stockStatusLabel(value: string | null | undefined) {
  if (value === "out_of_stock") return "изчерпан";
  if (value === "on_order") return "поръчан";
  return "в наличност";
}

function customerStatusLabel(value: string | null | undefined) {
  if (value === "vip") return "VIP";
  if (value === "active") return "Активен";
  if (value === "lost") return "Загубен";
  return "Нов";
}

function eventLabel(value: string | null | undefined) {
  if (value === "sale") return "Продажба";
  if (value === "item_added") return "Добавяне";
  if (value === "item_removed") return "Премахване";
  if (value === "service_installation") return "Монтаж";
  if (value === "service_inspection") return "Оглед";
  if (value === "service_repair") return "Сервиз";
  if (value === "service_maintenance") return "Профилактика";
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
