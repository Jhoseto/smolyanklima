"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock, MapPin, Phone, User, CheckCircle2,
  Clock, Loader2, AlertCircle, ChevronDown, RefreshCw,
  Wrench, ShoppingCart, ClipboardList,
} from "lucide-react";

type TaskStatus = "planned" | "in_progress" | "done" | "cancelled";
type EventCode =
  | "sale" | "service_installation" | "service_inspection"
  | "service_repair" | "service_maintenance" | null;

interface Task {
  id: string;
  title: string;
  type: string;
  event_code: EventCode;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  notes: string | null;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: "Планирано",
  in_progress: "В процес",
  done: "Изпълнено",
  cancelled: "Отказано",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  planned: "bg-sky-100 text-sky-700 border-sky-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  done: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-300",
  medium: "bg-amber-400",
  high: "bg-red-500",
};

const EVENT_ICON: Partial<Record<string, React.ReactNode>> = {
  service_installation: <Wrench className="w-4 h-4 text-sky-500" />,
  service_inspection: <ClipboardList className="w-4 h-4 text-purple-500" />,
  service_repair: <Wrench className="w-4 h-4 text-orange-500" />,
  service_maintenance: <Wrench className="w-4 h-4 text-teal-500" />,
  sale: <ShoppingCart className="w-4 h-4 text-green-500" />,
};

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  planned: "in_progress",
  in_progress: "done",
};

const NEXT_STATUS_LABEL: Partial<Record<TaskStatus, string>> = {
  planned: "Стартирай",
  in_progress: "Маркирай като изпълнено",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" });
}

function groupByDate(tasks: Task[]): { label: string; date: string | null; items: Task[] }[] {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const map = new Map<string, Task[]>();
  const noDate: Task[] = [];

  for (const t of tasks) {
    if (!t.due_date) { noDate.push(t); continue; }
    const key = t.due_date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  const groups: { label: string; date: string | null; items: Task[] }[] = [];
  const sorted = [...map.keys()].sort();
  for (const d of sorted) {
    const label = d === today ? "Днес" : d === tomorrow ? "Утре" : formatDate(d);
    groups.push({ label, date: d, items: map.get(d)! });
  }
  if (noDate.length > 0) groups.push({ label: "Без дата", date: null, items: noDate });
  return groups;
}

export function ServiceDashboard({ userId, userName, role }: { userId: string; userName: string; role: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isMasterAdmin = role === "master_admin";

  const fetchTasks = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // master_admin sees ALL service tasks; service_staff sees only their own
      const params = isMasterAdmin
        ? `/api/admin/work-items?type=service&status=planned,in_progress&perPage=200`
        : `/api/admin/work-items?assignedTo=${userId}&status=planned,in_progress&perPage=100`;
      const res = await fetch(params);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Грешка");
      setTasks(data.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка при зареждане");
    } finally {
      setLoading(false);
    }
  }, [userId, isMasterAdmin]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const advanceStatus = async (task: Task) => {
    const next = NEXT_STATUS[task.status];
    if (!next) return;
    setUpdatingId(task.id);
    await fetch(`/api/admin/work-items/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setUpdatingId(null);
    fetchTasks();
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = tasks.filter(t => t.due_date?.slice(0, 10) === today).length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;

  const groups = groupByDate(tasks);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-900">
            {isMasterAdmin ? "Сервизни задачи" : `Здравей, ${userName.split(" ")[0]} 👋`}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMasterAdmin ? "Всички активни задачи за обслужване" : "Твоите задачи за обслужване"}
          </p>
        </div>
        <button onClick={fetchTasks} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-sky-600">{todayCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">За днес</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">В процес</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-300" />
          <p className="font-semibold text-sm">Нямаш активни задачи</p>
          <p className="text-xs mt-1">Всичко е изпълнено!</p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                group.label === "Днес" ? "bg-sky-100 text-sky-700" :
                group.label === "Утре" ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-500"
              }`}>{group.label} · {group.items.length}</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {group.items.map(task => {
              const isExp = expanded.has(task.id);
              const nextAction = NEXT_STATUS_LABEL[task.status];
              return (
                <div key={task.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {EVENT_ICON[task.event_code ?? ""] ?? <CalendarClock className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                            <p className="text-sm font-bold text-slate-800 leading-tight">{task.title}</p>
                          </div>
                          <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[task.status]}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => toggleExpand(task.id)} className="text-slate-300 hover:text-slate-600 shrink-0 mt-0.5">
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExp ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {/* Customer info always visible */}
                    <div className="mt-2.5 grid grid-cols-1 gap-1">
                      {task.customer_name && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />{task.customer_name}
                        </div>
                      )}
                      {task.customer_address && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(task.customer_address)}`}
                            target="_blank" rel="noreferrer"
                            className="text-sky-600 underline underline-offset-2 truncate">
                            {task.customer_address}
                          </a>
                        </div>
                      )}
                      {task.customer_phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <a href={`tel:${task.customer_phone}`} className="text-sky-600 font-semibold">{task.customer_phone}</a>
                        </div>
                      )}
                    </div>

                    {/* Expandable notes */}
                    {isExp && task.notes && (
                      <div className="mt-2.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 whitespace-pre-wrap">
                        {task.notes}
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  {nextAction && (
                    <div className="border-t border-slate-100 px-3.5 py-2.5">
                      <button
                        onClick={() => advanceStatus(task)}
                        disabled={updatingId === task.id}
                        className={`w-full text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                          task.status === "planned"
                            ? "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        } disabled:opacity-50`}
                      >
                        {updatingId === task.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : task.status === "in_progress" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {nextAction}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
