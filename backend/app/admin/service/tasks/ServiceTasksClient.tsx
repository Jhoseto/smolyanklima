"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wrench, ShoppingCart, CalendarDays,
  MapPin, Phone, User, CheckCircle2, Clock, Loader2,
  AlertCircle, ChevronLeft, ChevronRight, RefreshCw,
  ChevronDown, FileText,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = "planned" | "in_progress" | "done" | "cancelled";
type EventCode =
  | "sale"
  | "service_installation"
  | "service_maintenance"
  | "service_on_site"
  | "service_in_shop"
  | null;

interface Task {
  id: string;
  title: string;
  type: string;
  event_code: EventCode;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  notes: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function weekOf(anchor: Date): Date[] {
  const day = anchor.getDay();
  const mon = addDays(anchor, -(day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function buildMonthGrid(y: number, m: number): (Date | null)[] {
  const first = new Date(y, m, 1).getDay();
  const offset = (first + 6) % 7;
  const days = getDaysInMonth(y, m);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const BG_WEEKDAY_SHORT = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const BG_WEEKDAY_LONG  = ["Неделя", "Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота"];
const BG_MONTH_LONG  = ["Януари","Февруари","Март","Април","Май","Юни","Юли","Август","Септември","Октомври","Ноември","Декември"];
const BG_MONTH_SHORT = ["яну","фев","мар","апр","май","юни","юли","авг","сеп","окт","ное","дек"];

function fmtShortDate(d: Date) { return `${d.getDate()} ${BG_MONTH_SHORT[d.getMonth()]}`; }
function fmtFullDate(key: string) {
  const d = new Date(`${key}T00:00:00`);
  return `${BG_WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} ${BG_MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Labels ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaskStatus, string> = {
  planned: "Планирано", in_progress: "В процес",
  done: "Изпълнено", cancelled: "Отказано",
};
const STATUS_PILL: Record<TaskStatus, string> = {
  planned:     "bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  done:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled:   "bg-slate-100 text-slate-500 border-slate-200",
};
const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-300", medium: "bg-amber-400", high: "bg-red-500",
};
const EVENT_ICON: Partial<Record<string, React.ReactNode>> = {
  service_installation: <Wrench className="w-5 h-5 text-brand-blue-500" />,
  service_maintenance: <Wrench className="w-5 h-5 text-teal-500" />,
  service_on_site: <Wrench className="w-5 h-5 text-indigo-500" />,
  service_in_shop: <Wrench className="w-5 h-5 text-violet-500" />,
  sale: <ShoppingCart className="w-5 h-5 text-green-500" />,
};
const EVENT_LABEL: Partial<Record<string, string>> = {
  service_installation: "Монтаж",
  service_maintenance: "Профилактика",
  service_on_site: "Сервиз на терен",
  service_in_shop: "Сервиз в склад",
  sale: "Продажба",
};
const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = { planned: "in_progress", in_progress: "done" };
const NEXT_LABEL: Partial<Record<TaskStatus, string>> = {
  planned: "Стартирай събитието",
  in_progress: "Маркирай като изпълнено",
};
const NEXT_BTN: Partial<Record<TaskStatus, string>> = {
  planned:     "bg-brand-blue-500 hover:bg-brand-blue-700 active:bg-brand-blue-700 text-white shadow-md shadow-brand-blue-200",
  in_progress: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-200",
};

// ── Task card (shared mobile + desktop) ──────────────────────────────────────

function TaskCard({
  task,
  expanded,
  onToggle,
  onAdvance,
  updating,
  compact = false,
}: {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
  onAdvance: (t: Task) => void;
  updating: boolean;
  compact?: boolean;
}) {
  const isDone = task.status === "done" || task.status === "cancelled";
  const nextStatus = NEXT_STATUS[task.status];

  return (
    <div className={`rounded-2xl overflow-hidden border shadow-sm transition-all ${
      isDone
        ? "bg-slate-50 border-slate-200 opacity-60"
        : task.status === "in_progress"
        ? "bg-white border-amber-200 shadow-amber-50"
        : "bg-white border-slate-200"
    }`}>
      {task.status === "in_progress" && <div className="h-1 bg-amber-400 w-full" />}
      {task.status === "done" && <div className="h-1 bg-emerald-400 w-full" />}

      <div className={compact ? "p-3" : "p-4"}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`rounded-xl bg-slate-100 flex items-center justify-center shrink-0 ${compact ? "w-9 h-9" : "w-10 h-10"}`}>
            {EVENT_ICON[task.event_code ?? ""] ?? <CalendarDays className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-slate-400`} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
              <p className={`font-bold text-slate-900 leading-tight ${compact ? "text-sm" : "text-sm"}`}>{task.title}</p>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {task.event_code && EVENT_LABEL[task.event_code] && (
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  {EVENT_LABEL[task.event_code]}
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_PILL[task.status]}`}>
                {STATUS_LABEL[task.status]}
              </span>
              {task.scheduled_start && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Clock className="w-3 h-3" />
                  {task.scheduled_start.slice(0, 5)}
                  {task.scheduled_end ? `–${task.scheduled_end.slice(0, 5)}` : ""}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onToggle}
            className="w-11 h-11 min-w-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Customer info */}
        <div className={`space-y-2 ${compact ? "mt-2" : "mt-3"}`}>
          {task.customer_name && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold">{task.customer_name}</span>
            </div>
          )}
          {task.customer_phone && (
            <a href={`tel:${task.customer_phone}`} className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
              <div className={`rounded-xl bg-brand-blue-50 border border-brand-blue-100 flex items-center justify-center shrink-0 ${compact ? "w-7 h-7" : "w-8 h-8"}`}>
                <Phone className={`text-brand-blue-500 ${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
              </div>
              <span className={`font-bold text-brand-blue-500 ${compact ? "text-sm" : "text-base"}`}>{task.customer_phone}</span>
            </a>
          )}
          {task.customer_address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(task.customer_address)}`}
              target="_blank" rel="noreferrer"
              className="flex items-start gap-2.5"
              onClick={e => e.stopPropagation()}
            >
              <div className={`rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 mt-0.5 ${compact ? "w-7 h-7" : "w-8 h-8"}`}>
                <MapPin className={`text-violet-500 ${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
              </div>
              <span className="text-violet-600 font-semibold underline underline-offset-2 leading-snug text-sm">
                {task.customer_address}
              </span>
            </a>
          )}
        </div>

        {/* Notes (expandable) */}
        {expanded && task.notes && (
          <div className="mt-3 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex-1 text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
              {task.notes}
            </div>
          </div>
        )}
      </div>

      {/* Action button */}
      {nextStatus && !isDone && (
        <div className={compact ? "px-3 pb-3" : "px-4 pb-4"}>
          <button
            onClick={() => onAdvance(task)}
            disabled={updating}
            className={`w-full rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.98] disabled:opacity-50 min-h-[48px] text-sm ${NEXT_BTN[task.status]}`}
          >
            {updating
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : task.status === "in_progress"
              ? <CheckCircle2 className="w-5 h-5" />
              : <Clock className="w-5 h-5" />}
            {NEXT_LABEL[task.status]}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ServiceTasksClient({
  userId, userName, role,
}: {
  userId: string; userName: string; role: string;
}) {
  const todayKey = toKey(new Date());

  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isMaster = role === "master_admin";

  const week = weekOf(weekAnchor);

  const fetchMonth = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const from = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
      const to   = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(getDaysInMonth(calYear, calMonth)).padStart(2, "0")}`;
      const sp = new URLSearchParams({ type: "service", from, to, perPage: "500" });
      if (!isMaster) sp.set("assignedTo", userId);
      const res = await fetch(`/api/admin/work-items?${sp}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Грешка");
      setTasks(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally { setLoading(false); }
  }, [calYear, calMonth, userId, isMaster]);

  useEffect(() => { void fetchMonth(); }, [fetchMonth]);

  // sync week strip with selected month
  useEffect(() => {
    const sel = new Date(`${selectedKey}T00:00:00`);
    if (sel.getMonth() !== calMonth || sel.getFullYear() !== calYear) {
      setCalYear(sel.getFullYear());
      setCalMonth(sel.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const byDay: Record<string, Task[]> = {};
  for (const t of tasks) {
    if (!t.due_date) continue;
    const k = t.due_date.slice(0, 10);
    (byDay[k] ??= []).push(t);
  }

  const dayTasks = (byDay[selectedKey] ?? []).sort((a, b) =>
    (a.scheduled_start ?? "99:99").localeCompare(b.scheduled_start ?? "99:99")
  );
  const pending = dayTasks.filter(t => t.status !== "done" && t.status !== "cancelled").length;

  async function advance(task: Task) {
    const next = NEXT_STATUS[task.status];
    if (!next) return;
    setUpdatingId(task.id);
    try {
      const res = await fetch(`/api/admin/work-items/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error ?? "Грешка при обновяване");
        return;
      }
      void fetchMonth();
    } catch {
      setError("Мрежова грешка при обновяване на събитие");
    } finally { setUpdatingId(null); }
  }

  function prevWeek() {
    setWeekAnchor(d => {
      const newAnchor = addDays(d, -7);
      const newWeek = weekOf(newAnchor);
      setSelectedKey(toKey(newWeek[0]));
      return newAnchor;
    });
  }
  function nextWeek() {
    setWeekAnchor(d => {
      const newAnchor = addDays(d, 7);
      const newWeek = weekOf(newAnchor);
      setSelectedKey(toKey(newWeek[0]));
      return newAnchor;
    });
  }
  function goToday()  { setWeekAnchor(new Date()); setSelectedKey(todayKey); }

  function prevMonth() {
    const newMonth = calMonth === 0 ? 11 : calMonth - 1;
    const newYear = calMonth === 0 ? calYear - 1 : calYear;
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    // clamp selectedKey to new month if out of range
    const selDate = new Date(`${selectedKey}T00:00:00`);
    if (selDate.getFullYear() !== newYear || selDate.getMonth() !== newMonth) {
      setSelectedKey(`${newYear}-${String(newMonth + 1).padStart(2, "0")}-01`);
    }
  }
  function nextMonth() {
    const newMonth = calMonth === 11 ? 0 : calMonth + 1;
    const newYear = calMonth === 11 ? calYear + 1 : calYear;
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    // clamp selectedKey to new month if out of range
    const selDate = new Date(`${selectedKey}T00:00:00`);
    if (selDate.getFullYear() !== newYear || selDate.getMonth() !== newMonth) {
      setSelectedKey(`${newYear}-${String(newMonth + 1).padStart(2, "0")}-01`);
    }
  }

  const weekLabel = (() => {
    const [first, last] = [week[0], week[6]];
    if (first.getMonth() === last.getMonth())
      return `${first.getDate()}–${last.getDate()} ${BG_MONTH_SHORT[first.getMonth()]} ${first.getFullYear()}`;
    return `${fmtShortDate(first)} – ${fmtShortDate(last)} ${last.getFullYear()}`;
  })();

  const calGrid = buildMonthGrid(calYear, calMonth);
  const GRID_DAYS = ["Пон", "Вт", "Ср", "Чет", "Пет", "Съб", "Нед"];

  // ── Shared day task panel ─────────────────────────────────────────────────

  function DayPanel({ compact = false }: { compact?: boolean }) {
    return (
      <div className={compact ? "space-y-2" : "space-y-3"}>
        {/* Day heading */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`font-bold text-slate-800 capitalize ${compact ? "text-sm" : "text-base"}`}>
              {selectedKey === todayKey ? "Днес — " : ""}
              {fmtFullDate(selectedKey)}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {dayTasks.length === 0 ? "Няма събития" : `${dayTasks.length} събит${dayTasks.length === 1 ? "ие" : "ия"}`}
              {pending > 0 && ` · ${pending} чакащи`}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : dayTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center bg-white border border-dashed border-slate-200 rounded-2xl px-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-200" />
            <p className="text-sm font-semibold text-slate-500">Няма събития за тази дата</p>
            {!isMaster && (
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                Ако очаквате монтаж или сервиз — помолете офиса да ви назначи работен елемент в календара.
              </p>
            )}
          </div>
        ) : (
          dayTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              expanded={expandedId === task.id}
              onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)}
              onAdvance={advance}
              updating={updatingId === task.id}
              compact={compact}
            />
          ))
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          DESKTOP layout (md+) — two columns
      ════════════════════════════════════════════════════════ */}
      <div className="hidden md:block w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Сервизни събития</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isMaster ? "Всички работни елементи за обслужване" : `Здравей, ${userName.split(" ")[0]} — твоите събития`}
            </p>
          </div>
          <button
            onClick={() => void fetchMonth()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Обнови
          </button>
        </div>

        <div className="grid grid-cols-[300px_1fr] gap-5 items-start">
          {/* Left: month calendar */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden sticky top-4">
            {/* Month nav */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-slate-800 capitalize">
                {BG_MONTH_LONG[calMonth]} {calYear}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {/* Day labels */}
            <div className="grid grid-cols-7 px-3 pt-2">
              {GRID_DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 pb-1">{d}</div>
              ))}
            </div>
            {/* Days grid */}
            <div className="px-3 pb-3">
              {Array.from({ length: calGrid.length / 7 }, (_, wi) =>
                calGrid.slice(wi * 7, wi * 7 + 7)
              ).map((row, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {row.map((day, di) => {
                    if (!day) return <div key={di} />;
                    const k = toKey(day);
                    const isSelected = k === selectedKey;
                    const isToday = k === todayKey;
                    const count = (byDay[k] ?? []).length;
                    const hasPending = (byDay[k] ?? []).some(t => t.status !== "done" && t.status !== "cancelled");
                    return (
                      <button
                        key={di}
                        onClick={() => setSelectedKey(k)}
                        className={`relative flex flex-col items-center justify-center h-10 rounded-xl text-sm font-semibold transition-all ${
                          isSelected ? "bg-brand-blue-500 text-white shadow-md" :
                          isToday    ? "bg-brand-blue-50 text-brand-blue-700 font-bold" :
                                       "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {day.getDate()}
                        {count > 0 && (
                          <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                            isSelected ? "bg-white/60" : hasPending ? "bg-amber-500" : "bg-emerald-400"
                          }`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* Today link */}
            <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {Object.values(byDay).flat().length} събития месеца
              </span>
              <button onClick={goToday} className="text-xs font-bold text-brand-blue-500 hover:text-brand-blue-700">
                Към днес →
              </button>
            </div>
          </div>

          {/* Right: task cards */}
          <div className="min-w-0">
            <DayPanel compact={false} />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MOBILE layout (< md) — week strip + task cards
      ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:hidden">
        {/* Sticky top bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          {/* Greeting + refresh */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">
                {isMaster ? "Сервизни събития" : `Здравей, ${userName.split(" ")[0]}`}
              </p>
              {pending > 0 && (
                <p className="text-xs font-bold text-amber-600">{pending} чакащи събития</p>
              )}
            </div>
            <button
              onClick={() => void fetchMonth()}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 active:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Month + year label */}
          <div className="flex items-center justify-center px-4 pb-0.5">
            <span className="text-xs font-black text-slate-700 capitalize tracking-wide">
              {BG_MONTH_LONG[week[3].getMonth()]} {week[3].getFullYear()}
            </span>
          </div>

          {/* Week strip */}
          <div className="flex items-center gap-1 px-2 pb-1">
            <button onClick={prevWeek} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 active:bg-slate-100 shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-none py-1">
              {week.map(day => {
                const k = toKey(day);
                const isSel = k === selectedKey;
                const isToday = k === todayKey;
                const count = (byDay[k] ?? []).length;
                const hasPending = (byDay[k] ?? []).some(t => t.status !== "done" && t.status !== "cancelled");
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedKey(k)}
                    className={`flex flex-col items-center justify-center rounded-2xl min-w-[44px] h-16 px-2 transition-all select-none ${
                      isSel    ? "bg-brand-blue-500 text-white shadow-lg shadow-brand-blue-200" :
                      isToday  ? "bg-brand-blue-50 text-brand-blue-700" :
                                 "bg-white text-slate-600 border border-slate-100"
                    }`}
                  >
                    <span className={`text-[10px] font-semibold ${isSel ? "text-brand-blue-100" : "text-slate-400"}`}>
                      {BG_WEEKDAY_SHORT[day.getDay()]}
                    </span>
                    <span className="text-base font-black leading-tight tabular-nums">{day.getDate()}</span>
                    {count > 0 ? (
                      <span className={`text-[9px] font-bold rounded-full px-1.5 leading-5 ${
                        isSel ? "bg-white/20 text-white" :
                        hasPending ? "bg-amber-100 text-amber-700" :
                                     "bg-emerald-100 text-emerald-700"
                      }`}>{count}</span>
                    ) : <span className="h-4" />}
                  </button>
                );
              })}
            </div>
            <button onClick={nextWeek} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 active:bg-slate-100 shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Week label */}
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-[11px] text-slate-400 font-medium">{weekLabel}</span>
            {selectedKey !== todayKey && (
              <button onClick={goToday} className="text-[11px] font-bold text-brand-blue-500">→ Към днес</button>
            )}
          </div>
        </div>

        {/* Day tasks */}
        <div className="px-3 pt-3 pb-28 space-y-3">
          <DayPanel compact={false} />
        </div>
      </div>
    </>
  );
}
