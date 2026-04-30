"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ContactRow = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  updated_at: string;
};

type ContactHistoryRow = {
  id: string;
  event_code?: string | null;
  type: string;
  status: "planned" | "in_progress" | "done" | "cancelled";
  title: string;
  due_date?: string | null;
  total_amount?: number | null;
  created_at: string;
  products?: { name?: string; slug?: string } | null;
};

export default function AdminContactsPage() {
  const [items, setItems] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<ContactRow | null>(null);
  const [history, setHistory] = useState<ContactHistoryRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ fullName: "", phone: "", email: "", address: "", notes: "" });

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    sp.set("perPage", "200");
    return sp.toString();
  }, [q]);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contacts?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      const rows = (json.data ?? []) as ContactRow[];
      setItems(rows);
      if (!selected && rows[0]?.id) setSelected(rows[0].id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setDetail((json.data?.contact ?? null) as ContactRow | null);
      setHistory((json.data?.history ?? []) as ContactHistoryRow[]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function createContact() {
    if (!newForm.fullName.trim() || !newForm.phone.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newForm.fullName.trim(),
          phone: newForm.phone.trim(),
          email: newForm.email.trim() || null,
          address: newForm.address.trim() || null,
          notes: newForm.notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при създаване");
      const id = (json as any).data?.id as string;
      setNewForm({ fullName: "", phone: "", email: "", address: "", notes: "" });
      await loadList();
      if (id) setSelected(id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>Контакти</h1>
      <p style={{ margin: "4px 0 12px", color: "#64748b", fontSize: 12 }}>CRM списък с история на събитията за всеки контакт.</p>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12 }}>
        <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "white", padding: 10 }}>
          <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси контакт..." style={inp} />
            <input value={newForm.fullName} onChange={(e) => setNewForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Ново лице*" style={inp} />
            <input value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Телефон*" style={inp} />
            <input value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} placeholder="Имейл" style={inp} />
            <input value={newForm.address} onChange={(e) => setNewForm((f) => ({ ...f, address: e.target.value }))} placeholder="Адрес" style={inp} />
            <textarea value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Бележка" style={{ ...inp, resize: "vertical" }} />
            <button onClick={() => void createContact()} disabled={creating || !newForm.fullName.trim() || !newForm.phone.trim()} style={btn(creating || !newForm.fullName.trim() || !newForm.phone.trim())}>
              {creating ? "Създаване..." : "Създай контакт"}
            </button>
          </div>

          <div style={{ maxHeight: "60vh", overflow: "auto", borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
            {loading ? <div style={{ fontSize: 12, color: "#64748b" }}>Зареждане...</div> : null}
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  background: selected === c.id ? "#e0f2fe" : "white",
                  marginBottom: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{c.full_name}</div>
                <div style={{ fontSize: 12, color: "#475569" }}>{c.phone}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(c.updated_at).toLocaleString()}</div>
              </button>
            ))}
            {!loading && items.length === 0 ? <div style={{ fontSize: 12, color: "#64748b" }}>Няма контакти.</div> : null}
          </div>
        </section>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "white", padding: 12 }}>
          {!detail ? (
            <div style={{ color: "#64748b", fontSize: 12 }}>Избери контакт.</div>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>{detail.full_name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div style={metaBox}><strong>Телефон:</strong> {detail.phone || "—"}</div>
                <div style={metaBox}><strong>Имейл:</strong> {detail.email || "—"}</div>
                <div style={{ ...metaBox, gridColumn: "1 / -1" }}><strong>Адрес:</strong> {detail.address || "—"}</div>
                <div style={{ ...metaBox, gridColumn: "1 / -1" }}><strong>Бележки:</strong> {detail.notes || "—"}</div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}>История на контакта</div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      {["Събитие", "Статус", "Продукт", "Сума", "Дата"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#334155" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "#0f172a" }}>{r.title}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "#475569" }}>{r.status}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "#475569" }}>{r.products?.name ?? "—"}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "#475569" }}>
                          {r.total_amount != null ? `€${Number(r.total_amount).toLocaleString()}` : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "#64748b" }}>{new Date(r.due_date || r.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {history.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 10, fontSize: 12, color: "#64748b" }}>Няма събития за този контакт.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const inp: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 12,
  color: "#0f172a",
  background: "white",
};

const metaBox: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  padding: "8px 10px",
  fontSize: 12,
  color: "#334155",
};

function btn(disabled: boolean): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #0ea5e9",
    background: disabled ? "#bae6fd" : "#0ea5e9",
    color: "white",
    fontWeight: 700,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}
