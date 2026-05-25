/** Инструкции, записани във всеки JSON архив — за възстановяване при смяна на Supabase проект. */
export const BACKUP_RESTORE_GUIDE = {
  schemaSource: "GitHub repo → backend/supabase/migrations (пуснете всички миграции преди import)",
  dataSource: "Този JSON файл (manifest + data)",
  authNote:
    "Supabase Auth (login пароли) не е в архива. След restore създайте admin потребители в Auth и синхронизирайте admin_users.",
  steps: [
    "Създайте нов Supabase проект (или използвайте празна база със същите migrations).",
    "Пуснете всички SQL migrations от backend/supabase/migrations (включително 0067).",
    "Deploy-нете backend с env към новия Supabase.",
    "Настройки → Резервно копие → изберете JSON файла → режим „Пълно възстановяване“ → RESTORE.",
    "Създайте отново admin login в Supabase Auth (Dashboard → Authentication → Users).",
  ],
} as const;

export type BackupFilePreview = {
  exportedAt: string;
  tables: number;
  totalRows: number;
  errors: string[];
};

export function previewBackupPayload(raw: unknown): BackupFilePreview {
  if (!raw || typeof raw !== "object") {
    throw new Error("Невалиден JSON.");
  }
  const body = raw as { manifest?: BackupManifestLike; data?: Record<string, unknown[]> };
  const m = body.manifest;
  if (!m?.exportedAt || !m.tables || !body.data) {
    throw new Error("Липсва manifest или data.");
  }
  const rowCounts = m.rowCounts ?? {};
  const totalRows = m.tables.reduce((sum, t) => sum + (rowCounts[t] ?? body.data?.[t]?.length ?? 0), 0);
  const errors = m.tableErrors ? Object.entries(m.tableErrors).map(([t, msg]) => `${t}: ${msg}`) : [];
  return {
    exportedAt: m.exportedAt,
    tables: m.tables.length,
    totalRows,
    errors,
  };
}

type BackupManifestLike = {
  exportedAt: string;
  tables: string[];
  rowCounts?: Record<string, number>;
  tableErrors?: Record<string, string>;
};
