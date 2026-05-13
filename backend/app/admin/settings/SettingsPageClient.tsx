"use client";

import { useEffect, useState } from "react";
import { SectionTitle, Card, Input, Textarea, Button, Table, Th, Td } from "../ui";
import { RefreshCw, Save, Database, Download, FolderOpen } from "lucide-react";

type SettingRow = { key: string; value: string | null; description: string | null; updated_at: string };

const BACKUP_PATH_KEY = "backup.preferred_folder_path";
const BACKUP_REMINDER_KEY = "backup.reminder_interval_days";
const LS_LAST_BACKUP = "smolyanklima_last_full_backup_at";

export default function SettingsPageClient() {
  const [items, setItems] = useState<SettingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupFolder, setBackupFolder] = useState("");
  const [backupReminderDays, setBackupReminderDays] = useState("7");
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupDownloading, setBackupDownloading] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  const [newRow, setNewRow] = useState({ key: "", value: "", description: "" });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    try {
      setLastBackupAt(localStorage.getItem(LS_LAST_BACKUP));
    } catch {
      setLastBackupAt(null);
    }
  }, []);

  useEffect(() => {
    const f = items.find((i) => i.key === BACKUP_PATH_KEY);
    const d = items.find((i) => i.key === BACKUP_REMINDER_KEY);
    if (f !== undefined) setBackupFolder(f.value ?? "");
    if (d !== undefined) setBackupReminderDays(d.value?.trim() ? d.value.trim() : "7");
  }, [items]);

  async function saveRow(row: { key: string; value: string | null; description: string | null }) {
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(row),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Грешка");
      return;
    }
    await load();
  }

  async function saveBackupSettings() {
    setBackupSaving(true);
    setError(null);
    const descPath = items.find((i) => i.key === BACKUP_PATH_KEY)?.description ?? null;
    const descDays = items.find((i) => i.key === BACKUP_REMINDER_KEY)?.description ?? null;
    const rows: SettingRow[] = [
      {
        key: BACKUP_PATH_KEY,
        value: backupFolder.trim() || null,
        description: descPath,
        updated_at: "",
      },
      {
        key: BACKUP_REMINDER_KEY,
        value: backupReminderDays.trim() || "7",
        description: descDays,
        updated_at: "",
      },
    ];
    try {
      for (const row of rows) {
        const res = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ key: row.key, value: row.value, description: row.description }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Грешка");
      }
      await load();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBackupSaving(false);
    }
  }

  async function downloadFullBackup() {
    setBackupDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backup/full", { credentials: "include" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error || "Грешка при генериране на архива");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      let filename = "smolyanklima-backup.json";
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      try {
        const iso = new Date().toISOString();
        localStorage.setItem(LS_LAST_BACKUP, iso);
        setLastBackupAt(iso);
      } catch {
        /* ignore quota */
      }
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBackupDownloading(false);
    }
  }

  const reminderDays = Math.max(1, parseInt(backupReminderDays || "7", 10) || 7);
  const msSinceBackup = lastBackupAt ? Date.now() - new Date(lastBackupAt).getTime() : null;
  const backupReminderDue =
    msSinceBackup === null ? true : msSinceBackup > reminderDays * 86_400_000;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Настройки" hint="Ключ-стойност конфигурация за системни параметри." />
        </h1>
        <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm">
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Обнови</span>
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>
      )}

      <Card className="p-3 md:p-4 border-brand-blue-200 bg-gradient-to-br from-white to-brand-blue-50/40">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-brand-blue-100 text-brand-blue-700 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-slate-900 tracking-tight">Резервно копие на базата данни</div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Пълен експорт на всички <strong>public</strong> таблици като един JSON файл (с манифест и брой редове). Запишете го на сигурно място.
              Уеб приложението <strong>не може</strong> да записва директно в папка на диска — изберете папка при запазване на файла или преместете сваления файл към препоръчания път по-долу.
            </p>
          </div>
        </div>

        {backupReminderDue && (
          <div className="mb-3 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {lastBackupAt
              ? `От повече от ${reminderDays} дни няма изтегляне на пълен архив от този браузър.`
              : "Още не сте изтегляли пълен архив от този браузър — направете го поне веднъж и съхранете файла на локален диск."}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 opacity-70" />
              Препоръчана локална папка (път)
            </span>
            <Input
              value={backupFolder}
              onChange={(e) => setBackupFolder(e.target.value)}
              placeholder="напр. D:/Backup/SmolyanKlima"
            />
            <span className="text-[10px] text-slate-500">Напомняне за екипа къде да държите копията; не се синхронизира автоматично с диска.</span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Напомняне след (дни)</span>
            <Input
              value={backupReminderDays}
              onChange={(e) => setBackupReminderDays(e.target.value.replace(/\D/g, ""))}
              placeholder="7"
              inputMode="numeric"
            />
            <span className="text-[10px] text-slate-500">
              Последно изтегляне (този браузър):{" "}
              {lastBackupAt ? new Date(lastBackupAt).toLocaleString("bg-BG") : "—"}
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void saveBackupSettings()} disabled={backupSaving} className="gap-2">
            {backupSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Запази настройките за архив
          </Button>
          <Button variant="secondary" onClick={() => void downloadFullBackup()} disabled={backupDownloading} className="gap-2">
            {backupDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Свали пълен архив (JSON)
          </Button>
        </div>
        <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
          За автоматични седмични копия на ниво PostgreSQL вижте също Supabase Dashboard → Database → Backups. Големи бази може да отнемат време; при таймаут ползвайте официалния backup на хостинга.
        </p>
      </Card>

      <Card className="p-3 bg-slate-50 border-slate-200">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Добави / обнови настройка</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Ключ</span>
            <Input value={newRow.key} onChange={(e) => setNewRow({ ...newRow, key: e.target.value })} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Стойност</span>
            <Input value={newRow.value} onChange={(e) => setNewRow({ ...newRow, value: e.target.value })} />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs font-bold text-slate-600">Описание</span>
            <Textarea value={newRow.description} onChange={(e) => setNewRow({ ...newRow, description: e.target.value })} rows={2} />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
            onClick={() =>
              void saveRow({ key: newRow.key.trim(), value: newRow.value || null, description: newRow.description || null })
            }
            disabled={!newRow.key.trim()}
            className="gap-2"
          >
            <Save className="w-4 h-4" /> Запази
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-slate-500 font-medium">Зареждане...</div>
      ) : (
        <>
          <div className="hidden md:block">
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
                        onClick={() => void saveRow({ key: s.key, value: s.value, description: s.description })}
                        className="!py-1.5 !px-3 !text-xs font-bold"
                      >
                        Тест
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
          </div>
          <div className="md:hidden space-y-2">
            {items.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени настройки.</div>
            )}
            {items.map((s) => (
              <div key={s.key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="font-mono text-xs font-bold text-slate-900 mb-1">{s.key}</div>
                <div className="font-mono text-xs text-slate-600 mb-1 truncate">{s.value ?? "—"}</div>
                {s.description && <div className="text-xs text-slate-500 mb-2">{s.description}</div>}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400">{new Date(s.updated_at).toLocaleDateString("bg-BG")}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void saveRow({ key: s.key, value: s.value, description: s.description })}
                    className="!py-1 !px-2.5 !text-xs"
                  >
                    Тест
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
