"use client";

import { useEffect, useRef, useState } from "react";
import { SectionTitle, Card, Input, Button } from "../ui";
import { RefreshCw, Save, Database, Download, FolderOpen, CloudDownload } from "lucide-react";
import type { BulclimaSyncProgressEvent } from "@/lib/import/bulclima/bulclimaSyncProgress";
import type { ClimacomSyncProgressEvent } from "@/lib/import/climacom/climacomSyncProgress";
import type { CondexSyncProgressEvent } from "@/lib/import/condex/condexSyncProgress";
import type { BittelSyncProgressEvent } from "@/lib/import/bittel/bittelSyncProgress";
import {
  isLocalFolderPickerSupported,
  pickLocalFolder,
  writeBlobToDirectory,
} from "@/lib/client/pickLocalFolder";

const MAX_SYNC_LOG_LINES = 300;

/** Очакван брой Condex продукти (за crawl прогрес преди финален брой). */
const CONDEX_ESTIMATED_PRODUCTS = 120;
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

async function consumeCatalogSyncStream<T extends { message: string }>(
  res: Response,
  onProgress: (ev: T) => void,
): Promise<Record<string, unknown>> {
  if (!res.body) throw new Error("Празен отговор от сървъра");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const block of chunks) {
      if (!block.trim() || block.startsWith(":")) continue;
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      const parsed = JSON.parse(data) as { error?: string; data?: Record<string, unknown> };
      if (event === "progress") onProgress(parsed as T);
      else if (event === "done") summary = parsed.data ?? null;
      else if (event === "error") throw new Error(parsed.error || "Грешка при синхронизация");
    }
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
  { id: "catalog", label: "Каталог", hint: "Импорт от Булклима и Климаком (Climacom)" },
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
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
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

  async function syncClimacomCatalog() {
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
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setClimacomSyncing(false);
      setClimacomProgress(null);
    }
  }

  async function syncCondexCatalog() {
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
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setCondexSyncing(false);
      setCondexProgress((prev) => (prev ? { ...prev, phase: "done" } : null));
    }
  }

  async function syncBittelCatalog() {
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
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBittelSyncing(false);
      setBittelProgress((prev) => (prev ? { ...prev, phase: "done" } : null));
    }
  }

  async function syncBulclimaCatalog() {
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
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBulclimaSyncing(false);
      setBulclimaProgress(null);
    }
  }

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
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error || "Грешка при генериране на архива");
      }
      const blob = await res.blob();
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
                    <strong>JSON</strong> — пълен технически архив на базата. <strong>Excel</strong> — отчет за офиса: лист{" "}
                    <strong>„Продажби“</strong> (всички продажби до момента) и <strong>„Налична стока“</strong> (артикули със
                    статус „В наличност“). Запишете файловете на сигурно място.
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
              <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                За автоматични седмични копия на ниво PostgreSQL вижте Supabase Dashboard → Database → Backups.
              </p>
            </>
          )}
        </Card>
      )}

      {activeTab === "catalog" && (
        <>
        <Card className="p-3 md:p-4 border-orange-200 bg-gradient-to-br from-white to-orange-50/40 mb-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900 tracking-tight">Каталог от Булклима</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Зарежда климатиците от bulclima.com в админ каталога със статус <strong>По поръчка</strong>. Внася до{" "}
                <strong>4 големи снимки</strong> на продукт (оригинал от сайта, не миниатюри). По подразбиране не се
                показват на публичния сайт — включвате ги ръчно (колона „око“ в списъка продукти).
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
              disabled={bulclimaSyncing || climacomSyncing || condexSyncing || bittelSyncing || reclassifying}
              className="gap-2"
            >
              {bulclimaSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              Обнови каталог от Булклима
            </Button>
            <Button
              variant="secondary"
              onClick={() => void reclassifyMisplacedAccessories(true)}
              disabled={bulclimaSyncing || climacomSyncing || condexSyncing || bittelSyncing || reclassifying}
              className="gap-2"
            >
              {reclassifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Преглед: помпи → аксесоари
            </Button>
            <Button
              variant="secondary"
              onClick={() => void reclassifyMisplacedAccessories(false)}
              disabled={bulclimaSyncing || climacomSyncing || condexSyncing || bittelSyncing || reclassifying}
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
            disabled={bulclimaSyncing || climacomSyncing || condexSyncing || bittelSyncing || reclassifying}
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
                Mitsubishi Heavy Industries — RAC за дома и офиса + multi-split (SCM) от condex.bg. Доставчик КОНДЕКС,
                статус по поръчка, технически таблици и снимки от сайта.
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
            disabled={bulclimaSyncing || climacomSyncing || condexSyncing || bittelSyncing || reclassifying}
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
            disabled={bulclimaSyncing || climacomSyncing || condexSyncing || bittelSyncing || reclassifying}
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
