"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronRight, Download, Menu, MessageSquarePlus } from "lucide-react";
import { SectionTitle } from "../ui";
import type { AgentBlock } from "@/lib/ai/agent/types";
import { ChatComposer } from "./components/ChatComposer";
import { ChatThread, type ThreadMessage } from "./components/ChatThread";
import {
  ConversationSidebar,
  DeleteConfirmModal,
  type ConversationSummary,
} from "./components/ConversationSidebar";
import { ScheduledReportsPanel } from "./components/ScheduledReportsPanel";
import type { QueryTemplate } from "./components/QueryTemplatesPanel";

const SUGGESTED_PROMPTS = [
  "Обобщение на продажбите за последния месец",
  "Кои продукти са с ниска наличност?",
  "Покажи отворените запитвания от клиенти",
  "Статус на синхронизация с доставчиците",
  "Анализ на активността в админ панела за последната седмица",
  "Какво има за днес в календара и кои задачи са просрочени?",
  "Колко нови запитвания има тази седмица?",
  "Кои монтажи чакат приключване?",
  "Отворени поръчки към доставчици",
  "Наличност по марки — обобщение с графика",
  "Продукти в статус „Поръчва се“",
  "Статус на изходящите имейли (outbox)",
  "Как се прави продажба в админ панела?",
  "Топ оценени продукти от клиенти",
  "Има ли активни live чатове на сайта?",
];

type StreamPayload = {
  conversationId?: string;
  blocks?: AgentBlock[];
  title?: string;
};

function AiAgentLoadingShell() {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4" aria-busy="true">
      <div className="flex items-center justify-between shrink-0 gap-2">
        <span className="text-slate-900 font-bold text-sm md:text-base leading-snug">СК Help Agent</span>
      </div>
      <div className="flex-1 min-h-[320px] rounded-xl border border-slate-200 bg-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Зареждане…</p>
      </div>
    </div>
  );
}

export default function AiAgentClient({
  aiEnabled,
  canBrowseConversations = true,
}: {
  aiEnabled: boolean;
  canBrowseConversations?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <AiAgentLoadingShell />;
  return (
    <AiAgentClientInner aiEnabled={aiEnabled} canBrowseConversations={canBrowseConversations} />
  );
}

function AiAgentClientInner({
  aiEnabled,
  canBrowseConversations,
}: {
  aiEnabled: boolean;
  canBrowseConversations: boolean;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [streamPreview, setStreamPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarMobile, setSidebarMobile] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);

  const lastUserMessageRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!canBrowseConversations) {
      setConversationsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/ai-agent/conversations");
      if (!res.ok) return;
      const json = await res.json();
      setConversations(json.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setConversationsLoading(false);
    }
  }, [canBrowseConversations]);

  useEffect(() => {
    if (canBrowseConversations) fetchConversations();
    else setConversationsLoading(false);
  }, [fetchConversations, canBrowseConversations]);

  useEffect(() => {
    if (!canBrowseConversations) return;
    void (async () => {
      try {
        const res = await fetch("/api/admin/ai-agent/templates");
        if (!res.ok) return;
        const json = await res.json();
        setTemplates(json.data ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, [reportsOpen, canBrowseConversations]);

  const loadMessages = useCallback(async (id: string) => {
    if (!canBrowseConversations) return;
    setMessagesLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai-agent/conversations/${id}`);
      if (!res.ok) throw new Error("Неуспешно зареждане");
      const json = await res.json();
      setMessages(
        (json.messages ?? []).filter((m: { role: string }) => m.role === "user" || m.role === "assistant"),
      );
    } catch {
      setError("Грешка при зареждане на разговора.");
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [canBrowseConversations]);

  useEffect(() => {
    if (!canBrowseConversations || !selectedId) {
      if (!selectedId) setMessages([]);
      return;
    }
    loadMessages(selectedId);
  }, [selectedId, loadMessages, canBrowseConversations]);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    setSelectedId(null);
    setMessages([]);
    setError(null);
    setInput("");
    setMobilePane("chat");
    setSidebarMobile(false);
  }, []);

  const parseSseStream = useCallback(
    async (
      body: ReadableStream<Uint8Array>,
      onDone: (payload: StreamPayload) => void,
    ) => {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const eventLine = part.match(/^event: (.+)/m);
          const dataLine = part.match(/^data: (.+)/m);
          if (!eventLine || !dataLine) continue;
          const event = eventLine[1].trim();
          const data = JSON.parse(dataLine[1]) as Record<string, unknown>;

          if (event === "progress") {
            setProgressMessage(String((data as { message?: string }).message ?? "Работя…"));
          } else if (event === "delta") {
            setStreamPreview((prev) => `${prev ?? ""}${String((data as { text?: string }).text ?? "")}`.slice(-400));
          } else if (event === "done") {
            onDone(data as StreamPayload);
          } else if (event === "error") {
            throw new Error(String((data as { message?: string }).message ?? "AI грешка."));
          }
        }
      }
    },
    [],
  );

  const runStreamChat = useCallback(
    async (payload: { conversationId?: string; message?: string; regenerate?: boolean }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSending(true);
      setProgressMessage("Анализирам…");
      setStreamPreview(null);
      setError(null);
      setMobilePane("chat");

      const isRegenerate = Boolean(payload.regenerate);
      let optimisticUser: ThreadMessage | null = null;

      if (!isRegenerate && payload.message) {
        optimisticUser = {
          id: `tmp-${Date.now()}`,
          role: "user",
          content: { text: payload.message },
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUser!]);
        setInput("");
      }

      if (isRegenerate) {
        setMessages((prev) => {
          const lastAsst = [...prev].reverse().findIndex((m) => m.role === "assistant");
          if (lastAsst < 0) return prev;
          const idx = prev.length - 1 - lastAsst;
          return prev.filter((_, i) => i !== idx);
        });
      }

      try {
        const res = await fetch("/api/admin/ai-agent/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json.error as string) || "Грешка при генериране на отговор.");
        }

        await parseSseStream(res.body, (result) => {
          const convId = result.conversationId as string;
          if (!selectedId) {
            setSelectedId(convId);
          }

          if (result.title && canBrowseConversations) {
            setConversations((prev) => {
              const exists = prev.some((c) => c.id === convId);
              const updated = exists
                ? prev.map((c) => (c.id === convId ? { ...c, title: result.title!, updated_at: new Date().toISOString() } : c))
                : [{ id: convId, title: result.title!, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev];
              return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            });
          } else if (canBrowseConversations) {
            setConversations((prev) =>
              prev
                .map((c) => (c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c))
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
            );
          }

          const assistantMsg: ThreadMessage = {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: { blocks: result.blocks ?? [] },
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        });

        if (canBrowseConversations && !selectedId) await fetchConversations();
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          setError("Заявката беше отменена.");
        } else {
          if (optimisticUser) {
            setMessages((prev) => prev.filter((m) => m.id !== optimisticUser!.id));
          }
          if (payload.message) setInput(payload.message);
          setError(e instanceof Error ? e.message : "Неочаквана грешка.");
        }
      } finally {
        setSending(false);
        setProgressMessage(null);
        setStreamPreview(null);
        abortRef.current = null;
      }
    },
    [canBrowseConversations, fetchConversations, parseSseStream, selectedId],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending || !aiEnabled) return;
      lastUserMessageRef.current = trimmed;
      await runStreamChat({ conversationId: selectedId ?? undefined, message: trimmed });
    },
    [aiEnabled, runStreamChat, selectedId, sending],
  );

  const handleRegenerate = useCallback(async () => {
    if (!selectedId || sending) return;
    await runStreamChat({ conversationId: selectedId, regenerate: true });
  }, [runStreamChat, selectedId, sending]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/ai-agent/conversations/${deleteTarget}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget));
      if (selectedId === deleteTarget) {
        setSelectedId(null);
        setMessages([]);
      }
    } catch {
      setError("Неуспешно изтриване.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, selectedId]);

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/ai-agent/conversations/bulk-delete", { method: "POST" });
      if (!res.ok) throw new Error("Bulk delete failed");
      setConversations([]);
      setSelectedId(null);
      setMessages([]);
      setBulkDeleteOpen(false);
    } catch {
      setError("Неуспешно изтриване на всички разговори.");
    } finally {
      setDeleting(false);
    }
  }, []);

  const handleExport = useCallback(() => {
    if (!selectedId) return;
    window.open(`/api/admin/ai-agent/conversations/${selectedId}/export`, "_blank");
  }, [selectedId]);

  const handleUseTemplate = useCallback((prompt: string) => {
    setInput(prompt);
    setMobilePane("chat");
    setSidebarMobile(false);
  }, []);

  const handleOpenConversation = useCallback((id: string) => {
    setSelectedId(id);
    setMobilePane("chat");
    setSidebarMobile(false);
  }, []);

  const showSuggestions = messages.length === 0 && !sending && !messagesLoading;
  const mobileChatActive = canBrowseConversations ? mobilePane === "chat" : true;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {canBrowseConversations && (
            <button
              type="button"
              onClick={() => setSidebarMobile(true)}
              className="md:hidden min-h-11 min-w-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <SectionTitle
            title="СК Help Agent"
            hint={
              canBrowseConversations
                ? "Бизнес асистент с достъп до данни от системата."
                : "Бизнес асистент с достъп до данни от системата. Нямате достъп до история на разговорите."
            }
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!canBrowseConversations && (
            <button
              type="button"
              onClick={handleNewChat}
              disabled={sending}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-brand-blue-200 text-brand-blue-700 bg-brand-blue-50 hover:bg-brand-blue-100 disabled:opacity-50"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Нов разговор</span>
            </button>
          )}
          {canBrowseConversations && (
            <button
              type="button"
              onClick={() => setReportsOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Отчети</span>
            </button>
          )}
          {canBrowseConversations && selectedId && (
            <button
              type="button"
              onClick={handleExport}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              Експорт
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {canBrowseConversations && (
          <ConversationSidebar
            conversations={conversations}
            selectedId={selectedId}
            loading={conversationsLoading}
            onSelect={(id) => {
              setSelectedId(id);
              setMobilePane("chat");
            }}
            onNew={handleNewChat}
            onDelete={setDeleteTarget}
            onBulkDelete={() => setBulkDeleteOpen(true)}
            mobileOpen={sidebarMobile}
            onMobileClose={() => setSidebarMobile(false)}
            showOnMobile={mobilePane === "list"}
            onUseTemplate={handleUseTemplate}
            draftPrompt={input}
          />
        )}

        <div
          className={`${
            mobileChatActive ? "flex" : "hidden md:flex"
          } flex-1 flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0`}
        >
          {canBrowseConversations && (selectedId || mobilePane === "chat") && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 md:hidden">
              <button
                type="button"
                onClick={() => setMobilePane("list")}
                className="min-h-10 min-w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <p className="text-xs font-bold text-slate-800 truncate flex-1">
                {selectedId
                  ? (conversations.find((c) => c.id === selectedId)?.title ?? "Разговор")
                  : "Нов разговор"}
              </p>
              {selectedId && (
                <button type="button" onClick={handleExport} className="min-h-10 min-w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <ChatThread
            messages={messages}
            loading={Boolean(selectedId) && messagesLoading}
            sending={sending}
            progressMessage={progressMessage}
            streamPreview={streamPreview}
            error={error}
            onRetry={() => {
              if (lastUserMessageRef.current) void sendMessage(lastUserMessageRef.current);
            }}
            onRegenerate={selectedId ? handleRegenerate : undefined}
          />

          {showSuggestions && (
            <div className="shrink-0 px-4 pb-2 max-h-36 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Бързи въпроси
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={!aiEnabled || sending}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-brand-blue-50 hover:border-brand-blue-200 hover:text-brand-blue-700 transition-colors disabled:opacity-50 text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => void sendMessage(input)}
            onAbort={handleAbort}
            sending={sending}
            aiEnabled={aiEnabled}
          />
        </div>
      </div>

      {canBrowseConversations && (
        <>
          <DeleteConfirmModal
            open={Boolean(deleteTarget)}
            title="Изтриване на разговор?"
            description="Действието е необратимо за този чат."
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => void handleDelete()}
            deleting={deleting}
          />

          <DeleteConfirmModal
            open={bulkDeleteOpen}
            title="Изтриване на всички разговори?"
            description="Ще бъдат soft-delete-нати всички ваши AI чатове."
            confirmLabel="Изтрий всички"
            onCancel={() => setBulkDeleteOpen(false)}
            onConfirm={() => void handleBulkDelete()}
            deleting={deleting}
          />

          <ScheduledReportsPanel
            open={reportsOpen}
            onClose={() => setReportsOpen(false)}
            templates={templates}
            onOpenConversation={handleOpenConversation}
          />
        </>
      )}
    </div>
  );
}
