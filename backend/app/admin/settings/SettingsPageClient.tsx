"use client";

import { useEffect, useRef, useState } from "react";
import { SectionTitle, Card, Input, Button } from "../ui";
import { RefreshCw, Save, Database, Download, FolderOpen, CloudDownload, Layers, Upload } from "lucide-react";
import type { BulclimaSyncProgressEvent } from "@/lib/import/bulclima/bulclimaSyncProgress";
import type { ClimacomSyncProgressEvent } from "@/lib/import/climacom/climacomSyncProgress";
import type { CondexSyncProgressEvent } from "@/lib/import/condex/condexSyncProgress";
import type { BittelSyncProgressEvent } from "@/lib/import/bittel/bittelSyncProgress";
import {
  isLocalFolderPickerSupported,
  pickLocalFolder,
  writeBlobToDirectory,
} from "@/lib/client/pickLocalFolder";
import { previewBackupPayload, type BackupFilePreview } from "@/lib/backup/backupManifest";

const MAX_SYNC_LOG_LINES = 300;

const ALL_CATALOG_SYNC_STEPS = [
  { id: "bulclima", label: "Булклима" },
  { id: "climacom", label: "Климаком" },
  { id: "condex", label: "Кондекс" },
  { id: "bittel", label: "Биттел" },
] as const;

/** Очакван брой Condex продукти (за crawl прогрес преди финален брой). */
const CONDEX_ESTIMATED_PRODUCTS = 95;
const CONDEX_CRAWL_PERCENT = 28;

type CondexProgressView = {
  phase: "crawl" | "import" | "done";
  discovered: number;
  current: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  startedAt: number;
};

function formatSyncEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "изчислява се…";
  if (seconds < 45) return `~${Math.max(1, Math.ceil(seconds))} сек`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return s > 0 ? `~${m} мин ${s} сек` : `~${m} мин`;
}

function condexOverallPercent(p: CondexProgressView, now = Date.now()): number {
  if (p.phase === "done") return 100;
  if (p.phase === "import" && p.total > 0) {
    const tail = 100 - CONDEX_CRAWL_PERCENT;
    return CONDEX_CRAWL_PERCENT + Math.round((p.current / p.total) * tail);
  }
  if (p.phase === "crawl") {
    const fromCount =
      p.discovered > 0
        ? Math.round((p.discovered / CONDEX_ESTIMATED_PRODUCTS) * CONDEX_CRAWL_PERCENT)
        : 0;
    const elapsedSec = (now - p.startedAt) / 1000;
    const fromTime = Math.round((elapsedSec / 240) * CONDEX_CRAWL_PERCENT);
    return Math.min(CONDEX_CRAWL_PERCENT, Math.max(4, fromCount, fromTime));
  }
  return 4;
}

function condexEtaSeconds(p: CondexProgressView, now = Date.now()): number | null {
  const pct = condexOverallPercent(p, now);
  const elapsed = (now - p.startedAt) / 1000;
  if (pct < 4 || elapsed < 3) return null;
  return ((100 - pct) / pct) * elapsed;
}

function CondexSyncProgressBar({
  progress,
  syncing,
  nowMs,
}: {
  progress: CondexProgressView;
  syncing: boolean;
  nowMs: number;
}) {
  const pct = condexOverallPercent(progress, nowMs);
  const eta = syncing && progress.phase !== "done" ? condexEtaSeconds(progress, nowMs) : null;
  const phaseLabel =
    progress.phase === "done" ? "Готово" : progress.phase === "crawl" ? "Обхождане на condex.bg" : "Импорт в каталога";
  const detail =
    progress.phase === "crawl"
      ? `Намерени ${progress.discovered} продукта`
      : progress.phase === "done"
        ? `${progress.total || progress.discovered} продукта · нови ${progress.created} · обновени ${progress.updated}`
        : `${progress.current} / ${progress.total} продукта`;

  return (
    <div className="rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-sky-800">{phaseLabel}</div>
          <div className="text-sm font-semibold text-slate-800 mt-0.5">{detail}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-black text-sky-700 tabular-nums">{pct}%</div>
          {syncing && progress.phase !== "done" && (
            <div className="text-[10px] font-medium text-slate-500 mt-0.5">
              остава {eta != null ? formatSyncEta(eta) : "…"}
            </div>
          )}
        </div>
      </div>
      <div className="h-3 rounded-full bg-sky-100 overflow-hidden ring-1 ring-sky-200/80">
        {syncing && progress.phase === "crawl" && pct < CONDEX_CRAWL_PERCENT ? (
          <div
            className="h-full bg-sky-500 transition-all duration-500 ease-out"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        ) : (
          <div
            className="h-full bg-sky-600 transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600">
        <span>
          <strong className="text-slate-800">{progress.discovered}</strong> открити
        </span>
        {progress.phase !== "crawl" && (
          <>
            <span>
              <strong className="text-emerald-700">{progress.created}</strong> нови
            </span>
            <span>
              <strong className="text-sky-800">{progress.updated}</strong> обновени
            </span>
            {progress.skipped > 0 && (
              <span>
                <strong className="text-amber-700">{progress.skipped}</strong> пропуснати
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function parseSseBlock<T extends { message: string }>(
  block: string,
  onProgress: (ev: T) => void,
): Record<string, unknown> | null {
  if (!block.trim() || block.startsWith(":")) return null;
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  const parsed = JSON.parse(data) as { error?: string; data?: Record<string, unknown> };
  if (event === "progress") onProgress(parsed as T);
  else if (event === "done") return parsed.data ?? {};
  else if (event === "error") throw new Error(parsed.error || "Грешка при синхронизация");
  return null;
}

async function consumeCatalogSyncStream<T extends { message: string }>(
  res: Response,
  onProgress: (ev: T) => void,
): Promise<Record<string, unknown>> {
  if (!res.body) throw new Error("Празен отговор от сървъра");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: Record<string, unknown> | null = null;

  const flushBlocks = (blocks: string[]) => {
    for (const block of blocks) {
      const result = parseSseBlock<T>(block, onProgress);
      if (result !== null) summary = result;
    }
  };

  const drainBuffer = () => {
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    flushBlocks(chunks);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      drainBuffer();
    }
    if (done) break;
  }
  buffer += decoder.decode();
  drainBuffer();
  if (buffer.trim()) {
    const tail = parseSseBlock<T>(buffer.trim(), onProgress);
    if (tail !== null && typeof tail === "object") summary = tail;
  }
  if (!summary) throw new Error("Синхронизацията приключи без обобщение");
  return summary;
}

/** Ред „открити / нови / обновени“ след последен sync (Bulclima + Climacom). */
function formatCatalogSyncStats(summary: Record<string, unknown> | null, foundKey: "productUrls" | "productCount") {
  if (!summary || typeof summary.created !== "number") return null;
  const found =
    typeof summary[foundKey] === "number"
      ? summary[foundKey]
      : foundKey === "productUrls" && typeof summary.productCount === "number"
        ? summary.productCount
        : "—";
  const parts = [
    `открити: ${found}`,
    `климатици: ${summary.created} нови / ${summary.updated ?? 0} обновени`,
  ];
  if (typeof summary.accessoriesCreated === "number") {
    parts.push(
      `аксесоари: ${summary.accessoriesCreated} нови / ${typeof summary.accessoriesUpdated === "number" ? summary.accessoriesUpdated : 0} обновени`,
    );
  }
  if (typeof summary.skipped === "number" && summary.skipped > 0) {
    parts.push(`пропуснати: ${summary.skipped}`);
  }
  if (Array.isArray(summary.errors) && summary.errors.length > 0) {
    parts.push(`грешки: ${summary.errors.length}`);
  }
  return ` · ${parts.join("; ")}`;
}

type SettingRow = { key: string; value: string | null; description: string | null; updated_at: string };

type SettingsTab = "general" | "catalog" | "backup";

const BACKUP_PATH_KEY = "backup.preferred_folder_path";
const BACKUP_REMINDER_KEY = "backup.reminder_interval_days";
const LS_LAST_BACKUP = "smolyanklima_last_full_backup_at";

const TABS: { id: SettingsTab; label: string; hint: string }[] = [
  { id: "general", label: "Общи", hint: "Общи настройки — засега празно" },
  { id: "catalog", label: "Каталог", hint: "Импорт на каталози от доставчици" },
  { id: "backup", label: "Резервно копие", hint: "Пълен JSON архив на базата данни" },
];

function SettingsTabs({
  active,
  onChange,
}: {
  active: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1 p-1 bg-slate-100/80 border border-slate-200 rounded-xl"
      role="tablist"
      aria-label="Секции настройки"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={tab.hint}
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-[7rem] px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              isActive
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPageClient() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("catalog");
  const [items, setItems] = useState<SettingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupFolder, setBackupFolder] = useState("");
  const backupDirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [folderPicking, setFolderPicking] = useState(false);
  const [folderManualEdit, setFolderManualEdit] = useState(false);
  const [backupReminderDays, setBackupReminderDays] = useState("7");
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupDownloading, setBackupDownloading] = useState<"json" | "xlsx" | null>(null);
  const [backupRestoreMode, setBackupRestoreMode] = useState<"merge" | "replace">("replace");
  const [backupRestoreConfirm, setBackupRestoreConfirm] = useState("");
  const [backupRestoring, setBackupRestoring] = useState(false);
  const [backupRestoreInfo, setBackupRestoreInfo] = useState<string | null>(null);
  const [backupFilePreview, setBackupFilePreview] = useState<BackupFilePreview | null>(null);
  const [backupLastDownloadSummary, setBackupLastDownloadSummary] = useState<BackupFilePreview | null>(null);
  const [backupSystemOk, setBackupSystemOk] = useState<boolean | null>(null);
  const [backupSystemMessage, setBackupSystemMessage] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [bulclimaSyncing, setBulclimaSyncing] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [bulclimaProgress, setBulclimaProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulclimaLog, setBulclimaLog] = useState<string[]>([]);
  const bulclimaLogEndRef = useRef<HTMLDivElement>(null);
  const [bulclimaStatus, setBulclimaStatus] = useState<{
    at: string | null;
    status: string | null;
    summary: Record<string, unknown> | null;
  } | null>(null);
  const [climacomSyncing, setClimacomSyncing] = useState(false);
  const [climacomProgress, setClimacomProgress] = useState<{ current: number; total: number } | null>(null);
  const [climacomLog, setClimacomLog] = useState<string[]>([]);
  const climacomLogEndRef = useRef<HTMLDivElement>(null);
  const [climacomStatus, setClimacomStatus] = useState<{
    at: string | null;
    status: string | null;
    summary: Record<string, unknown> | null;
  } | null>(null);
  const [condexSyncing, setCondexSyncing] = useState(false);
  const [condexProgress, setCondexProgress] = useState<CondexProgressView | null>(null);
  const [condexNowMs, setCondexNowMs] = useState(() => Date.now());
  const [condexLog, setCondexLog] = useState<string[]>([]);
  const condexLogEndRef = useRef<HTMLDivElement>(null);
  const [condexStatus, setCondexStatus] = useState<{
    at: string | null;
    status: string | null;
    summary: Record<string, unknown> | null;
  } | null>(null);
  const [bittelSyncing, setBittelSyncing] = useState(false);
  const [bittelProgress, setBittelProgress] = useState<CondexProgressView | null>(null);
  const [bittelNowMs, setBittelNowMs] = useState(() => Date.now());
  const [bittelLog, setBittelLog] = useState<string[]>([]);
  const bittelLogEndRef = useRef<HTMLDivElement>(null);
  const [bittelStatus, setBittelStatus] = useState<{
    at: string | null;
    status: string | null;
    summary: Record<string, unknown> | null;
  } | null>(null);
  const [allCatalogSyncing, setAllCatalogSyncing] = useState(false);
  const [allCatalogSyncStep, setAllCatalogSyncStep] = useState(0);
  const [allCatalogSyncLog, setAllCatalogSyncLog] = useState<string[]>([]);
  const allCatalogSyncLogEndRef = useRef<HTMLDivElement>(null);
  const syncAllLockRef = useRef(false);

  const anyCatalogSyncing =
    bulclimaSyncing || climacomSyncing || condexSyncing || bittelSyncing || allCatalogSyncing;

  function appendAllCatalogSyncLog(line: string) {
    setAllCatalogSyncLog((prev) => {
      const next = [...prev, line];
      return next.length > MAX_SYNC_LOG_LINES ? next.slice(-MAX_SYNC_LOG_LINES) : next;
    });
  }

  function appendBulclimaLog(line: string) {
    setBulclimaLog((prev) => {
      const next = [...prev, line];
      return next.length > MAX_SYNC_LOG_LINES ? next.slice(-MAX_SYNC_LOG_LINES) : next;
    });
  }

  function handleBulclimaProgress(ev: BulclimaSyncProgressEvent) {
    const ts = new Date().toLocaleTimeString("bg-BG");
    appendBulclimaLog(`[${ts}] ${ev.message}`);
    if (ev.total != null && ev.total > 0) {
      setBulclimaProgress({
        current: ev.current ?? 0,
        total: ev.total,
      });
    } else if (ev.phase === "crawl") {
      setBulclimaProgress(null);
    }
  }

  function appendClimacomLog(line: string) {
    setClimacomLog((prev) => {
      const next = [...prev, line];
      return next.length > MAX_SYNC_LOG_LINES ? next.slice(-MAX_SYNC_LOG_LINES) : next;
    });
  }

  function handleClimacomProgress(ev: ClimacomSyncProgressEvent) {
    const ts = new Date().toLocaleTimeString("bg-BG");
    appendClimacomLog(`[${ts}] ${ev.message}`);
    if (ev.total != null && ev.total > 0) {
      setClimacomProgress({ current: ev.current ?? 0, total: ev.total });
    } else if (ev.phase === "crawl") {
      setClimacomProgress(null);
    }
  }

  function appendCondexLog(line: string) {
    setCondexLog((prev) => {
      const next = [...prev, line];
      return next.length > MAX_SYNC_LOG_LINES ? next.slice(-MAX_SYNC_LOG_LINES) : next;
    });
  }

  function handleCondexProgress(ev: CondexSyncProgressEvent) {
    const ts = new Date().toLocaleTimeString("bg-BG");
    appendCondexLog(`[${ts}] ${ev.message}`);
    setCondexProgress((prev) => {
      const startedAt = prev?.startedAt ?? Date.now();
      const base = {
        discovered: ev.discovered ?? prev?.discovered ?? 0,
        current: ev.current ?? prev?.current ?? 0,
        total: ev.total ?? prev?.total ?? 0,
        created: ev.created ?? prev?.created ?? 0,
        updated: ev.updated ?? prev?.updated ?? 0,
        skipped: ev.skipped ?? prev?.skipped ?? 0,
        startedAt,
      };
      if (ev.phase === "done") {
        return {
          ...base,
          phase: "done",
          discovered: ev.discovered ?? base.total ?? base.discovered,
          current: ev.total ?? base.current,
          total: ev.total ?? base.total,
        };
      }
      if (ev.phase === "import" || (ev.total != null && ev.total > 0)) {
        return {
          ...base,
          phase: "import",
          discovered: ev.discovered ?? ev.total ?? base.discovered,
          current: ev.current ?? base.current,
          total: ev.total ?? base.total,
        };
      }
      return {
        ...base,
        phase: "crawl",
        discovered: ev.discovered ?? ev.current ?? base.discovered,
        current: ev.discovered ?? ev.current ?? base.current,
        total: 0,
      };
    });
  }

  function appendBittelLog(line: string) {
    setBittelLog((prev) => {
      const next = [...prev, line];
      return next.length > MAX_SYNC_LOG_LINES ? next.slice(-MAX_SYNC_LOG_LINES) : next;
    });
  }

  function handleBittelProgress(ev: BittelSyncProgressEvent) {
    const ts = new Date().toLocaleTimeString("bg-BG");
    appendBittelLog(`[${ts}] ${ev.message}`);
    setBittelProgress((prev) => {
      const startedAt = prev?.startedAt ?? Date.now();
      const base = {
        discovered: ev.discovered ?? prev?.discovered ?? 0,
        current: ev.current ?? prev?.current ?? 0,
        total: ev.total ?? prev?.total ?? 0,
        created: ev.created ?? prev?.created ?? 0,
        updated: ev.updated ?? prev?.updated ?? 0,
        skipped: ev.skipped ?? prev?.skipped ?? 0,
        startedAt,
      };
      if (ev.phase === "done") {
        return { ...base, phase: "done" as const, current: ev.total ?? base.current, total: ev.total ?? base.total };
      }
      if (ev.phase === "import" || (ev.total != null && ev.total > 0)) {
        return { ...base, phase: "import" as const, current: ev.current ?? base.current, total: ev.total ?? base.total };
      }
      return { ...base, phase: "crawl" as const, discovered: ev.discovered ?? base.discovered, total: 0 };
    });
  }

  async function loadBittelStatus() {
    try {
      const res = await fetch("/api/admin/catalog/sync-bittel", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          bittel_last_sync_at?: string | null;
          bittel_last_sync_status?: string | null;
          bittel_last_sync_summary?: Record<string, unknown> | null;
        } | null;
      };
      if (!res.ok) return;
      const d = json.data;
      setBittelStatus({
        at: d?.bittel_last_sync_at ?? null,
        status: d?.bittel_last_sync_status ?? null,
        summary: (d?.bittel_last_sync_summary as Record<string, unknown> | null) ?? null,
      });
    } catch {
      /* optional */
    }
  }

  async function loadCondexStatus() {
    try {
      const res = await fetch("/api/admin/catalog/sync-condex", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          condex_last_sync_at?: string | null;
          condex_last_sync_status?: string | null;
          condex_last_sync_summary?: Record<string, unknown> | null;
        } | null;
      };
      if (!res.ok) return;
      const d = json.data;
      setCondexStatus({
        at: d?.condex_last_sync_at ?? null,
        status: d?.condex_last_sync_status ?? null,
        summary: (d?.condex_last_sync_summary as Record<string, unknown> | null) ?? null,
      });
    } catch {
      /* optional */
    }
  }

  async function loadClimacomStatus() {
    try {
      const res = await fetch("/api/admin/catalog/sync-climacom", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          climacom_last_sync_at?: string | null;
          climacom_last_sync_status?: string | null;
          climacom_last_sync_summary?: Record<string, unknown> | null;
        } | null;
      };
      if (!res.ok) return;
      const d = json.data;
      setClimacomStatus({
        at: d?.climacom_last_sync_at ?? null,
        status: d?.climacom_last_sync_status ?? null,
        summary: (d?.climacom_last_sync_summary as Record<string, unknown> | null) ?? null,
      });
    } catch {
      /* optional */
    }
  }

  async function loadBulclimaStatus() {
    try {
      const res = await fetch("/api/admin/catalog/sync-bulclima", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          bulclima_last_sync_at?: string | null;
          bulclima_last_sync_status?: string | null;
          bulclima_last_sync_summary?: Record<string, unknown> | null;
        } | null;
      };
      if (!res.ok) return;
      const d = json.data;
      setBulclimaStatus({
        at: d?.bulclima_last_sync_at ?? null,
        status: d?.bulclima_last_sync_status ?? null,
        summary: (d?.bulclima_last_sync_summary as Record<string, unknown> | null) ?? null,
      });
    } catch {
      /* optional */
    }
  }

  async function loadBackupSettings() {
    setBackupLoading(true);
    setError(null);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        fetch("/api/admin/settings", { credentials: "include" }),
        fetch("/api/admin/backup/status", { credentials: "include" }),
      ]);
      const json = await settingsRes.json();
      if (!settingsRes.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);

      const statusJson = (await statusRes.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (statusRes.ok) {
        setBackupSystemOk(Boolean(statusJson.ok));
        setBackupSystemMessage(statusJson.message ?? null);
      } else {
        setBackupSystemOk(false);
        setBackupSystemMessage("Неуспешна проверка на backup системата.");
      }
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBackupLoading(false);
    }
  }

  async function refreshActiveTab() {
    setError(null);
    if (activeTab === "backup") await loadBackupSettings();
    else if (activeTab === "catalog") await Promise.all([loadBulclimaStatus(), loadClimacomStatus(), loadCondexStatus(), loadBittelStatus()]);
  }

  async function reclassifyMisplacedAccessories(dryRun: boolean) {
    if (!dryRun) {
      const ok = window.confirm(
        "Ще премести помпи, маркучи, Wi‑Fi модули и др. от „Климатици“ в „Аксесоари“ и ще изтрие старите записи в продукти. Продължаване?",
      );
      if (!ok) return;
    }
    setReclassifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog/reclassify-accessories?dryRun=${dryRun ? "1" : "0"}`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          scanned?: number;
          moved?: number;
          deleted?: number;
          accessoriesCreated?: number;
          accessoriesUpdated?: number;
          errors?: string[];
          items?: Array<{ name: string; slug: string }>;
        };
      };
      if (!res.ok) throw new Error(json.error || "Грешка при преместване");
      const d = json.data;
      const msg = dryRun
        ? `Преглед: ${d?.moved ?? 0} артикула ще бъдат преместени (от ${d?.scanned ?? 0} прегледани).`
        : `Готово: преместени ${d?.moved ?? 0}, нови аксесоари ${d?.accessoriesCreated ?? 0}, обновени ${d?.accessoriesUpdated ?? 0}, изтрити продукти ${d?.deleted ?? 0}.`;
      if ((d?.errors?.length ?? 0) > 0) {
        setError(`${msg} Грешки: ${d!.errors!.length}`);
      } else {
        window.alert(msg);
      }
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setReclassifying(false);
    }
  }

  async function syncClimacomCatalog(): Promise<boolean> {
    setClimacomSyncing(true);
    setError(null);
    setClimacomLog([]);
    setClimacomProgress(null);
    try {
      const res = await fetch("/api/admin/catalog/sync-climacom?stream=1", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || "Грешка при синхронизация");
      }
      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("text/event-stream")) {
        await consumeCatalogSyncStream(res, handleClimacomProgress);
      } else {
        const json = (await res.json()) as { error?: string };
        if (json.error) throw new Error(json.error);
        appendClimacomLog("Синхронизацията приключи.");
      }
      await loadClimacomStatus();
      return true;
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setClimacomSyncing(false);
      setClimacomProgress(null);
    }
  }

  async function syncCondexCatalog(): Promise<boolean> {
    setCondexSyncing(true);
    setError(null);
    setCondexLog([]);
    const startedAt = Date.now();
    setCondexNowMs(startedAt);
    setCondexProgress({
      phase: "crawl",
      discovered: 0,
      current: 0,
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      startedAt,
    });
    try {
      const res = await fetch("/api/admin/catalog/sync-condex?stream=1", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || "Грешка при синхронизация");
      }
      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("text/event-stream")) {
        await consumeCatalogSyncStream(res, handleCondexProgress);
      } else {
        const json = (await res.json()) as { error?: string };
        if (json.error) throw new Error(json.error);
        appendCondexLog("Синхронизацията приключи.");
      }
      await loadCondexStatus();
      return true;
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setCondexSyncing(false);
      setCondexProgress((prev) => (prev ? { ...prev, phase: "done" } : null));
    }
  }

  async function syncBittelCatalog(): Promise<boolean> {
    setBittelSyncing(true);
    setError(null);
    setBittelLog([]);
    const startedAt = Date.now();
    setBittelNowMs(startedAt);
    setBittelProgress({
      phase: "crawl",
      discovered: 0,
      current: 0,
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      startedAt,
    });
    try {
      const res = await fetch("/api/admin/catalog/sync-bittel?stream=1", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || "Грешка при синхронизация");
      }
      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("text/event-stream")) {
        await consumeCatalogSyncStream(res, handleBittelProgress);
      } else {
        const json = (await res.json()) as { error?: string };
        if (json.error) throw new Error(json.error);
        appendBittelLog("Синхронизацията приключи.");
      }
      await loadBittelStatus();
      return true;
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setBittelSyncing(false);
      setBittelProgress((prev) => (prev ? { ...prev, phase: "done" } : null));
    }
  }

  async function syncBulclimaCatalog(): Promise<boolean> {
    setBulclimaSyncing(true);
    setError(null);
    setBulclimaLog([]);
    setBulclimaProgress(null);
    try {
      const res = await fetch("/api/admin/catalog/sync-bulclima?stream=1", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || "Грешка при синхронизация");
      }
      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("text/event-stream")) {
        await consumeCatalogSyncStream(res, handleBulclimaProgress);
      } else {
        const json = (await res.json()) as { error?: string };
        if (json.error) throw new Error(json.error);
        appendBulclimaLog("Синхронизацията приключи.");
      }
      await loadBulclimaStatus();
      return true;
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setBulclimaSyncing(false);
      setBulclimaProgress(null);
    }
  }

  async function runCatalogSyncStep(stepId: (typeof ALL_CATALOG_SYNC_STEPS)[number]["id"]): Promise<boolean> {
    switch (stepId) {
      case "bulclima":
        return syncBulclimaCatalog();
      case "climacom":
        return syncClimacomCatalog();
      case "condex":
        return syncCondexCatalog();
      case "bittel":
        return syncBittelCatalog();
      default:
        return false;
    }
  }

  async function syncAllCatalogs() {
    if (syncAllLockRef.current || reclassifying) return;
    syncAllLockRef.current = true;
    setAllCatalogSyncing(true);
    setAllCatalogSyncStep(0);
    setAllCatalogSyncLog([]);
    setError(null);

    const ts = () => new Date().toLocaleTimeString("bg-BG");
    let failedAt: string | null = null;

    try {
      appendAllCatalogSyncLog(
        `[${ts()}] Започва обща синхронизация — ${ALL_CATALOG_SYNC_STEPS.length} доставчика, един след друг.`,
      );

      for (let i = 0; i < ALL_CATALOG_SYNC_STEPS.length; i++) {
        const step = ALL_CATALOG_SYNC_STEPS[i];
        setAllCatalogSyncStep(i + 1);
        appendAllCatalogSyncLog(`[${ts()}] (${i + 1}/${ALL_CATALOG_SYNC_STEPS.length}) Старт: ${step.label}`);

        const ok = await runCatalogSyncStep(step.id);

        if (!ok) {
          failedAt = step.label;
          appendAllCatalogSyncLog(`[${ts()}] Грешка при ${step.label} — спиране.`);
          break;
        }

        appendAllCatalogSyncLog(`[${ts()}] ${step.label} — завърши.`);

        if (i < ALL_CATALOG_SYNC_STEPS.length - 1) {
          appendAllCatalogSyncLog(`[${ts()}] Изчакване преди следващия доставчик…`);
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      if (!failedAt) {
        appendAllCatalogSyncLog(`[${ts()}] Всички каталози са синхронизирани успешно.`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      appendAllCatalogSyncLog(`[${ts()}] Неочаквана грешка: ${msg}`);
    } finally {
      setAllCatalogSyncStep(0);
      setAllCatalogSyncing(false);
      syncAllLockRef.current = false;
    }
  }

  useEffect(() => {
    allCatalogSyncLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allCatalogSyncLog]);

  useEffect(() => {
    bulclimaLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bulclimaLog]);

  useEffect(() => {
    climacomLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [climacomLog]);

  useEffect(() => {
    condexLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [condexLog]);

  useEffect(() => {
    bittelLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bittelLog]);

  useEffect(() => {
    if (!condexSyncing) return;
    const id = window.setInterval(() => setCondexNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [condexSyncing]);

  useEffect(() => {
    if (!bittelSyncing) return;
    const id = window.setInterval(() => setBittelNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [bittelSyncing]);

  useEffect(() => {
    void loadBulclimaStatus();
    void loadClimacomStatus();
    void loadCondexStatus();
    void loadBittelStatus();
  }, []);

  useEffect(() => {
    if (activeTab === "backup") void loadBackupSettings();
  }, [activeTab]);

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

  async function saveBackupSettings() {
    setBackupSaving(true);
    setError(null);
    const descPath = items.find((i) => i.key === BACKUP_PATH_KEY)?.description ?? null;
    const descDays = items.find((i) => i.key === BACKUP_REMINDER_KEY)?.description ?? null;
    const rows = [
      { key: BACKUP_PATH_KEY, value: backupFolder.trim() || null, description: descPath },
      { key: BACKUP_REMINDER_KEY, value: backupReminderDays.trim() || "7", description: descDays },
    ];
    try {
      for (const row of rows) {
        const res = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(row),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Грешка");
      }
      await loadBackupSettings();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBackupSaving(false);
    }
  }

  async function chooseBackupFolder() {
    if (folderPicking) return;
    setFolderPicking(true);
    setError(null);
    try {
      const picked = await pickLocalFolder();
      if (!picked) return;
      backupDirHandleRef.current = picked.directoryHandle ?? null;
      setBackupFolder(picked.displayPath);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(
        e instanceof Error
          ? e.message
          : "Браузърът не поддържа избор на папка. Въведете пътя ръчно (напр. D:/Backup/SmolyanKlima).",
      );
    } finally {
      setFolderPicking(false);
    }
  }

  async function downloadFullBackup(format: "json" | "xlsx") {
    setBackupDownloading(format);
    setError(null);
    try {
      const url =
        format === "xlsx" ? "/api/admin/backup/full?format=xlsx" : "/api/admin/backup/full";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok && res.status !== 207) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error || "Грешка при генериране на архива");
      }
      let blob = await res.blob();
      if (format === "json") {
        const text = await blob.text();
        try {
          const summary = previewBackupPayload(JSON.parse(text));
          setBackupLastDownloadSummary(summary);
          if (summary.errors.length > 0) {
            setError(
              `Архивът е записан, но ${summary.errors.length} таблици не са експортирани напълно. Проверете manifest.tableErrors във файла.`,
            );
          }
        } catch {
          setBackupLastDownloadSummary(null);
        }
        blob = new Blob([text], { type: "application/json" });
      }
      const cd = res.headers.get("Content-Disposition");
      let filename = format === "xlsx" ? "smolyanklima-prodazhbi-stoka.xml" : "smolyanklima-backup.json";
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) filename = m[1];

      const dirHandle = backupDirHandleRef.current;
      if (dirHandle) {
        try {
          await writeBlobToDirectory(dirHandle, filename, blob);
        } catch {
          backupDirHandleRef.current = null;
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
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
      setBackupDownloading(null);
    }
  }

  async function restoreFullBackup(file: File) {
    if (backupRestoreConfirm.trim() !== "RESTORE") {
      setError('Въведете RESTORE в полето за потвърждение.');
      return;
    }
    setBackupRestoring(true);
    setError(null);
    setBackupRestoreInfo(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as unknown;
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup,
          mode: backupRestoreMode,
          confirm: "RESTORE",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        rowsInserted?: number;
        tablesProcessed?: number;
        mode?: string;
      };
      if (!res.ok) throw new Error(json.error || "Грешка при възстановяване");
      setBackupRestoreInfo(
        `Успешно възстановяване (${json.mode === "replace" ? "пълно" : "сливане"}): ${json.rowsInserted ?? 0} реда в ${json.tablesProcessed ?? 0} таблици. Sequences са синхронизирани.`,
      );
      setBackupRestoreConfirm("");
      if (backupFileInputRef.current) backupFileInputRef.current.value = "";
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBackupRestoring(false);
    }
  }

  const reminderDays = Math.max(1, parseInt(backupReminderDays || "7", 10) || 7);
  const msSinceBackup = lastBackupAt ? Date.now() - new Date(lastBackupAt).getTime() : null;
  const backupReminderDue =
    msSinceBackup === null ? true : msSinceBackup > reminderDays * 86_400_000;

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Настройки" hint="Системни инструменти и конфигурация — изберете секция от табовете." />
        </h1>
        {activeTab !== "general" && (
          <Button variant="secondary" onClick={() => void refreshActiveTab()} className="gap-2 shadow-sm">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Обнови</span>
          </Button>
        )}
      </div>

      <SettingsTabs active={activeTab} onChange={setActiveTab} />

      <p className="text-xs text-slate-500 -mt-1">{activeTabMeta.hint}</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>
      )}

      {activeTab === "general" && null}

      {activeTab === "backup" && (
        <Card className="p-3 md:p-4 border-brand-blue-200 bg-gradient-to-br from-white to-brand-blue-50/40">
          {backupLoading ? (
            <div className="text-center py-8 text-slate-500 text-sm font-medium">Зареждане...</div>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-blue-100 text-brand-blue-700 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-900 tracking-tight">Резервно копие на базата данни</div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Периодично сваляйте <strong>Архив JSON</strong> в папка на компютъра (името включва дата и час). Файлът съдържа{" "}
                    <strong>всички данни</strong> от public таблиците + инструкции за restore вътре в{" "}
                    <code className="text-[10px] bg-slate-100 px-1 rounded">manifest.restoreGuide</code>. Структурата на таблиците
                    е в GitHub migrations — при нов Supabase първо migrations, после import. <strong>Excel</strong> е само отчет
                    (продажби/стока), не за restore.
                  </p>
                </div>
              </div>

              {backupSystemOk === false && backupSystemMessage && (
                <div className="mb-3 text-xs font-semibold text-red-900 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {backupSystemMessage}
                </div>
              )}
              {backupSystemOk === true && backupSystemMessage && (
                <div className="mb-3 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {backupSystemMessage}
                </div>
              )}

              <div className="mb-3 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
                <strong className="block mb-1">Работен процес (катастрофа / смяна на Supabase):</strong>
                1) Свали JSON архив → 2) Нов Supabase проект → 3) Пусни migrations от repo → 4) Deploy backend → 5) Import с{" "}
                <strong>„Пълно възстановяване“</strong> → 6) Създай admin login в Supabase Auth.
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
                  <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand-blue-500/30 focus-within:border-brand-blue-400">
                    <input
                      type="text"
                      value={backupFolder}
                      onChange={(e) => setBackupFolder(e.target.value)}
                      onClick={() => {
                        if (isLocalFolderPickerSupported() && !folderManualEdit) void chooseBackupFolder();
                      }}
                      readOnly={isLocalFolderPickerSupported() && !folderManualEdit}
                      placeholder="напр. D:/Backup/SmolyanKlima"
                      className={`flex-1 min-w-0 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent border-0 outline-none ${
                        isLocalFolderPickerSupported() && !folderManualEdit ? "cursor-pointer" : ""
                      }`}
                      title={
                        isLocalFolderPickerSupported() && !folderManualEdit
                          ? "Кликнете за избор на папка"
                          : "Път до папка за архиви"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => void chooseBackupFolder()}
                      disabled={folderPicking}
                      className="shrink-0 px-3 border-l border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-brand-blue-700 disabled:opacity-50"
                      title="Избери папка на компютъра"
                    >
                      {folderPicking ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <FolderOpen className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {isLocalFolderPickerSupported() ? (
                      <>
                        Кликнете в полето или иконата за избор на папка (Chrome/Edge). При изтегляне архивът може да се запише директно там.{" "}
                        <button
                          type="button"
                          className="underline text-brand-blue-700 hover:text-brand-blue-900"
                          onClick={() => setFolderManualEdit((v) => !v)}
                        >
                          {folderManualEdit ? "Избор от диск" : "Въведи път ръчно"}
                        </button>
                      </>
                    ) : (
                      "Напомняне за екипа къде да държите копията — въведете пътя ръчно (този браузър няма диалог за папка)."
                    )}
                  </span>
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
                <Button
                  variant="secondary"
                  onClick={() => void downloadFullBackup("json")}
                  disabled={backupDownloading !== null}
                  className="gap-2"
                >
                  {backupDownloading === "json" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Архив JSON
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void downloadFullBackup("xlsx")}
                  disabled={backupDownloading !== null}
                  className="gap-2"
                >
                  {backupDownloading === "xlsx" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Excel: продажби и стока
                </Button>
              </div>

              {backupLastDownloadSummary && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-3">
                  Последен JSON архив: {new Date(backupLastDownloadSummary.exportedAt).toLocaleString("bg-BG")} ·{" "}
                  {backupLastDownloadSummary.tables} таблици · {backupLastDownloadSummary.totalRows.toLocaleString("bg-BG")} реда
                  {backupLastDownloadSummary.errors.length > 0
                    ? ` · ⚠ ${backupLastDownloadSummary.errors.length} таблици с грешки`
                    : ""}
                </p>
              )}

              <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="text-xs font-black text-slate-800 uppercase tracking-wide mb-2">Възстановяване от JSON архив</div>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                  Използвайте запазен файл{" "}
                  <code className="text-[10px] bg-slate-100 px-1 rounded">smolyanklima-backup-YYYY-MM-DD_HH-MM-SS.json</code>.
                  <strong> Пълно възстановяване</strong> — за нов/празен Supabase (изчиства таблиците от архива и зарежда всички
                  данни). <strong> Сливане</strong> — само актуализира съществуващи редове по id. Login паролите (Supabase Auth)
                  не са в архива — създайте ги отново в Dashboard след restore.
                </p>
                <div className="flex flex-wrap gap-3 mb-3 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="backupRestoreMode"
                      checked={backupRestoreMode === "replace"}
                      onChange={() => setBackupRestoreMode("replace")}
                      className="accent-brand-blue-600"
                    />
                    Пълно възстановяване (нов Supabase / катастрофа)
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="backupRestoreMode"
                      checked={backupRestoreMode === "merge"}
                      onChange={() => setBackupRestoreMode("merge")}
                      className="accent-slate-600"
                    />
                    Сливане (актуализация на текуща база)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-slate-600">JSON архив</span>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          setBackupFilePreview(null);
                          return;
                        }
                        void file.text().then(
                          (text) => {
                            try {
                              setBackupFilePreview(previewBackupPayload(JSON.parse(text)));
                            } catch {
                              setBackupFilePreview(null);
                              setError("Избраният файл не е валиден backup JSON.");
                            }
                          },
                          () => setBackupFilePreview(null),
                        );
                      }}
                      className="text-xs file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-blue-50 file:text-brand-blue-800 file:font-semibold"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Потвърждение (въведете RESTORE)</span>
                    <Input
                      value={backupRestoreConfirm}
                      onChange={(e) => setBackupRestoreConfirm(e.target.value)}
                      placeholder="RESTORE"
                      autoComplete="off"
                    />
                  </label>
                </div>
                {backupFilePreview && (
                  <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 mb-3">
                    Архив от {new Date(backupFilePreview.exportedAt).toLocaleString("bg-BG")} · {backupFilePreview.tables} таблици ·{" "}
                    {backupFilePreview.totalRows.toLocaleString("bg-BG")} реда
                    {backupFilePreview.errors.length > 0 ? (
                      <span className="text-amber-800"> · ⚠ {backupFilePreview.errors.length} таблици с грешки при export</span>
                    ) : null}
                  </p>
                )}
                <Button
                  variant={backupRestoreMode === "replace" ? "primary" : "secondary"}
                  disabled={backupRestoring || backupDownloading !== null}
                  className="gap-2"
                  onClick={() => {
                    const file = backupFileInputRef.current?.files?.[0];
                    if (!file) {
                      setError("Изберете JSON файл за възстановяване.");
                      return;
                    }
                    void restoreFullBackup(file);
                  }}
                >
                  {backupRestoring ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Възстанови в Supabase
                </Button>
                {backupRestoreInfo && (
                  <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-3">
                    {backupRestoreInfo}
                  </p>
                )}
              </div>

              <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                За автоматични седмични копия на ниво PostgreSQL вижте Supabase Dashboard → Database → Backups.
              </p>
            </>
          )}
        </Card>
      )}

      {activeTab === "catalog" && (
        <>
        <Card className="p-3 md:p-5 border-brand-blue-200 bg-gradient-to-br from-white to-brand-blue-50/50 mb-4 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-brand-blue-100 text-brand-blue-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm md:text-base font-black text-slate-900 tracking-tight">
                Синхронизация на всички доставчици
              </div>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Обновява последователно четирите каталога: <strong>Булклима</strong> → <strong>Климаком</strong> →{" "}
                <strong>Кондекс</strong> → <strong>Биттел</strong>. Продуктите влизат със статус <strong>По поръчка</strong> и
                по подразбиране са скрити от публичния сайт — включвате ги ръчно от списъка продукти. Общото време е
                обикновено <strong>30–60 минути</strong> (зависи от сайтовете). При грешка на един доставчик опашката спира;
                останалите можете да пуснете поотделно по-долу.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => void syncAllCatalogs()}
            disabled={anyCatalogSyncing || reclassifying}
            className="gap-2 w-full sm:w-auto shadow-sm"
          >
            {allCatalogSyncing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Layers className="w-5 h-5" />
            )}
            {allCatalogSyncing
              ? allCatalogSyncStep > 0
                ? `Синхронизирам (${allCatalogSyncStep}/${ALL_CATALOG_SYNC_STEPS.length})…`
                : "Подготвям…"
              : "Синхронизирай всички каталози"}
          </Button>
          {allCatalogSyncing && allCatalogSyncStep > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span>
                  Текущ: {ALL_CATALOG_SYNC_STEPS[allCatalogSyncStep - 1]?.label ?? "—"}
                </span>
                <span>
                  {allCatalogSyncStep} / {ALL_CATALOG_SYNC_STEPS.length}
                </span>
              </div>
              <div className="h-2 rounded-full bg-brand-blue-100 overflow-hidden">
                <div
                  className="h-full bg-brand-blue-600 transition-all duration-500"
                  style={{
                    width: `${Math.round((allCatalogSyncStep / ALL_CATALOG_SYNC_STEPS.length) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          {(allCatalogSyncing || allCatalogSyncLog.length > 0) && (
            <div className="mt-4 space-y-2 border-t border-brand-blue-200/60 pt-4">
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Общ дневник</div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900/95 p-2 font-mono text-[10px] leading-relaxed text-slate-100">
                {allCatalogSyncLog.length === 0 ? (
                  <div className="text-slate-400">Очакване…</div>
                ) : (
                  allCatalogSyncLog.map((line, i) => (
                    <div key={`all-${i}`} className="whitespace-pre-wrap break-all py-0.5">
                      {line}
                    </div>
                  ))
                )}
                <div ref={allCatalogSyncLogEndRef} />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-3 md:p-4 border-orange-200 bg-gradient-to-br from-white to-orange-50/40 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900 tracking-tight">Каталог от Булклима</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Синхронизира <strong>стенни климатици</strong> и{" "}
                <strong>мултисплит системи</strong> от{" "}
                <a href="https://bulclima.com/products/klimatici/stenni-klimatici" className="underline" target="_blank" rel="noreferrer">
                  bulclima.com
                </a>{" "}
                (всички страници + характеристики + до 16 снимки). Статус <strong>По поръчка</strong>; продуктите с
                „ОЧАКВАЙТЕ“ влизат с цена 0 €. По подразбиране не са на публичния сайт — включвате ги ръчно (колона „око“).
              </p>
            </div>
          </div>
          {bulclimaStatus?.at && (
            <p className="text-[11px] text-slate-600 mb-2">
              Последен sync: {new Date(bulclimaStatus.at).toLocaleString("bg-BG")}
              {bulclimaStatus.status ? ` · ${bulclimaStatus.status}` : ""}
              {formatCatalogSyncStats(bulclimaStatus.summary, "productUrls")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => void syncBulclimaCatalog()}
              disabled={anyCatalogSyncing || reclassifying}
              className="gap-2"
            >
              {bulclimaSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              Обнови каталог от Булклима
            </Button>
            <Button
              variant="secondary"
              onClick={() => void reclassifyMisplacedAccessories(true)}
              disabled={anyCatalogSyncing || reclassifying}
              className="gap-2"
            >
              {reclassifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Преглед: помпи → аксесоари
            </Button>
            <Button
              variant="secondary"
              onClick={() => void reclassifyMisplacedAccessories(false)}
              disabled={anyCatalogSyncing || reclassifying}
              className="gap-2"
            >
              Премести грешно внесени в аксесоари
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Sync може да отнеме няколко минути. „Премести“ прехвърля стари помпи/маркучи от климатици в аксесоари (еднократно почистване).
          </p>

          {(bulclimaSyncing || bulclimaLog.length > 0) && (
            <div className="mt-4 space-y-2 border-t border-orange-200/60 pt-4">
              {bulclimaProgress && bulclimaProgress.total > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>Импорт на продукти</span>
                    <span>
                      {bulclimaProgress.current} / {bulclimaProgress.total} (
                      {Math.min(100, Math.round((bulclimaProgress.current / bulclimaProgress.total) * 100))}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (bulclimaProgress.current / bulclimaProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Дневник на синхронизацията</div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900/95 p-2 font-mono text-[10px] leading-relaxed text-slate-100">
                {bulclimaLog.length === 0 ? (
                  <div className="text-slate-400">Очакване на събития…</div>
                ) : (
                  bulclimaLog.map((line, i) => (
                    <div key={`${i}-${line.slice(0, 40)}`} className="whitespace-pre-wrap break-all py-0.5">
                      {line}
                    </div>
                  ))
                )}
                <div ref={bulclimaLogEndRef} />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-3 md:p-4 border-red-200 bg-gradient-to-br from-white to-red-50/30 mt-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900 tracking-tight">Каталог от Климаком (Climacom)</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Стенни + мултисплит + Wi‑Fi от climacom.com. Доставчик КЛИМАКОМ, статус по поръчка, технически
                таблици (SEER, SCOP, размери).
              </p>
            </div>
          </div>
          {climacomStatus?.at && (
            <p className="text-[11px] text-slate-600 mb-2">
              Последен sync: {new Date(climacomStatus.at).toLocaleString("bg-BG")}
              {climacomStatus.status ? ` · ${climacomStatus.status}` : ""}
              {formatCatalogSyncStats(climacomStatus.summary, "productCount")}
            </p>
          )}
          <Button
            variant="primary"
            onClick={() => void syncClimacomCatalog()}
            disabled={anyCatalogSyncing || reclassifying}
            className="gap-2"
          >
            {climacomSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            Обнови каталог от Климаком
          </Button>
          {(climacomSyncing || climacomLog.length > 0) && (
            <div className="mt-4 space-y-2 border-t border-red-200/60 pt-4">
              {climacomProgress && climacomProgress.total > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>Импорт</span>
                    <span>
                      {climacomProgress.current} / {climacomProgress.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-red-100 overflow-hidden">
                    <div
                      className="h-full bg-red-600 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (climacomProgress.current / climacomProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900/95 p-2 font-mono text-[10px] text-slate-100">
                {climacomLog.map((line, i) => (
                  <div key={`c-${i}`} className="whitespace-pre-wrap break-all py-0.5">
                    {line}
                  </div>
                ))}
                <div ref={climacomLogEndRef} />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-3 md:p-4 border-sky-200 bg-gradient-to-br from-white to-sky-50/40 mt-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900 tracking-tight">Каталог от Кондекс (Condex)</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Mitsubishi Heavy Industries — шестте стенни RAC серии от{" "}
                <a href="https://condex.bg/products/seria-diamond-zsx-zmx/" className="underline" target="_blank" rel="noreferrer">
                  condex.bg
                </a>{" "}
                (Diamond ZSX/ZR, Premium PRO/ZS, Smart Plus, Standard ZSP): цени, пълни технически таблици и до 16 снимки.
              </p>
            </div>
          </div>
          {condexStatus?.at && (
            <p className="text-[11px] text-slate-600 mb-2">
              Последен sync: {new Date(condexStatus.at).toLocaleString("bg-BG")}
              {condexStatus.status ? ` · ${condexStatus.status}` : ""}
              {formatCatalogSyncStats(condexStatus.summary, "productUrls")}
            </p>
          )}
          <Button
            variant="primary"
            onClick={() => void syncCondexCatalog()}
            disabled={anyCatalogSyncing || reclassifying}
            className="gap-2"
          >
            {condexSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            Обнови каталог от Кондекс
          </Button>
          <p className="text-[10px] text-slate-500 mt-2">
            Пълен обхват: ~100+ single RAC + ~40 multi-split. Може да отнеме 10–15 минути.
          </p>
          {condexProgress && (condexSyncing || condexProgress.phase === "done") && (
            <div className="mt-4">
              <CondexSyncProgressBar
                progress={condexProgress}
                syncing={condexSyncing}
                nowMs={condexNowMs}
              />
            </div>
          )}
          {(condexSyncing || condexLog.length > 0) && (
            <div className="mt-4 space-y-2 border-t border-sky-200/60 pt-4">
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Дневник</div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900/95 p-2 font-mono text-[10px] text-slate-100">
                {condexLog.map((line, i) => (
                  <div key={`x-${i}`} className="whitespace-pre-wrap break-all py-0.5">
                    {line}
                  </div>
                ))}
                <div ref={condexLogEndRef} />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-3 md:p-4 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 mt-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900 tracking-tight">Каталог от Биттел (Bittel)</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Инверторни климатици + мулти-сплит системи + аксесоари от bittel.bg. Марки: Daikin, LG, Toshiba, Gree,
                AUX, Nippon, TechPoint, Mitsubishi. Доставчик БИТТЕЛ, статус по поръчка, технически таблици и снимки.
              </p>
            </div>
          </div>
          {bittelStatus?.at && (
            <p className="text-[11px] text-slate-600 mb-2">
              Последен sync: {new Date(bittelStatus.at).toLocaleString("bg-BG")}
              {bittelStatus.status ? ` · ${bittelStatus.status}` : ""}
              {formatCatalogSyncStats(bittelStatus.summary, "productUrls")}
            </p>
          )}
          <Button
            variant="primary"
            onClick={() => void syncBittelCatalog()}
            disabled={anyCatalogSyncing || reclassifying}
            className="gap-2"
          >
            {bittelSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            Обнови каталог от Биттел
          </Button>
          <p className="text-[10px] text-slate-500 mt-2">
            Пълен обхват: ~255 климатика + ~64 мулти-сплит + аксесоари. Може да отнеме 20–35 минути.
          </p>
          {bittelProgress && (bittelSyncing || bittelProgress.phase === "done") && (
            <div className="mt-4">
              <CondexSyncProgressBar
                progress={bittelProgress}
                syncing={bittelSyncing}
                nowMs={bittelNowMs}
              />
            </div>
          )}
          {(bittelSyncing || bittelLog.length > 0) && (
            <div className="mt-4 space-y-2 border-t border-emerald-200/60 pt-4">
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Дневник</div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900/95 p-2 font-mono text-[10px] text-slate-100">
                {bittelLog.map((line, i) => (
                  <div key={`b-${i}`} className="whitespace-pre-wrap break-all py-0.5">
                    {line}
                  </div>
                ))}
                <div ref={bittelLogEndRef} />
              </div>
            </div>
          )}
        </Card>
        </>
      )}
    </div>
  );
}
