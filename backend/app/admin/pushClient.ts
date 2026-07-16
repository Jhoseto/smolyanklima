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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Чист Uint8Array за applicationServerKey (избягва SharedArrayBuffer typing + Chrome quirks). */
function vapidApplicationServerKey(base64String: string): Uint8Array {
  const bytes = urlBase64ToUint8Array(base64String);
  return bytes.slice();
}

function browserSupportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** Зарежда VAPID public key от сървъра (Cloud Run env), с fallback към build-time NEXT_PUBLIC. */
export async function resolveVapidPublicKey(): Promise<string | null> {
  // Кешираме само успешен ключ — null не се кешира, за да може retry след deploy на env.
  if (typeof cachedVapidPublic === "string" && cachedVapidPublic.length > 0) {
    return cachedVapidPublic;
  }

  const fromBuild = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (fromBuild) {
    cachedVapidPublic = fromBuild;
    return fromBuild;
  }

  try {
    const res = await withTimeout(
      fetch("/api/admin/push/vapid", { credentials: "include", cache: "no-store" }),
      10000,
      "Сървърът не отговори за push настройките.",
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { publicKey?: string | null; configured?: boolean };
    const key = json.publicKey?.trim() || null;
    if (key) cachedVapidPublic = key;
    return key;
  } catch {
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
  return (
    regs.find((r) => {
      const script =
        r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
      return script.includes("/admin/sw-admin.js") || /\/admin\/?$/.test(r.scope);
    }) ?? null
  );
}

async function waitForActiveWorker(reg: ServiceWorkerRegistration, ms = 12000): Promise<void> {
  if (reg.active) return;

  const sw = reg.installing || reg.waiting;
  if (!sw) {
    // Без installing/waiting и без active — регистрацията е счупена (често 404 на SW файла).
    throw new Error("Service worker не е активен. Преинсталирайте PWA или опитайте пак след deploy.");
  }
  if (sw.state === "activated") return;

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const onChange = () => {
        if (sw.state === "activated") {
          sw.removeEventListener("statechange", onChange);
          resolve();
        } else if (sw.state === "redundant") {
          sw.removeEventListener("statechange", onChange);
          reject(new Error("Service worker стана redundant."));
        }
      };
      sw.addEventListener("statechange", onChange);
    }),
    ms,
    "Service worker не се активира. Затвори напълно приложението и го отвори отново.",
  );
}

async function assertAdminSwScriptAvailable(): Promise<void> {
  const res = await withTimeout(
    fetch("/admin/sw-admin.js", { method: "GET", cache: "no-store" }),
    10000,
    "Не може да се зареди service worker файлът.",
  );
  if (!res.ok) {
    throw new Error(`Липсва /admin/sw-admin.js (HTTP ${res.status}). Нужен е нов deploy на Docker image.`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    throw new Error("Service worker се връща като HTML вместо JS — проверете deploy/CDN.");
  }
}

async function getOrRegisterAdminSw(): Promise<ServiceWorkerRegistration> {
  await assertAdminSwScriptAvailable();

  let reg = await getAdminServiceWorker();
  if (!reg) {
    reg = await withTimeout(
      navigator.serviceWorker.register("/admin/sw-admin.js", { scope: "/admin/" }),
      12000,
      "Регистрацията на service worker закъсня. Провери мрежата и опитай пак.",
    );
  }
  // Не чакаме reg.update() — на мобилен PWA често виси завинаги.
  void reg.update().catch(() => {});
  await waitForActiveWorker(reg);
  return reg;
}

export async function getAdminPushSubscription(): Promise<PushSubscription | null> {
  const reg = await getAdminServiceWorker();
  if (!reg?.pushManager) return null;
  return (await reg.pushManager.getSubscription()) ?? null;
}

export async function getAdminPushStatus(): Promise<AdminPushStatus> {
  if (!browserSupportsPush()) return "unsupported";
  // iOS: push само в инсталирано PWA (Home Screen), и то с по-нова iOS.
  if (isIosDevice() && !isStandalonePwa()) return "unsupported";
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
  const res = await withTimeout(
    fetch("/api/admin/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        endpoint: body.endpoint,
        keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
      }),
    }),
    12000,
    "Записът на абонамента закъсня.",
  );
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
  if (isIosDevice() && !isStandalonePwa()) {
    throw new Error("На iPhone добавете приложението към Начален екран, после включете известията.");
  }
  const vapidPublic = await resolveVapidPublicKey();
  if (!vapidPublic) {
    throw new Error("Push не е конфигуриран на сървъра (липсва VAPID ключ).");
  }
  if (Notification.permission !== "granted") {
    throw new Error("Разрешете известията, после включете отново.");
  }

  const reg = await getOrRegisterAdminSw();

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidApplicationServerKey(vapidPublic),
        }),
        20000,
        "Абонаментът закъсня. Опитайте пак или рестартирайте приложението.",
      );
    } catch (e: unknown) {
      // Стар абонамент с друг VAPID ключ → махаме и пробваме отново
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe().catch(() => {});
        sub = await withTimeout(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidApplicationServerKey(vapidPublic),
          }),
          20000,
          "Абонаментът закъсня след повторен опит.",
        );
      } else {
        throw e instanceof Error ? e : new Error("Неуспешен push абонамент.");
      }
    }
  }

  await saveSubscriptionToServer(sub);
  return sub;
}

export async function enableAdminPush(): Promise<"on" | "denied"> {
  if (!browserSupportsPush()) {
    throw new Error("Известията не се поддържат на това устройство.");
  }
  if (isIosDevice() && !isStandalonePwa()) {
    throw new Error("На iPhone: Сподели → Добавяне към Начален екран, после отворете иконата и включете.");
  }
  const vapid = await resolveVapidPublicKey();
  if (!vapid) {
    throw new Error("Push не е конфигуриран на сървъра (липсва VAPID ключ).");
  }

  // Важно: permission от user gesture; с timeout защото на някои телефони promise-ът виси.
  const perm = await withTimeout(
    Promise.resolve(Notification.requestPermission()),
    30000,
    "Диалогът за разрешение не се появи. Проверете настройките на приложението за известия.",
  );
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
      await withTimeout(
        fetch("/api/admin/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ endpoint }),
        }),
        10000,
        "Изключването закъсня.",
      );
    } catch {
      /* still unsubscribe locally */
    }
    await sub.unsubscribe().catch(() => {});
  }
  notifyPushChanged("off");
}

export async function sendAdminPushTest(): Promise<void> {
  await ensureAdminPushSaved();

  const res = await withTimeout(
    fetch("/api/admin/push/test", {
      method: "POST",
      credentials: "include",
    }),
    15000,
    "Тестът закъсня.",
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "Тестът не успя.");
  }
}
