"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkPlus, Loader2, Trash2, X } from "lucide-react";
import { ADMIN_MODAL_BACKDROP, ADMIN_MODAL_PANEL, AdminModalDragHandle } from "../../ui";

export type QueryTemplate = {
  id: string;
  title: string;
  prompt: string;
  description: string | null;
  sort_order: number;
};

type Props = {
  onUseTemplate: (prompt: string) => void;
  draftPrompt?: string;
};

export function QueryTemplatesPanel({ onUseTemplate, draftPrompt = "" }: Props) {
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-agent/templates");
      if (!res.ok) return;
      const json = await res.json();
      setTemplates(json.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const openSave = () => {
    setTitle("");
    setPrompt(draftPrompt.trim());
    setSaveOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !prompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-agent/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), prompt: prompt.trim() }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveOpen(false);
      await fetchTemplates();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/ai-agent/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      <div className="shrink-0 px-3 py-2 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Запазени шаблони</p>
          <button
            type="button"
            onClick={openSave}
            disabled={!draftPrompt.trim()}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-blue-600 hover:text-brand-blue-800 disabled:opacity-40"
          >
            <BookmarkPlus className="w-3 h-3" />
            Запази
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-[10px] text-slate-400">Няма шаблони. Запазете често използвани заявки.</p>
        ) : (
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {templates.map((t) => (
              <div key={t.id} className="group inline-flex items-center max-w-full">
                <button
                  type="button"
                  onClick={() => onUseTemplate(t.prompt)}
                  className="px-2 py-1 rounded-l-lg text-[10px] font-semibold bg-violet-50 border border-violet-100 text-violet-800 hover:bg-violet-100 truncate max-w-[140px]"
                  title={t.prompt}
                >
                  {t.title}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(t.id)}
                  className="px-1 py-1 rounded-r-lg bg-violet-50 border border-l-0 border-violet-100 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {saveOpen && (
        <div className={ADMIN_MODAL_BACKDROP} onClick={() => setSaveOpen(false)}>
          <div className={`${ADMIN_MODAL_PANEL} max-w-md`} onClick={(e) => e.stopPropagation()}>
            <AdminModalDragHandle />
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Запази шаблон</h3>
                <button type="button" onClick={() => setSaveOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Заглавие (напр. Месечни продажби)"
                className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200"
              />
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Текст на заявката…"
                className="w-full px-3 py-2 rounded-lg text-xs border border-slate-200 resize-none"
              />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button type="button" onClick={() => setSaveOpen(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200">
                Отказ
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !title.trim() || !prompt.trim()}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-brand-blue-500 text-white disabled:opacity-50"
              >
                {saving ? "Запазване…" : "Запази"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
