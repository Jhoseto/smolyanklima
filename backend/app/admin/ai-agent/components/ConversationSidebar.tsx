"use client";

import { Loader2, MessageSquarePlus, Trash2, ChevronRight } from "lucide-react";
import { ADMIN_MODAL_BACKDROP, ADMIN_MODAL_PANEL, AdminModalDragHandle } from "../../ui";
import { AgentSearchPanel } from "./AgentSearchPanel";
import { QueryTemplatesPanel } from "./QueryTemplatesPanel";

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  conversations: ConversationSummary[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onBulkDelete: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  showOnMobile: boolean;
  onUseTemplate?: (prompt: string) => void;
  draftPrompt?: string;
};

export function ConversationSidebar({
  conversations,
  selectedId,
  loading,
  onSelect,
  onNew,
  onDelete,
  onBulkDelete,
  mobileOpen,
  onMobileClose,
  showOnMobile,
  onUseTemplate,
  draftPrompt,
}: Props) {
  return (
    <>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/40" onClick={onMobileClose} />
      )}

      <div
        className={`${
          showOnMobile ? "flex" : "hidden md:flex"
        } flex-col w-full md:w-72 lg:w-80 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${
          mobileOpen ? "md:flex fixed inset-y-0 left-0 z-50 w-[min(100%,20rem)] rounded-none md:relative md:rounded-xl md:z-auto" : ""
        }`}
      >
        <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-b border-slate-100">
          <button
            type="button"
            onClick={onNew}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-brand-blue-500 text-white hover:bg-brand-blue-700 transition-colors min-h-[44px]"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Нов разговор
          </button>
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden min-h-11 min-w-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        </div>

        <AgentSearchPanel
          onSelectConversation={(id) => {
            onSelect(id);
            onMobileClose();
          }}
        />

        {onUseTemplate && <QueryTemplatesPanel onUseTemplate={onUseTemplate} draftPrompt={draftPrompt} />}

        {conversations.length > 0 && (
          <div className="shrink-0 px-3 py-2 border-b border-slate-100">
            <button
              type="button"
              onClick={onBulkDelete}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Изтрий всички разговори
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10 px-4">Няма запазени разговори</p>
          ) : (
            conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                selected={selectedId === c.id}
                onSelect={() => {
                  onSelect(c.id);
                  onMobileClose();
                }}
                onDelete={() => onDelete(c.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
  onDelete,
}: {
  conversation: ConversationSummary;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-stretch border-b border-slate-50 hover:bg-slate-50 transition-colors ${
        selected ? "bg-brand-blue-50 border-l-2 border-l-brand-blue-500" : ""
      }`}
    >
      <button type="button" onClick={onSelect} className="flex-1 text-left px-3 py-3 min-w-0">
        <p className="text-xs font-bold text-slate-900 truncate">{conversation.title}</p>
        <p className="text-[10px] text-slate-400 mt-0.5" suppressHydrationWarning>
          {timeAgo(conversation.updated_at)}
        </p>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="shrink-0 px-2.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        title="Изтрий разговор"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function DeleteConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  deleting,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className={ADMIN_MODAL_BACKDROP} onClick={onCancel}>
      <div className={`${ADMIN_MODAL_PANEL} max-w-sm`} onClick={(e) => e.stopPropagation()}>
        <AdminModalDragHandle />
        <div className="px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Отказ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Изтриване…" : (confirmLabel ?? "Изтрий")}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "сега";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} д`;
}
