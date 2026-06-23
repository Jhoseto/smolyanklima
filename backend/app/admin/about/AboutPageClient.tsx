"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitCommitHorizontal, Loader2, RefreshCw, Search, FilterX } from "lucide-react";
import { Button, Card, Input, SectionTitle } from "../ui";
import { useDebounce } from "@/lib/hooks/useDebounce";
import type { ApplicationChangelogRow } from "@/lib/admin/applicationChangelog/types";

const BOOTSTRAP_PAGE_KEY = "sk-changelog-bootstrap-page";
const BOOTSTRAP_DONE_KEY = "sk-changelog-bootstrap-done";
const BG_TZ = "Europe/Sofia";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BG_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function fmtDayHeading(iso: string): string {
  const d = new Date(iso);
  const weekday = new Intl.DateTimeFormat("bg-BG", { timeZone: BG_TZ, weekday: "long" }).format(d);
  const date = new Intl.DateTimeFormat("bg-BG", {
    timeZone: BG_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return `${date} · ${weekday}`;
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("bg-BG", {
    timeZone: BG_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function displayTitle(row: ApplicationChangelogRow): string {
  if (row.title_bg?.trim()) return row.title_bg.trim();
  return "Обновление на приложението";
}

function displaySummary(row: ApplicationChangelogRow): string {
  if (row.summary_bg?.trim()) return row.summary_bg.trim();
  if (row.sync_status === "pending") return "Описанието се подготвя…";
  return "Направена е промяна в системата.";
}

type DayGroup = { key: string; heading: string; items: ApplicationChangelogRow[] };

function groupByDay(rows: ApplicationChangelogRow[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const row of rows) {
    const key = dayKey(row.committed_at);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(row);
    } else {
      map.set(key, { key, heading: fmtDayHeading(row.committed_at), items: [row] });
    }
  }
  return [...map.values()];
}

export function AboutPageClient() {
  const [items, setItems] = useState<ApplicationChangelogRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 30, total: 0, failedCount: 0, needsAiCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const bootstrapStarted = useRef(false);
  const upgradeRunning = useRef(false);

  const debouncedQ = useDebounce(q, 350);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    sp.set("page", String(page));
    sp.set("perPage", "30");
    return sp.toString();
  }, [debouncedQ, page]);

  const dayGroups = useMemo(() => groupByDay(items), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/application-changelog?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка при зареждане");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 30, total: 0, failedCount: 0, needsAiCount: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    if (meta.total > 0 && !localStorage.getItem(BOOTSTRAP_PAGE_KEY)) {
      localStorage.setItem(BOOTSTRAP_DONE_KEY, "1");
    }
  }, [loading, meta.total]);

  const runAiUpgrade = useCallback(async () => {
    if (upgradeRunning.current) return;
    upgradeRunning.current = true;
    setUpgrading(true);
    let remaining = meta.needsAiCount || 1;

    try {
      while (remaining > 0) {
        setStatusMessage("Обновяване на описанията…");
        const res = await fetch("/api/admin/application-changelog/fix-descriptions?batch=4", {
          method: "POST",
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Грешка");
        remaining = json.remaining ?? 0;
        await load();
        if ((json.upgraded ?? 0) === 0 && !json.done) break;
        if (json.done) break;
        await sleep(300);
      }
      if (remaining === 0) {
        setStatusMessage(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка");
      upgradeRunning.current = false;
    } finally {
      setUpgrading(false);
      if (remaining > 0) upgradeRunning.current = false;
    }
  }, [load, meta.needsAiCount]);

  useEffect(() => {
    if (loading || upgrading || upgradeRunning.current) return;
    if ((meta.needsAiCount ?? 0) <= 0 && (meta.failedCount ?? 0) <= 0) return;
    void runAiUpgrade();
  }, [loading, meta.needsAiCount, meta.failedCount, upgrading, runAiUpgrade]);

  const runBootstrap = useCallback(async (startPage = 1) => {
    if (bootstrapping) return;
    setBootstrapping(true);
    setError(null);
    setStatusMessage("Първоначално зареждане на историята…");
    let pg = Math.max(1, startPage);
    let done = false;
    let totalImported = 0;

    try {
      while (!done) {
        localStorage.setItem(BOOTSTRAP_PAGE_KEY, String(pg));

        const res = await fetch("/api/admin/application-changelog/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "bootstrap", page: pg }),
        });
        const json = await res.json();

        if (res.status === 429 && json.rateLimited) {
          const waitMs = Math.min(json.retryAfterMs ?? 60_000, 3_600_000);
          const mins = Math.ceil(waitMs / 60_000);
          setStatusMessage(`GitHub лимит — изчакване ~${mins} мин…`);
          await sleep(waitMs);
          continue;
        }

        if (!res.ok) throw new Error(json.error || "Грешка при зареждане");

        pg = json.nextPage ?? pg + 1;
        done = json.done;
        totalImported += json.imported ?? 0;
        setStatusMessage(
          done
            ? `Готово — ${totalImported} нови стъпки.`
            : `Зареждане… (${totalImported} нови)`,
        );
      }

      localStorage.setItem(BOOTSTRAP_DONE_KEY, "1");
      localStorage.removeItem(BOOTSTRAP_PAGE_KEY);
      setPage(1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при зареждане");
      setStatusMessage(null);
    } finally {
      setBootstrapping(false);
    }
  }, [bootstrapping, load]);

  useEffect(() => {
    if (loading || bootstrapping || bootstrapStarted.current) return;
    if (localStorage.getItem(BOOTSTRAP_DONE_KEY) === "1") return;

    const savedPage = parseInt(localStorage.getItem(BOOTSTRAP_PAGE_KEY) || "1", 10);
    bootstrapStarted.current = true;
    void runBootstrap(savedPage);
  }, [loading, bootstrapping, runBootstrap]);

  async function runRefresh() {
    if (refreshing || bootstrapping || upgrading) return;

    if (meta.total === 0 && !debouncedQ.trim() && localStorage.getItem(BOOTSTRAP_DONE_KEY) !== "1") {
      bootstrapStarted.current = false;
      const savedPage = parseInt(localStorage.getItem(BOOTSTRAP_PAGE_KEY) || "1", 10);
      await runBootstrap(savedPage);
      return;
    }

    setRefreshing(true);
    setStatusMessage("Проверка за нови промени…");
    try {
      const res = await fetch("/api/admin/application-changelog/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "incremental" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка при обновяване");
      const added = json.added ?? 0;
      setStatusMessage(added > 0 ? `Добавени ${added} нови стъпки.` : "Няма нови промени.");
      setPage(1);
      await load();
      if (added > 0) {
        upgradeRunning.current = false;
        await runAiUpgrade();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при обновяване");
      setStatusMessage(null);
    } finally {
      setRefreshing(false);
    }
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));
  const hasFilters = Boolean(q.trim());
  const busy = loading || bootstrapping || refreshing || upgrading;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg md:text-xl font-bold text-slate-900">
          <SectionTitle
            title="За приложението"
            hint="Хронология на развитието — подредена по дни и час (българско време)."
          />
        </h1>
        <Button type="button" variant="secondary" onClick={() => void runRefresh()} disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Обнови
        </Button>
      </div>

      {statusMessage && (
        <Card className="p-3 text-sm text-slate-600 bg-slate-50 border-slate-200 flex items-center gap-2">
          {(bootstrapping || upgrading) && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
          {statusMessage}
        </Card>
      )}

      <Card className="p-3 md:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Търси в историята…"
          />
        </div>
        {hasFilters && (
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            onClick={() => {
              setQ("");
              setPage(1);
            }}
          >
            <FilterX className="h-4 w-4" />
            Изчисти
          </Button>
        )}
      </Card>

      {error && (
        <Card className="p-3 text-sm text-red-700 bg-red-50 border-red-200">{error}</Card>
      )}

      {busy && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">{bootstrapping ? "Първоначално зареждане…" : "Зареждане…"}</p>
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <GitCommitHorizontal className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700">Все още няма записи</p>
          <p className="text-sm mt-1">Историята ще се зареди автоматично при първо отваряне.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {dayGroups.map((group, groupIdx) => (
            <section key={group.key}>
              <h2 className="sticky top-0 z-10 mb-4 py-2 text-sm font-black uppercase tracking-wide text-brand-blue-800 bg-white/95 backdrop-blur border-b border-brand-blue-100 capitalize">
                {group.heading}
              </h2>
              <ol className="relative border-l-2 border-brand-blue-200 ml-3 space-y-0">
                {group.items.map((row, idx) => {
                  const processing = row.sync_status === "pending";
                  const isFirstOverall = groupIdx === 0 && idx === 0 && meta.page === 1;
                  return (
                    <li key={row.commit_sha} className="relative pl-6 pb-5 last:pb-0">
                      <span
                        className={`absolute -left-[9px] top-2 h-4 w-4 rounded-full border-2 border-white ${
                          processing ? "bg-amber-400" : "bg-brand-blue-600"
                        }`}
                      />
                      {isFirstOverall && (
                        <span className="absolute -left-[9px] -top-0.5 h-4 w-4 rounded-full bg-brand-orange-500 border-2 border-white animate-pulse" />
                      )}
                      <Card className="p-4 md:p-5">
                        <time
                          className="text-xs font-bold text-slate-500 tabular-nums"
                          dateTime={row.committed_at}
                        >
                          {fmtTime(row.committed_at)} ч.
                        </time>
                        <h3
                          className={`mt-1 text-[15px] font-bold leading-snug ${
                            processing ? "text-slate-600" : "text-slate-950"
                          }`}
                        >
                          {displayTitle(row)}
                          {processing && (
                            <Loader2 className="inline-block ml-2 h-3.5 w-3.5 animate-spin text-amber-500" />
                          )}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{displaySummary(row)}</p>
                      </Card>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Назад
          </Button>
          <span className="text-sm text-slate-500">
            Страница {page} / {pages} · {meta.total} стъпки
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Напред
          </Button>
        </div>
      )}
    </div>
  );
}
