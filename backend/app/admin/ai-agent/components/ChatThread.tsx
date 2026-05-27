"use client";

import { useEffect, useRef } from "react";
import { Bot, Loader2, User, AlertCircle, RotateCcw, Copy, RefreshCw } from "lucide-react";
import type { AgentBlock } from "@/lib/ai/agent/types";
import { AgentMessageBlocks } from "./AgentMessageBlocks";
import { messageCopyText } from "@/lib/ai/agent/blocksText";

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: { text?: string; blocks?: AgentBlock[] };
  created_at: string;
};

type Props = {
  messages: ThreadMessage[];
  loading: boolean;
  sending: boolean;
  progressMessage?: string | null;
  streamPreview?: string | null;
  error: string | null;
  onRetry?: () => void;
  onRegenerate?: () => void;
};

export function ChatThread({
  messages,
  loading,
  sending,
  progressMessage,
  streamPreview,
  error,
  onRetry,
  onRegenerate,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending, progressMessage, streamPreview, error]);

  async function copyMessage(msg: ThreadMessage) {
    const text = messageCopyText(msg);
    if (text) await navigator.clipboard.writeText(text);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 bg-gradient-to-b from-slate-50/50 to-white">
      {messages.length === 0 && !sending && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-blue-100 to-violet-100 flex items-center justify-center">
            <Bot className="w-7 h-7 text-brand-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700">AI бизнес асистент</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Анализ на продажби, наличности, запитвания, доставчици и операции — с данни от системата.
            </p>
          </div>
        </div>
      )}

      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const isLastAssistant = msg.id === lastAssistantId;
        return (
          <div key={msg.id} className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
            {!isUser && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-blue-500 to-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[90%] md:max-w-[75%] ${isUser ? "order-first" : ""}`}>
              <div
                className={`rounded-2xl px-4 py-3 shadow-sm ${
                  isUser
                    ? "bg-gradient-to-br from-brand-blue-500 to-brand-blue-700 text-white rounded-br-md"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
                }`}
              >
                {isUser ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content.text}</p>
                ) : (
                  <AgentMessageBlocks blocks={msg.content.blocks ?? []} />
                )}
              </div>
              <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? "justify-end" : ""}`}>
                <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                <button
                  type="button"
                  onClick={() => void copyMessage(msg)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                  title="Копирай"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {!isUser && isLastAssistant && onRegenerate && !sending && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="text-slate-400 hover:text-brand-blue-600 p-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold"
                    title="Регенерирай"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {isUser && (
              <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        );
      })}

      {sending && (
        <div className="flex gap-2.5 items-start">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-blue-500 to-violet-600 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm max-w-[90%]">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Loader2 className="w-4 h-4 animate-spin text-brand-blue-500 shrink-0" />
              {progressMessage ?? "Анализирам…"}
            </div>
            {streamPreview && (
              <p className="text-xs text-slate-400 font-mono line-clamp-4 whitespace-pre-wrap">{streamPreview}</p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-md flex flex-col items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-center">
          <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Опитай отново
            </button>
          )}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
}
