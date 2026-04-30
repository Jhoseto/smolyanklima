"use client";

import { useState } from "react";

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
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, maxWidth: 520 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Имейл опашка</div>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
        Има {pendingCount} чакащи съобщения. Натиснете за изпращане чрез Resend (ако е конфигуриран <code>RESEND_API_KEY</code>).
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={drain}
        style={{ padding: "8px 12px", borderRadius: 10, fontWeight: 600, fontSize: 12, border: "1px solid #e5e7eb", cursor: busy ? "wait" : "pointer" }}
      >
        {busy ? "Изпращане…" : "Изпрати pending имейли"}
      </button>
      {msg ? <p style={{ marginTop: 10, fontSize: 13 }}>{msg}</p> : null}
    </div>
  );
}
