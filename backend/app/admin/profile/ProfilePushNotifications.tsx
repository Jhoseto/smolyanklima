"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Vibrate } from "lucide-react";
import {
  ADMIN_PUSH_CHANGED_EVENT,
  disableAdminPush,
  enableAdminPush,
  ensureAdminPushSaved,
  getAdminPushStatus,
  sendAdminPushTest,
  type AdminPushStatus,
} from "../pushClient";

const STATUS_LABEL: Record<Exclude<AdminPushStatus, "loading">, string> = {
  on: "Включени",
  off: "Изключени",
  denied: "Блокирани",
  unsupported: "Недостъпни",
  unconfigured: "Няма VAPID",
};

/**
 * Компактен ред в профила: статус + включи/изключи + тест.
 */
export function ProfilePushNotifications() {
  const [status, setStatus] = useState<AdminPushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getAdminPushStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener(ADMIN_PUSH_CHANGED_EVENT, onChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(ADMIN_PUSH_CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Ако браузърът вече има subscription, но DB няма ред — записваме тихо при отворен профил.
  useEffect(() => {
    if (status !== "on") return;
    void ensureAdminPushSaved().catch(() => {
      /* ignore — бутонът Тест ще покаже грешката */
    });
  }, [status]);

  useEffect(() => {
    if (!msg) return;
    // По-дълго на грешки — на телефон трябва време за четене
    const ms = /закъсня|грешка|неуспеш|разреш|iphone|сървър/i.test(msg) ? 6000 : 2800;
    const t = setTimeout(() => setMsg(null), ms);
    return () => clearTimeout(t);
  }, [msg]);

  const toggle = async () => {
    if (busy || status === "loading" || status === "unsupported" || status === "denied" || status === "unconfigured") {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (status === "on") {
        await disableAdminPush();
        setStatus("off");
        setMsg("Известията са изключени.");
      } else {
        const result = await enableAdminPush();
        setStatus(result === "on" ? "on" : "denied");
        setMsg(result === "on" ? "Известията са включени." : "Разрешението е отказано.");
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Грешка");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (busy || status !== "on") return;
    setBusy(true);
    setMsg(null);
    try {
      await sendAdminPushTest();
      setMsg("Тестът е изпратен — проверете нотификацията.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Тестът не успя.");
    } finally {
      setBusy(false);
    }
  };

  const canToggle = status === "on" || status === "off";
  const isOn = status === "on";
  const isBroken = status === "denied" || status === "unconfigured" || status === "unsupported";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <div className="flex items-center gap-2 min-h-[36px]">
        <div
          className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
            isOn ? "bg-emerald-100 text-emerald-700" : isBroken ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-600"
          }`}
        >
          {status === "loading" || busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isOn ? (
            <Bell className="w-3.5 h-3.5" />
          ) : (
            <BellOff className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="flex-1 min-w-0 leading-tight">
          <p className="text-xs font-bold text-slate-800">Известия</p>
          <p className="text-[11px] text-slate-500 truncate">
            {status === "loading" ? "…" : (
              <>
                <span
                  className={
                    isOn
                      ? "text-emerald-700 font-semibold"
                      : status === "denied"
                        ? "text-red-600 font-semibold"
                        : "text-slate-600 font-semibold"
                  }
                >
                  {STATUS_LABEL[status]}
                </span>
                {status === "denied" ? " · настройки на телефона" : null}
                {status === "unsupported" ? " · нужен Chrome/Android PWA или iOS Home Screen" : null}
                {status === "unconfigured" ? " · липсва в Cloud Run" : null}
              </>
            )}
          </p>
        </div>

        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={isOn ? "Изключи известията" : "Включи известията"}
            disabled={busy}
            onClick={() => void toggle()}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
              isOn ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isOn ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        )}

        {isOn && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void test()}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Изпрати тестово известие"
          >
            <Vibrate className="w-3 h-3" />
            Тест
          </button>
        )}
      </div>

      {msg && (
        <p className="mt-1.5 text-[11px] font-medium text-slate-600 leading-snug">{msg}</p>
      )}
    </div>
  );
}
