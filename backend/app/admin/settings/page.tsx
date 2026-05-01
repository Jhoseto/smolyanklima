"use client";

import { useEffect, useState } from "react";
import { HelpRow, SectionTitle, HelpCard, Card, Input, Textarea, Button, Table, Th, Td } from "../ui";
import { RefreshCw, Save } from "lucide-react";

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
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 mb-1 leading-tight">
            <SectionTitle title="Настройки" hint="Ключ-стойност конфигурация за системни параметри." />
          </h1>
        </div>
        <Button variant="secondary" onClick={load} className="gap-2 shadow-sm">
          <RefreshCw className="w-4 h-4" /> Обнови
        </Button>
      </div>

      <HelpCard>
        <HelpRow items={["Добави или обнови ключ от формата", "Таблицата показва текущите стойности", "Тест запис валидира права за запис"]} />
      </HelpCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      )}

      <Card className="p-3 bg-slate-50 border-slate-200">
        <div className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Добави / обнови настройка</div>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-start">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ключ</span>
            <Input value={newRow.key} onChange={(e) => setNewRow({ ...newRow, key: e.target.value })} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Стойност</span>
            <Input value={newRow.value} onChange={(e) => setNewRow({ ...newRow, value: e.target.value })} />
          </label>
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Описание</span>
            <Textarea value={newRow.description} onChange={(e) => setNewRow({ ...newRow, description: e.target.value })} rows={2} />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            onClick={() => saveRow({ key: newRow.key.trim(), value: newRow.value || null, description: newRow.description || null })}
            disabled={!newRow.key.trim()}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Запази настройка
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-slate-500 font-medium">Зареждане...</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Ключ</Th>
              <Th>Стойност</Th>
              <Th>Описание</Th>
              <Th>Обновено</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.key} className="hover:bg-slate-50 transition-colors">
                <Td className="font-bold text-slate-900 font-mono text-xs">{s.key}</Td>
                <Td>
                  <div className="max-w-[300px] truncate font-mono text-xs text-slate-600" title={s.value ?? ""}>
                    {s.value ?? "—"}
                  </div>
                </Td>
                <Td className="text-slate-500">{s.description ?? "—"}</Td>
                <Td className="text-xs text-slate-500 font-medium">{new Date(s.updated_at).toLocaleString()}</Td>
                <Td className="text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => saveRow({ key: s.key, value: s.value, description: s.description })}
                    title="Запази (без промяна) – полезно за проверка на права"
                    className="!py-1.5 !px-3 !text-xs font-bold"
                  >
                    Тест запис
                  </Button>
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <Td colSpan={5} className="text-center py-8 text-slate-500">
                  Няма намерени настройки.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
}
