"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import type { AdminRole } from "@/lib/admin/db";

const DISMISS_KEY = "admin-push-banner-dismiss";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const PUSH_CONTENT: Record<string, { title: string; body: string; color: string }> = {
  default: {
    title: "Известия за жива връзка",
    body: "При затворено приложение ще получавате сигнал при нов чат или съобщение от клиент (Android препоръчително).",
    color: "amber",
  },
  service_staff: {
    title: "Известия за нови задания",
    body: "При ново сервизно събитие ще получите сигнал на телефона дори при затворено приложение.",
    color: "blue",
  },
};

/**
 * Пита за разрешение и регистрира Web Push:
 * - office_staff / master_admin: за жива чат връзка
 * - service_staff: за нови сервизни задания от офиса
 */
export function AdminPushBanner({ role }: { role: AdminRole }) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const [state, setState] = useState<"idle" | "ready" | "subscribed" | "denied" | "busy" | "unsupported">("idle");
  const [dismissed, setDismissed] = useState(false);

  const content = PUSH_CONTENT[role] ?? PUSH_CONTENT.default;
  const isBlue = content.color === "blue";

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
    if (!vapidPublic || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const reg = regs.find((r) => r.scope.includes(`${window.location.origin}/admin`));
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "subscribed" : "ready");
      } catch {
        if (!cancelled) setState("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidPublic, role]);

  const subscribe = useCallback(async () => {
    if (!vapidPublic || state === "busy") return;
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/admin/sw-admin.js", { scope: "/admin/" });
      await reg.update();
      const key = new Uint8Array(urlBase64ToUint8Array(vapidPublic));
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      });
      const body = sub.toJSON();
      const res = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");
      setState("subscribed");
    } catch {
      setState("ready");
    }
  }, [vapidPublic, state]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (!vapidPublic || dismissed || state === "unsupported") return null;
  if (state === "subscribed") return null;

  const borderCls  = isBlue ? "border-blue-200"   : "border-amber-200";
  const bgCls      = isBlue ? "bg-blue-50/95"      : "bg-amber-50/95";
  const titleCls   = isBlue ? "text-blue-900"      : "text-amber-900";
  const bodyCls    = isBlue ? "text-blue-800/90"   : "text-amber-800/90";
  const dismissCls = isBlue ? "text-blue-700/60 hover:bg-blue-100"  : "text-amber-700/60 hover:bg-amber-100";
  const btnCls     = isBlue ? "bg-blue-600"        : "bg-amber-600";

  return (
    <div className={`shrink-0 mx-3 mt-2 mb-1 rounded-2xl border ${borderCls} ${bgCls} px-3 py-2.5 flex items-start gap-2 shadow-sm`}>
      <button
        type="button"
        onClick={dismiss}
        className={`order-last p-1 rounded-lg ${dismissCls} shrink-0`}
        aria-label="Скрий"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${titleCls} leading-tight`}>{content.title}</p>
        <p className={`text-[11px] ${bodyCls} mt-0.5 leading-snug`}>{content.body}</p>
      </div>
      <button
        type="button"
        onClick={subscribe}
        disabled={state === "busy" || state === "denied"}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl ${btnCls} text-white text-xs font-bold disabled:opacity-50`}
      >
        {state === "busy" ? <Loader2 className="w-4 h-4 animate-spin" /> : state === "denied" ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        {state === "denied" ? "Блокирани" : "Включи"}
      </button>
    </div>
  );
}
