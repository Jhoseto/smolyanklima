"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

export type AgentSearchHit = {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: "user" | "assistant";
  snippet: string;
  createdAt: string;
};

type Props = {
  onSelectConversation: (id: string) => void;
  onClear?: () => void;
};

export function AgentSearchPanel({ onSelectConversation, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AgentSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-agent/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) return;
      const json = await res.json();
      setHits(json.data ?? []);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => void runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, active, runSearch]);

  const clear = () => {
    setQuery("");
    setHits([]);
    setActive(false);
    onClear?.();
  };

  return (
    <div className="shrink-0 px-3 py-2 border-b border-slate-100 space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(true);
          }}
          onFocus={() => setActive(true)}
          placeholder="Търсене в разговори…"
          className="w-full pl-8 pr-8 py-2 rounded-lg text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-blue-300 outline-none"
        />
        {(query || active) && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {active && query.trim().length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-white">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
            </div>
          ) : hits.length === 0 ? (
            <p className="text-[10px] text-slate-400 text-center py-3 px-2">Няма резултати</p>
          ) : (
            hits.map((hit) => (
              <button
                key={`${hit.conversationId}-${hit.messageId || "title"}`}
                type="button"
                onClick={() => {
                  onSelectConversation(hit.conversationId);
                  clear();
                }}
                className="w-full text-left px-2.5 py-2 border-b border-slate-50 last:border-0 hover:bg-brand-blue-50 transition-colors"
              >
                <p className="text-[11px] font-bold text-slate-800 truncate">{hit.conversationTitle}</p>
                <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{hit.snippet}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
