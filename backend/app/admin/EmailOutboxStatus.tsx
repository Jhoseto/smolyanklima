"use client";

import { useEffect, useRef, useState } from "react";
import { InfoDot, Button } from "./ui";

const DRAIN_INTERVAL_MS = 3 * 60 * 1000;
const INITIAL_DELAY_MS = 15_000;

type OutboxStatus = "idle" | "pending" | "failed" | "ok";

function deriveStatus(pending: number, failed: number): OutboxStatus {
  if (failed > 0) return "failed";
  if (pending > 0) return "pending";
  return "ok";
}

const STATUS_LABEL: Record<OutboxStatus, string> = {
  idle: "Няма данни",
  pending: "Изчаква изпращане",
  failed: "Има грешки",
  ok: "Всичко изпратено",
};

const STATUS_CLS: Record<OutboxStatus, string> = {
  idle: "bg-slate-100 text-slate-600",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  ok: "bg-emerald-100 text-emerald-800",
};

export function EmailOutboxStatus({
  pendingCount,
  failedCount,
}: {
  pendingCount: number;
  failedCount: number;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const status = deriveStatus(pendingCount, failedCount);

  useEffect(() => {
    if (pendingCount <= 0) return;

    let cancelled = false;

    const runDrain = async () => {
      if (busyRef.current || cancelled) return;
      busyRef.current = true;
      try {
        await fetch("/api/admin/email-outbox/drain", { method: "POST" });
      } catch {
        /* ръчният бутон остава fallback */
      } finally {
        busyRef.current = false;
      }
    };

    const initial = window.setTimeout(() => void runDrain(), INITIAL_DELAY_MS);
    const interval = window.setInterval(() => void runDrain(), DRAIN_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [pendingCount]);

  if (pendingCount === 0 && failedCount === 0) return null;

  async function drain() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/email-outbox/drain", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg(`Изпратени: ${json.sent ?? 0}, пропуснати: ${json.skipped ?? 0}, грешки: ${json.failed ?? 0}`);
    } catch (e: unknown) {
      setMsg(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="font-bold text-xs inline-flex items-center gap-1.5 text-slate-900">
          Имейл опашка
          <InfoDot text="Автоматично изпращане на всеки 3 мин., докато панелът е отворен, плюс сървърен cron. Можете и ръчно." />
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_CLS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="text-sm text-slate-600 mb-2 leading-snug">
        Чакащи: <strong>{pendingCount}</strong>
        {failedCount > 0 && (
          <> · Неуспешни: <strong className="text-red-700">{failedCount}</strong></>
        )}
      </p>
      {pendingCount > 0 && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={drain}
          className={busy ? "cursor-wait opacity-70" : ""}
        >
          {busy ? "Изпращане…" : "Изпрати сега"}
        </Button>
      )}
      {msg && <p className="mt-2 text-xs text-slate-700 font-medium">{msg}</p>}
    </div>
  );
}
