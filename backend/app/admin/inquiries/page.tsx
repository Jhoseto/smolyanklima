"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

export default function AdminInquiriesPage() {
  return <AdminInquiriesClient />;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: `${color}20`, color }}>
      {label}
    </span>
  );
}

function statusLabel(status: string) {
  if (status === "new") return { label: "Ново", color: "#ea580c" };
  if (status === "in_progress") return { label: "В работа", color: "#0284c7" };
  if (status === "done") return { label: "Приключено", color: "#16a34a" };
  if (status === "spam") return { label: "Спам", color: "#991b1b" };
  return { label: status || "—", color: "#6b7280" };
}

function priorityLabel(priority: string) {
  if (priority === "high") return { label: "Висок", color: "#b91c1c" };
  if (priority === "medium") return { label: "Среден", color: "#a16207" };
  if (priority === "low") return { label: "Нисък", color: "#374151" };
  return { label: priority || "—", color: "#6b7280" };
}

type Inquiry = {
  id: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  message?: string | null;
  service_type?: string | null;
  status: string;
  priority: string;
  assigned_to?: string | null;
  admin_notes?: string | null;
  created_at: string;
};

function AdminInquiriesClient() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [notesForId, setNotesForId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [status, q]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries${queryString}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  async function quickUpdate(id: string, patch: { status?: string; priority?: string; adminNotes?: string | null }) {
    setError(null);
    const body: Record<string, unknown> = {};
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.priority !== undefined) body.priority = patch.priority;
    if (patch.adminNotes !== undefined) body.adminNotes = patch.adminNotes;
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Грешка");
      return;
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
              ...(patch.adminNotes !== undefined ? { admin_notes: patch.adminNotes } : {}),
            }
          : it,
      ),
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>Запитвания</h1>
        <button onClick={load} style={{ padding: "8px 11px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 600, fontSize: 12 }}>
          Обнови
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Статус</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
            <option value="">Всички</option>
            <option value="new">Ново</option>
            <option value="in_progress">В работа</option>
            <option value="done">Приключено</option>
            <option value="spam">Спам</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>Търсене</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Име, телефон, имейл, текст..." style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", width: "100%" }} />
        </label>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div>Зареждане...</div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "white" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                {["Клиент", "Контакт", "Статус", "Приоритет", "Източник", "Създадено", "Действия"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#374151" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const s = statusLabel(i.status);
                const p = priorityLabel(i.priority);
                return (
                  <tr key={i.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 900 }}>{i.customer_name}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                      <div>{i.customer_phone}</div>
                      {i.customer_email ? <div>{i.customer_email}</div> : null}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={s.label} color={s.color} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Badge label={p.label} color={p.color} />
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{i.source}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{new Date(i.created_at).toLocaleString()}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button type="button" onClick={() => setNotesForId(i.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #0ea5e9", color: "#0369a1", fontWeight: 800 }}>
                          Бележки{i.admin_notes ? " ●" : ""}
                        </button>
                        <button type="button" onClick={() => quickUpdate(i.id, { status: "in_progress" })} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800 }}>
                          В работа
                        </button>
                        <button type="button" onClick={() => quickUpdate(i.id, { status: "done" })} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800 }}>
                          Приключи
                        </button>
                        <button type="button" onClick={() => quickUpdate(i.id, { status: "spam" })} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 800 }}>
                          Спам
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 14, color: "#6b7280" }}>
                    Няма запитвания.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {notesForId ? (
        <InquiryNotesModal
          inquiryId={notesForId}
          initialNotes={items.find((x) => x.id === notesForId)?.admin_notes ?? ""}
          onClose={() => setNotesForId(null)}
          onSave={async (adminNotes) => {
            await quickUpdate(notesForId, { adminNotes });
            setNotesForId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function InquiryNotesModal({
  inquiryId,
  initialNotes,
  onClose,
  onSave,
}: {
  inquiryId: string;
  initialNotes: string;
  onClose: () => void;
  onSave: (notes: string | null) => Promise<void>;
}) {
  const [text, setText] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", borderRadius: 16, maxWidth: 560, width: "100%", padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Вътрешни бележки (CRM)</div>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>ID: {inquiryId}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Бележки само за екипа…"
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 12 }}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 800 }}>
            Отказ
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(text.trim() || null);
              } finally {
                setSaving(false);
              }
            }}
            style={{ padding: "10px 14px", borderRadius: 12, background: "#0ea5e9", color: "white", fontWeight: 800, border: "none", cursor: saving ? "wait" : "pointer" }}
          >
            {saving ? "Запис…" : "Запази"}
          </button>
        </div>
      </div>
    </div>
  );
}

