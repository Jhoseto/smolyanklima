"use client";

import { useState } from "react";
import { InfoDot, Card, Button } from "./ui";

export function EmailOutboxDrain({ pendingCount }: { pendingCount: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  if (pendingCount === 0) return null;

  return (
    <Card className="p-3 w-full">
      <div className="font-bold text-xs mb-1 inline-flex items-center gap-1.5 text-slate-900">
        Имейл опашка
        <InfoDot text="Ръчно пуска изпращане на чакащи имейли от outbox." />
      </div>
      <p className="text-sm text-slate-500 mb-2 leading-snug">
        Има {pendingCount} чакащи съобщения. Натиснете за изпращане чрез Resend (ако е конфигуриран <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-slate-700">RESEND_API_KEY</code>).
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={drain}
        className={busy ? "cursor-wait opacity-70" : ""}
      >
        {busy ? "Изпращане…" : "Изпрати pending имейли"}
      </Button>
      {msg && <p className="mt-2 text-xs text-slate-700 font-medium">{msg}</p>}
    </Card>
  );
}
