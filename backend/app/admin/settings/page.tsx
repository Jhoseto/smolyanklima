"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

type SettingRow = { key: string; value: string | null; description: string | null; updated_at: string };

export default function AdminSettingsPage() {
  const [items, setItems] = useState<SettingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newRow, setNewRow] = useState({ key: "", value: "", description: "" });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
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
  }, []);

  async function saveRow(row: { key: string; value: string | null; description: string | null }) {
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Грешка");
      return;
    }
    await load();
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900 }}>Настройки</h1>
        <button onClick={load} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 800 }}>
          Обнови
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Добави / обнови настройка</div>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "start" }}>
          <label>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Ключ</div>
            <input value={newRow.key} onChange={(e) => setNewRow({ ...newRow, key: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }} />
          </label>
          <label>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Стойност</div>
            <input value={newRow.value} onChange={(e) => setNewRow({ ...newRow, value: e.target.value })} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }} />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Описание</div>
            <textarea value={newRow.description} onChange={(e) => setNewRow({ ...newRow, description: e.target.value })} rows={2} style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }} />
          </label>
        </div>
        <button
          onClick={() => saveRow({ key: newRow.key.trim(), value: newRow.value || null, description: newRow.description || null })}
          disabled={!newRow.key.trim()}
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #0ea5e9",
            background: "#0ea5e9",
            color: "white",
            fontWeight: 900,
            opacity: newRow.key.trim() ? 1 : 0.6,
            cursor: newRow.key.trim() ? "pointer" : "not-allowed",
          }}
        >
          Запази
        </button>
      </div>

      {loading ? (
        <div>Зареждане...</div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                {["Ключ", "Стойност", "Описание", "Обновено", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#374151" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.key} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 900 }}>{s.key}</td>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{s.value ?? "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{s.description ?? "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{new Date(s.updated_at).toLocaleString()}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => saveRow({ key: s.key, value: s.value, description: s.description })}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 800 }}
                      title="Запази (без промяна) – полезно за проверка на права"
                    >
                      Тест запис
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "#6b7280" }}>
                    Няма настройки.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

