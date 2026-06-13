import webpush from "web-push";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@smolyanklima.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

type PushRow = { id: string; endpoint: string; p256dh: string; auth: string };

/** Изпраща payload до списък абонаменти; премахва изтекли (410/404). */
async function sendToRows(rows: PushRow[], payload: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  const staleIds: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        await webpush.sendNotification(sub, payload, { TTL: 3600 });
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) staleIds.push(row.id);
      }
    }),
  );

  if (staleIds.length > 0) {
    await supabase.from("admin_web_push_subscriptions").delete().in("id", staleIds);
  }
}

/**
 * Изпраща Web Push до всички абонирани админи (чат от клиент).
 * service_staff не получават тези известия (нямат чат).
 */
export async function notifyAdminsLiveChat(opts: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  if (!ensureVapid()) return;

  const supabase = createSupabaseServiceRoleClient();

  // Само master_admin и office_staff — сервизните техници нямат чат
  const { data: rows, error } = await supabase
    .from("admin_web_push_subscriptions")
    .select("id, endpoint, p256dh, auth, admin_user_id!inner(role)")
    .in("admin_user_id.role", ["master_admin", "office_staff"]);

  if (error || !rows?.length) return;

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    url: opts.url ?? "/admin/chat",
    tag: opts.tag ?? "sk-admin-chat",
  });

  await sendToRows(rows as unknown as PushRow[], payload);
}

/** Кодове на сервизни събития, за които уведомяваме сервизните техници. */
const SERVICE_EVENT_CODES = new Set([
  "service_installation",
  "service_maintenance",
  "service_on_site",
  "service_in_shop",
]);

/**
 * Изпраща Web Push до всички абонирани service_staff при ново сервизно събитие.
 * Fire-and-forget — не забавя отговора на API-то.
 * Payload е минимален (~250 байта) — не натоварва трафика.
 */
export async function notifyServiceStaffNewEvent(opts: {
  eventCode: string;
  title: string;
  dueDate?: string | null;
  customerName?: string | null;
}): Promise<void> {
  if (!SERVICE_EVENT_CODES.has(opts.eventCode)) return;
  if (!ensureVapid()) return;

  const supabase = createSupabaseServiceRoleClient();

  const { data: rows, error } = await supabase
    .from("admin_web_push_subscriptions")
    .select("id, endpoint, p256dh, auth, admin_user_id!inner(role)")
    .eq("admin_user_id.role", "service_staff");

  if (error || !rows?.length) return;

  const dateStr = opts.dueDate
    ? new Date(opts.dueDate).toLocaleDateString("bg-BG", { day: "numeric", month: "long" })
    : "";
  const body = [opts.customerName, dateStr].filter(Boolean).join(" · ");

  const payload = JSON.stringify({
    title: `📋 ${opts.title}`,
    body: body || "Ново задание",
    url: "/admin",
    tag: "sk-service-event",
  });

  await sendToRows(rows as unknown as PushRow[], payload);
}
