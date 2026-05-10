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

/**
 * Изпраща Web Push до всички абонирани админи (инсталиран PWA + разрешени известия).
 * Не хвърля при липсващи ключове или празен списък.
 */
export async function notifyAdminsLiveChat(opts: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  if (!ensureVapid()) return;

  const supabase = createSupabaseServiceRoleClient();
  const { data: rows, error } = await supabase
    .from("admin_web_push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error || !rows?.length) return;

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    url: opts.url ?? "/admin/chat",
    tag: opts.tag ?? "sk-admin-chat",
  });

  const staleIds: string[] = [];

  await Promise.all(
    (rows as PushRow[]).map(async (row) => {
      const sub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
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
