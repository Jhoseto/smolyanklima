"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { ADMIN_MODAL_BACKDROP, ADMIN_MODAL_PANEL, AdminModalDragHandle } from "../../ui";
import type { QueryTemplate } from "./QueryTemplatesPanel";

export type ScheduledReport = {
  id: string;
  template_id: string | null;
  title: string;
  prompt: string;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  hour_local: number;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
  last_conversation_id: string | null;
  last_status: string | null;
  last_error: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  templates: QueryTemplate[];
  onOpenConversation?: (id: string) => void;
};

const WEEKDAYS = [
  { value: 0, label: "Понеделник" },
  { value: 1, label: "Вторник" },
  { value: 2, label: "Сряда" },
  { value: 3, label: "Четвъртък" },
  { value: 4, label: "Петък" },
  { value: 5, label: "Събота" },
  { value: 6, label: "Неделя" },
];

function scheduleLabel(r: ScheduledReport): string {
  const hour = `${String(r.hour_local).padStart(2, "0")}:00`;
  if (r.frequency === "daily") return `Всеки ден в ${hour}`;
  if (r.frequency === "weekly") {
    const day = WEEKDAYS.find((d) => d.value === r.day_of_week)?.label ?? "Понеделник";
    return `${day} в ${hour}`;
  }
  return `${r.day_of_month ?? 1}-о число в ${hour}`;
}

export function ScheduledReportsPanel({ open, onClose, templates, onOpenConversation }: Props) {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hourLocal, setHourLocal] = useState(8);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-agent/reports");
      if (!res.ok) return;
      const json = await res.json();
      setReports(json.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void fetchReports();
  }, [open, fetchReports]);

  useEffect(() => {
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setTitle(t.title);
      setPrompt(t.prompt);
    }
  }, [templateId, templates]);

  const handleCreate = async () => {
    if (!title.trim() || !prompt.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        prompt: prompt.trim(),
        frequency,
        hourLocal,
      };
      if (templateId) body.templateId = templateId;
      if (frequency === "weekly") body.dayOfWeek = dayOfWeek;
      if (frequency === "monthly") body.dayOfMonth = dayOfMonth;

      const res = await fetch("/api/admin/ai-agent/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("create failed");
      setTitle("");
      setPrompt("");
      setTemplateId("");
      await fetchReports();
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/ai-agent/reports/${id}`, { method: "DELETE" });
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggle = async (r: ScheduledReport) => {
    const res = await fetch(`/api/admin/ai-agent/reports/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    if (res.ok) await fetchReports();
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      const res = await fetch(`/api/admin/ai-agent/reports/${id}`, { method: "POST" });
      const json = await res.json();
      await fetchReports();
      if (json.conversationId && onOpenConversation) {
        onOpenConversation(json.conversationId);
        onClose();
      }
    } catch {
      /* ignore */
    } finally {
      setRunningId(null);
    }
  };

  if (!open) return null;

  return (
    <div className={ADMIN_MODAL_BACKDROP}>
      <div className={`${ADMIN_MODAL_PANEL} max-w-lg max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <AdminModalDragHandle />
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-900">Планирани отчети</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-bold uppercase text-slate-400">Нов отчет</p>
            {templates.length > 0 && (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white"
              >
                <option value="">— Без шаблон —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Заглавие"
              className="w-full px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white"
            />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Какво да анализира AI Agent?"
              className="w-full px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as "daily" | "weekly" | "monthly")}
                className="px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white"
              >
                <option value="daily">Ежедневно</option>
                <option value="weekly">Седмично</option>
                <option value="monthly">Месечно</option>
              </select>
              <select
                value={hourLocal}
                onChange={(e) => setHourLocal(Number(e.target.value))}
                className="px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            {frequency === "weekly" && (
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white"
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
            {frequency === "monthly" && (
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg text-xs border border-slate-200 bg-white"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}-о число
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating || !title.trim() || !prompt.trim()}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-violet-600 text-white disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {creating ? "Добавяне…" : "Добави отчет"}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Няма планирани отчети</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="p-3 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{r.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{scheduleLabel(r)}</p>
                      {r.last_run_at && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          Последно: {new Date(r.last_run_at).toLocaleString("bg-BG")}
                          {r.last_status === "failed" && r.last_error ? ` — ${r.last_error}` : ""}
                        </p>
                      )}
                    </div>
                    <label className="flex items-center gap-1 shrink-0">
                      <input type="checkbox" checked={r.enabled} onChange={() => void handleToggle(r)} className="rounded" />
                      <span className="text-[10px] text-slate-500">Акт.</span>
                    </label>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => void handleRunNow(r.id)}
                      disabled={runningId === r.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-brand-blue-50 text-brand-blue-700 border border-brand-blue-100"
                    >
                      {runningId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      Стартирай
                    </button>
                    {r.last_conversation_id && onOpenConversation && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenConversation(r.last_conversation_id!);
                          onClose();
                        }}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-200 text-slate-600"
                      >
                        Последен
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(r.id)}
                      className="ml-auto px-2 py-1 rounded-lg text-[10px] font-bold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
