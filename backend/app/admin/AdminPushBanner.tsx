"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import type { AdminRole } from "@/lib/admin/db";
import {
  ADMIN_PUSH_CHANGED_EVENT,
  enableAdminPush,
  getAdminPushStatus,
  type AdminPushStatus,
} from "./pushClient";

const DISMISS_KEY = "admin-push-banner-dismiss";

const PUSH_CONTENT: Record<string, { title: string; body: string; color: string }> = {
  default: {
    title: "Известия: чат и заявки",
    body: "Сигнал при нова жива връзка и при нова заявка — дори при затворено приложение. Управление и от Профил.",
    color: "amber",
  },
  service_staff: {
    title: "Известия за нови задания",
    body: "При ново сервизно събитие ще получите сигнал на телефона дори при затворено приложение. Управление и от Профил.",
    color: "blue",
  },
};

/**
 * Пита за разрешение и регистрира Web Push:
 * - office_staff / master_admin: за жива чат връзка
 * - service_staff: за нови сервизни задания от офиса
 */
export function AdminPushBanner({ role }: { role: AdminRole }) {
  const [status, setStatus] = useState<AdminPushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const content = PUSH_CONTENT[role] ?? PUSH_CONTENT.default;
  const isBlue = content.color === "blue";

  const refresh = useCallback(async () => {
    const next = await getAdminPushStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(ADMIN_PUSH_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(ADMIN_PUSH_CHANGED_EVENT, onChanged);
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await enableAdminPush();
      setStatus(result === "on" ? "on" : "denied");
      if (result === "denied") setError("Разрешението е отказано в настройките на телефона.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Неуспешно включване.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (
    dismissed ||
    status === "loading" ||
    status === "unsupported" ||
    status === "unconfigured" ||
    status === "on"
  ) {
    return null;
  }

  const borderCls = isBlue ? "border-blue-200" : "border-amber-200";
  const bgCls = isBlue ? "bg-blue-50/95" : "bg-amber-50/95";
  const titleCls = isBlue ? "text-blue-900" : "text-amber-900";
  const bodyCls = isBlue ? "text-blue-800/90" : "text-amber-800/90";
  const dismissCls = isBlue ? "text-blue-700/60 hover:bg-blue-100" : "text-amber-700/60 hover:bg-amber-100";
  const btnCls = isBlue ? "bg-blue-600" : "bg-amber-600";

  return (
    <div className={`shrink-0 mx-3 mt-2 mb-1 rounded-2xl border ${borderCls} ${bgCls} px-3 py-2.5 flex flex-col gap-1.5 shadow-sm`}>
      <div className="flex items-start gap-2">
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
          onClick={() => void subscribe()}
          disabled={busy || status === "denied"}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl ${btnCls} text-white text-xs font-bold disabled:opacity-50`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : status === "denied" ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {status === "denied" ? "Блокирани" : "Включи"}
        </button>
      </div>
      {error && <p className="text-[11px] font-medium text-red-700 leading-snug px-0.5">{error}</p>}
    </div>
  );
}
