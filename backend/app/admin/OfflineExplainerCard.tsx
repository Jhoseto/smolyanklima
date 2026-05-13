"use client";

import { useEffect, useState } from "react";
import { CloudOff, CheckCircle2, X, Wifi, ShieldCheck, RotateCcw } from "lucide-react";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/lib/hooks/useOfflineQueue";

const SESSION_KEY = "sk-offline-explainer-dismissed";

/**
 * Голяма, ясна обяснителна карта за теренния екип.
 *
 * Показва се:
 *   - при загуба на мрежа (за първи път в сесията)
 *   - при наличие на pending sync (за да обясни какво се случва)
 *
 * След „Разбрах" се запазва решението в sessionStorage за тази сесия.
 * При reconnect показва кратко съобщение „Връзката се възстанови, качвам N записа".
 *
 * Hydration safety: до първи useEffect (mounted=true) компонентът връща null,
 * за да съответства на SSR изхода (където нямаме достъп до navigator.onLine / IDB).
 * Без този gate React хвърля hydration mismatch когато клиентът е offline.
 */
export function OfflineExplainerCard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const online = useOnlineStatus();
  const { pendingCount, isSyncing, lastResult, pendingSampleError } = useOfflineQueue();
  const [dismissed, setDismissed] = useState(false);
  const [reconnectToast, setReconnectToast] = useState<{ flushed: number } | null>(null);
  const [wasOffline, setWasOffline] = useState(false);

  // Запомняме dismiss-а за сесията, за да не дразним екипа при всеки повторен offline.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") setDismissed(true);
    } catch { /* sessionStorage блокирано */ }
  }, []);

  // Засичаме reconnect и показваме кратък success toast.
  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      return;
    }
    if (online && wasOffline) {
      // Изчакваме sync да приключи преди да покажем toast
      if (lastResult && lastResult.flushed > 0) {
        setReconnectToast({ flushed: lastResult.flushed });
        const t = setTimeout(() => setReconnectToast(null), 6000);
        return () => clearTimeout(t);
      }
    }
  }, [online, wasOffline, lastResult]);

  const handleDismiss = () => {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  // Hydration gate: до първи useEffect рендираме същото като SSR (нищо).
  if (!mounted) return null;

  // Reconnect toast — кратко съобщение, че всичко се е качило
  if (reconnectToast && online) {
    return (
      <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-900">Връзката се възстанови</p>
          <p className="text-xs text-emerald-800/90 mt-0.5">
            Качих {reconnectToast.flushed} {reconnectToast.flushed === 1 ? "запис" : "записа"} в системата. Всичко е в ред.
          </p>
        </div>
        <button
          onClick={() => setReconnectToast(null)}
          className="p-1 text-emerald-700/60 hover:bg-emerald-100 rounded-lg shrink-0"
          aria-label="Скрий"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Не показваме нищо, ако сме онлайн без чакащи
  if (online && pendingCount === 0 && !isSyncing) return null;

  // Ако вече сме обяснили — показваме само компактния badge
  if (dismissed) {
    return (
      <div className={`mb-3 rounded-xl px-3 py-2 flex items-center gap-2 ${
        !online ? "bg-slate-900 text-white border border-slate-700" : "bg-amber-50 text-amber-900 border border-amber-200"
      }`}>
        {!online ? <CloudOff className="w-4 h-4 shrink-0" /> : <Wifi className="w-4 h-4 shrink-0" />}
        <p className="text-xs font-bold flex-1 min-w-0">
          {!online
            ? `Офлайн режим${pendingCount > 0 ? ` · ${pendingCount} ${pendingCount === 1 ? "запис чака" : "записа чакат"}` : ""}`
            : isSyncing
              ? "Синхронизация със сървъра…"
              : pendingCount === 1
                ? "1 запис не е приет от сървъра"
                : `${pendingCount} записа не са приети от сървъра`}
        </p>
        <button
          onClick={() => setDismissed(false)}
          className="text-[10px] font-bold uppercase tracking-wider opacity-75 hover:opacity-100 shrink-0"
          title="Покажи подробно обяснение"
        >
          Защо?
        </button>
      </div>
    );
  }

  // Голяма обяснителна карта — отначало, и при поискване
  return (
    <div className={`mb-4 rounded-2xl border shadow-sm overflow-hidden ${
      !online ? "border-slate-700 bg-slate-900 text-white" : "border-amber-200 bg-amber-50 text-amber-900"
    }`}>
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
          !online ? "bg-white/10" : "bg-amber-200"
        }`}>
          {!online ? <CloudOff className="w-6 h-6" /> : <Wifi className="w-6 h-6 text-amber-700" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-extrabold leading-tight">
            {!online ? "Няма интернет връзка" : "Сървърът не прие записа"}
          </p>
          <p className={`text-sm mt-1 leading-relaxed ${!online ? "text-slate-200" : "text-amber-800"}`}>
            {!online
              ? "Не се притеснявайте — продължете да работите нормално. Всичко, което попълвате, се пази тук, на устройството ви."
              : `Интернетът обикновено работи — проблемът е при записа в системата. Има ${pendingCount} ${pendingCount === 1 ? "локален запис" : "локални записа"}. Отворете списъка с протоколите и натиснете „Опитай отново“, или проверете миграциите в Supabase.`}
          </p>
          {online && pendingSampleError ? (
            <p className="text-[11px] mt-2 font-mono break-words bg-white/80 text-amber-950 rounded-lg px-2 py-1.5 border border-amber-300/80">
              {pendingSampleError.length > 320 ? `${pendingSampleError.slice(0, 319)}…` : pendingSampleError}
            </p>
          ) : null}
        </div>
        <button
          onClick={handleDismiss}
          className={`p-1.5 rounded-lg shrink-0 ${
            !online ? "text-white/60 hover:bg-white/10" : "text-amber-700/60 hover:bg-amber-100"
          }`}
          aria-label="Скрий"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={`px-4 pb-3 pt-1 space-y-2 ${!online ? "border-t border-white/10" : "border-t border-amber-200/60"}`}>
        <ExplainerLine
          icon={<ShieldCheck className="w-4 h-4" />}
          dark={!online}
          title="Нищо не се губи"
          body="Всеки попълнен ред и подпис се записва веднага в паметта на телефона/таблета."
        />
        <ExplainerLine
          icon={<RotateCcw className="w-4 h-4" />}
          dark={!online}
          title={online ? "Синхронизация" : "Автоматично качване"}
          body={
            online
              ? "При успешен отговор от сървъра записите се качват сами. Ако виждате това съобщение с включен интернет, натиснете „Опитай отново“ в списъка или проверете миграциите в Supabase."
              : "Щом мрежата се появи (от мобилни данни или Wi-Fi), всичко тръгва към сървъра автоматично."
          }
        />
        <ExplainerLine
          icon={<CheckCircle2 className="w-4 h-4" />}
          dark={!online}
          title="Не повтаряйте нищо"
          body="Дори ако затворите приложението, при отваряне следващия път с мрежа промените ще се синхронизират."
        />
      </div>
    </div>
  );
}

function ExplainerLine({ icon, title, body, dark }: { icon: React.ReactNode; title: string; body: string; dark: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`mt-0.5 shrink-0 ${dark ? "text-emerald-300" : "text-amber-700"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-xs leading-snug">
        <span className={`font-bold ${dark ? "text-white" : "text-amber-900"}`}>{title}.</span>{" "}
        <span className={dark ? "text-slate-300" : "text-amber-800/90"}>{body}</span>
      </div>
    </div>
  );
}
