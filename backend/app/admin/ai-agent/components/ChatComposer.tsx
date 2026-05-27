"use client";

import { useRef } from "react";
import { Loader2, Send, Square } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  sending: boolean;
  aiEnabled: boolean;
  placeholder?: string;
};

export function ChatComposer({ value, onChange, onSend, onAbort, sending, aiEnabled, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const disabled = !aiEnabled || sending;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  }

  return (
    <div className="shrink-0 px-3 pt-2 pb-3 pb-safe border-t border-slate-100 bg-white">
      {!aiEnabled && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 font-medium">
          AI е временно изключен. Свържете се с администратора.
        </p>
      )}
      <div className={`flex gap-2 items-end bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200 transition ${aiEnabled ? "focus-within:border-brand-blue-400 focus-within:ring-2 focus-within:ring-brand-blue-200" : "opacity-60"}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Задайте въпрос за бизнеса, продажби, наличности, доставчици..."}
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0 min-h-[44px] max-h-[160px] resize-none leading-relaxed"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
        />
        {sending && onAbort ? (
          <button
            type="button"
            onClick={onAbort}
            className="min-h-11 min-w-11 rounded-xl flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors shrink-0 mb-0.5"
            title="Спри"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="min-h-11 min-w-11 rounded-xl flex items-center justify-center bg-brand-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-blue-700 transition-colors shrink-0 mb-0.5"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2} />}
          </button>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5 px-1">Enter за изпращане · Shift+Enter за нов ред</p>
    </div>
  );
}
