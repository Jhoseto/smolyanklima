/** Client helpers for admin Web Push (PWA). */

export type AdminPushStatus = "loading" | "unsupported" | "denied" | "off" | "on";

export const ADMIN_PUSH_CHANGED_EVENT = "sk-admin-push-changed";

function vapidPublicKey(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || undefined;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isAdminPushSupported(): boolean {
  return (
    Boolean(vapidPublicKey()) &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
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
  if (!isAdminPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const sub = await getAdminPushSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enableAdminPush(): Promise<"on" | "denied"> {
  const vapidPublic = vapidPublicKey();
  if (!vapidPublic || !isAdminPushSupported()) {
    throw new Error("Известията не се поддържат на това устройство.");
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    notifyPushChanged("denied");
    return "denied";
  }

  const reg = await navigator.serviceWorker.register("/admin/sw-admin.js", { scope: "/admin/" });
  await reg.update();

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = new Uint8Array(urlBase64ToUint8Array(vapidPublic));
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key as BufferSource,
    });
  }

  const body = sub.toJSON();
  const res = await fetch("/api/admin/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Неуспешен запис на абонамента.");

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
  const res = await fetch("/api/admin/push/test", {
    method: "POST",
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Тестът не успя.");
  }
}
