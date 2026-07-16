/** Client helpers for admin Web Push (PWA). */

export type AdminPushStatus =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "off"
  | "on";

export const ADMIN_PUSH_CHANGED_EVENT = "sk-admin-push-changed";

let cachedVapidPublic: string | null | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function browserSupportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Зарежда VAPID public key от сървъра (Cloud Run secrets), с fallback към build-time NEXT_PUBLIC. */
export async function resolveVapidPublicKey(): Promise<string | null> {
  if (cachedVapidPublic !== undefined) return cachedVapidPublic;

  const fromBuild = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (fromBuild) {
    cachedVapidPublic = fromBuild;
    return fromBuild;
  }

  try {
    const res = await fetch("/api/admin/push/vapid", { credentials: "include" });
    if (!res.ok) {
      cachedVapidPublic = null;
      return null;
    }
    const json = (await res.json()) as { publicKey?: string | null; configured?: boolean };
    cachedVapidPublic = json.publicKey?.trim() || null;
    return cachedVapidPublic;
  } catch {
    cachedVapidPublic = null;
    return null;
  }
}

function notifyPushChanged(status: AdminPushStatus) {
  try {
    window.dispatchEvent(new CustomEvent(ADMIN_PUSH_CHANGED_EVENT, { detail: { status } }));
  } catch {
    /* ignore */
  }
}

async function getAdminServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const regs = await navigator.serviceWorker.getRegistrations();
  const origin = window.location.origin;
  return regs.find((r) => r.scope.includes(`${origin}/admin`)) ?? null;
}

export async function getAdminPushSubscription(): Promise<PushSubscription | null> {
  const reg = await getAdminServiceWorker();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function getAdminPushStatus(): Promise<AdminPushStatus> {
  if (!browserSupportsPush()) return "unsupported";
  const vapid = await resolveVapidPublicKey();
  if (!vapid) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  try {
    const sub = await getAdminPushSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

async function saveSubscriptionToServer(sub: PushSubscription): Promise<void> {
  const body = sub.toJSON();
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    throw new Error("Невалиден push абонамент от браузъра.");
  }
  const res = await fetch("/api/admin/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error ?? "Неуспешен запис на абонамента.");
  }
}

/** Създава/обновява локален абонамент и го записва в базата. */
export async function ensureAdminPushSaved(): Promise<PushSubscription> {
  if (!browserSupportsPush()) {
    throw new Error("Известията не се поддържат на това устройство.");
  }
  const vapidPublic = await resolveVapidPublicKey();
  if (!vapidPublic) {
    throw new Error("Push не е конфигуриран на сървъра (липсва VAPID ключ).");
  }
  if (Notification.permission !== "granted") {
    throw new Error("Разрешете известията в браузъра, после включете отново.");
  }

  const reg = await navigator.serviceWorker.register("/admin/sw-admin.js", { scope: "/admin/" });
  await reg.update();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = new Uint8Array(urlBase64ToUint8Array(vapidPublic));
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key as BufferSource,
    });
  }

  await saveSubscriptionToServer(sub);
  return sub;
}

export async function enableAdminPush(): Promise<"on" | "denied"> {
  if (!browserSupportsPush()) {
    throw new Error("Известията не се поддържат на това устройство.");
  }
  const vapid = await resolveVapidPublicKey();
  if (!vapid) {
    throw new Error("Push не е конфигуриран на сървъра (липсва VAPID ключ).");
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    notifyPushChanged("denied");
    return "denied";
  }

  await ensureAdminPushSaved();
  notifyPushChanged("on");
  return "on";
}

export async function disableAdminPush(): Promise<void> {
  const sub = await getAdminPushSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    try {
      await fetch("/api/admin/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      /* still unsubscribe locally */
    }
    await sub.unsubscribe();
  }
  notifyPushChanged("off");
}

export async function sendAdminPushTest(): Promise<void> {
  // Локалният SW може да има subscription без ред в DB — синхронизираме преди теста.
  await ensureAdminPushSaved();

  const res = await fetch("/api/admin/push/test", {
    method: "POST",
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Тестът не успя.");
  }
}
