"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle, Send, X, CheckCircle2, Clock, Loader2, User,
  RefreshCw, Phone, Mail, AlertCircle, Circle, Users,
  CheckCheck, Archive, Wifi, WifiOff, Info, StickyNote,
  ChevronRight, Headphones, Globe, Zap, ExternalLink,
} from "lucide-react";
import { SectionTitle } from "../ui";

type ProductCardData = {
  id: string; name: string; slug: string;
  image_url?: string | null; price_from?: number | null; brand_name?: string | null;
};

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatStatus = "waiting" | "active" | "closed";

type LiveChat = {
  id: string;
  visitor_name: string;
  visitor_email?: string | null;
  visitor_phone?: string | null;
  visitor_page_url?: string | null;
  status: ChatStatus;
  created_at: string;
  last_message_at?: string | null;
  admin_notes?: string | null;
};

type ChatMsg = {
  id: string;
  sender_role: "user" | "admin" | "system";
  content: string;
  created_at: string;
  metadata?: { type?: string; product?: ProductCardData } | null;
};

type ChatDetail = {
  chat: LiveChat & { ai_context?: Array<{ role: string; content: string }> | null; closed_at?: string | null; csat_rating?: number | null };
  messages: ChatMsg[];
};

type CannedResponse = { id: string; shortcut: string; content: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function playAdminSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
  } catch { /* ignore */ }
}

function requestBrowserNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon-192.png" });
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then(p => {
      if (p === "granted") new Notification(title, { body, icon: "/icon-192.png" });
    });
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminChatPage() {
  return <AdminChatClient />;
}

function AdminChatClient() {
  const [chats, setChats] = useState<LiveChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [msgConnected, setMsgConnected] = useState(false);
  const [filter, setFilter] = useState<"" | ChatStatus>("");
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [userTyping, setUserTyping] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [showCanned, setShowCanned] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inboxAbortRef = useRef<AbortController | null>(null);
  const msgAbortRef = useRef<AbortController | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const prevChatsCountRef = useRef<number>(0);

  // ── Request notification permission on mount ──────────────────────────────

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── Fetch canned responses ────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/admin/canned-responses")
      .then(r => r.ok ? r.json() : [])
      .then(setCannedResponses)
      .catch(() => {});
  }, []);

  // ── Fetch inbox ───────────────────────────────────────────────────────────

  const fetchChats = useCallback(async (notifyNew = false) => {
    const qs = filter ? `?status=${filter}` : "";
    try {
      const res = await fetch(`/api/admin/chat${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      const list: LiveChat[] = data.data ?? [];
      const waitingCount = list.filter(c => c.status === "waiting").length;
      if (notifyNew && waitingCount > prevChatsCountRef.current) {
        const newest = list.find(c => c.status === "waiting");
        playAdminSound();
        requestBrowserNotification("Нов чат запитване", `${newest?.visitor_name ?? "Посетител"} изчаква консултант`);
      }
      prevChatsCountRef.current = waitingCount;
      setChats(list);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchChats();
  }, [fetchChats]);

  // ── SSE: inbox changes ────────────────────────────────────────────────────

  useEffect(() => {
    let aborted = false;
    const ctrl = new AbortController();
    inboxAbortRef.current?.abort();
    inboxAbortRef.current = ctrl;

    (async () => {
      try {
        const res = await fetch("/api/admin/chat/stream", { signal: ctrl.signal });
        if (!res.ok || !res.body) return;
        setLiveConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            if (part.includes("event: changed")) fetchChats(true);
          }
        }
      } catch { /* aborted */ } finally {
        if (!aborted) setLiveConnected(false);
      }
    })();

    return () => { aborted = true; ctrl.abort(); setLiveConnected(false); };
  }, [fetchChats]);

  // ── Load detail ───────────────────────────────────────────────────────────

  const loadDetail = useCallback(async (chatId: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/chat/${chatId}`);
      if (!res.ok) return;
      const data: ChatDetail = await res.json();
      setDetail(data);
      setNotesValue(data.chat.admin_notes ?? "");
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // ── SSE: messages for selected chat ──────────────────────────────────────

  useEffect(() => {
    if (!selectedId) return;
    let aborted = false;
    const ctrl = new AbortController();
    msgAbortRef.current?.abort();
    msgAbortRef.current = ctrl;

    (async () => {
      try {
        const res = await fetch(`/api/admin/chat/${selectedId}/stream`, { signal: ctrl.signal });
        if (!res.ok || !res.body) return;
        setMsgConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const eventLine = part.match(/^event: (.+)/m);
            const dataLine = part.match(/^data: (.+)/m);
            if (!eventLine || !dataLine) continue;
            const eventType = eventLine[1].trim();
            const payload = JSON.parse(dataLine[1]);

            if (eventType === "messages" && payload.messages?.length > 0) {
              const hasUserMsg = payload.messages.some((m: ChatMsg) => m.sender_role === "user");
              if (hasUserMsg) playAdminSound();
              setDetail((prev) => {
                if (!prev) return prev;
                const existingIds = new Set(prev.messages.map((m) => m.id));
                const fresh: ChatMsg[] = payload.messages.filter((m: ChatMsg) => !existingIds.has(m.id));
                if (fresh.length === 0) return prev;
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
                return { ...prev, messages: [...prev.messages, ...fresh] };
              });
              setChats((prev) => prev.map((c) =>
                c.id === selectedId ? { ...c, last_message_at: payload.messages[payload.messages.length - 1].created_at } : c
              ));
            }
            if (eventType === "closed") {
              setDetail((prev) => prev ? { ...prev, chat: { ...prev.chat, status: "closed" } } : prev);
              setChats((prev) => prev.map((c) => c.id === selectedId ? { ...c, status: "closed" } : c));
            }
            if (eventType === "typing") setUserTyping(payload.typing);
          }
        }
      } catch { /* ignore */ } finally {
        if (!aborted) setMsgConnected(false);
      }
    })();

    return () => { aborted = true; ctrl.abort(); setMsgConnected(false); setUserTyping(false); };
  }, [selectedId]);

  // Scroll on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages?.length]);

  // ── Admin typing (throttled) ──────────────────────────────────────────────

  const sendAdminTyping = useCallback(() => {
    if (!selectedId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 3_000) return;
    lastTypingSentRef.current = now;
    fetch(`/api/admin/chat/${selectedId}/typing`, { method: "POST" }).catch(() => {});
  }, [selectedId]);

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = useCallback(async (overrideContent?: string) => {
    const content = (overrideContent ?? inputValue).trim();
    if (!content || !selectedId || sending) return;
    if (!overrideContent) setInputValue("");
    setSending(true);
    setShowCanned(false);

    try {
      await fetch(`/api/admin/chat/${selectedId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setChats((prev) => prev.map((c) => c.id === selectedId && c.status === "waiting" ? { ...c, status: "active" } : c));
      setDetail((prev) => prev && prev.chat.status === "waiting" ? { ...prev, chat: { ...prev.chat, status: "active" } } : prev);
    } catch { /* SSE will deliver the message */ } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [inputValue, selectedId, sending]);

  // ── Change status ─────────────────────────────────────────────────────────

  const handleStatus = useCallback(async (status: ChatStatus) => {
    if (!selectedId) return;
    try {
      await fetch(`/api/admin/chat/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setDetail((prev) => prev ? { ...prev, chat: { ...prev.chat, status } } : prev);
      setChats((prev) => prev.map((c) => c.id === selectedId ? { ...c, status } : c));
    } catch { /* ignore */ }
  }, [selectedId]);

  // ── Save notes ────────────────────────────────────────────────────────────

  const handleSaveNotes = useCallback(async () => {
    if (!selectedId) return;
    setSavingNotes(true);
    try {
      await fetch(`/api/admin/chat/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: notesValue }),
      });
      setDetail((prev) => prev ? { ...prev, chat: { ...prev.chat, admin_notes: notesValue } } : prev);
    } catch { /* ignore */ } finally {
      setSavingNotes(false);
    }
  }, [selectedId, notesValue]);

  const waitingCount = chats.filter((c) => c.status === "waiting").length;
  const handleSelectChat = (id: string) => { setSelectedId(id); setMobilePane("chat"); };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* Title row */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <SectionTitle title="Чат на живо" hint="Разговори с посетителите в реално време. Нови съобщения пристигат без опресняване." />
          {waitingCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-black">
              {waitingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-xs font-medium ${liveConnected ? "text-emerald-600" : "text-slate-400"}`}>
            {liveConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {liveConnected ? "На живо" : "Преповторно..."}
          </div>
          <button onClick={() => fetchChats()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Обнови
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">

        {/* ── Inbox ──────────────────────────────────────────────────────── */}
        <div className={`${selectedId && mobilePane === "chat" ? "hidden md:flex" : "flex"} flex-col w-full md:w-72 lg:w-80 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`}>
          <div className="flex items-center gap-1 px-3 pt-3 pb-2 shrink-0 border-b border-slate-100">
            {(["", "waiting", "active", "closed"] as const).map((s) => {
              const labels: Record<string, string> = { "": "Всички", waiting: "Изчакват", active: "Активни", closed: "Затворени" };
              return (
                <button key={s} onClick={() => setFilter(s)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-colors ${filter === s ? "bg-sky-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                  {labels[s]}
                  {s === "waiting" && waitingCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black">{waitingCount}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center"><Users className="w-6 h-6 text-slate-300" /></div>
                <p className="text-sm font-semibold text-slate-400">Няма чат сесии</p>
                <p className="text-xs text-slate-400">Посетителите ще се появят тук</p>
              </div>
            ) : (
              chats.map((chat) => (
                <ChatRow key={chat.id} chat={chat} selected={selectedId === chat.id} onClick={() => handleSelectChat(chat.id)} />
              ))
            )}
          </div>
        </div>

        {/* ── Chat Window ────────────────────────────────────────────────── */}
        <div className={`${selectedId && mobilePane === "chat" ? "flex" : "hidden md:flex"} flex-1 flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0`}>
          {!selectedId ? (
            <EmptyState />
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : detail ? (
            <>
              {/* Chat header */}
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <button className="md:hidden w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
                    onClick={() => setMobilePane("list")}>
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate leading-none">{detail.chat.visitor_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={detail.chat.status} />
                      {detail.chat.csat_rating && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                          {"★".repeat(detail.chat.csat_rating)} CSAT
                        </span>
                      )}
                      <div className={`flex items-center gap-1 text-[10px] font-medium ${msgConnected ? "text-emerald-500" : "text-slate-400"}`}>
                        {msgConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {detail.chat.status !== "closed" && (
                    <>
                      {detail.chat.status === "waiting" && (
                        <ActionButton onClick={() => handleStatus("active")} color="sky" icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Прийми" />
                      )}
                      <ActionButton onClick={() => handleStatus("closed")} color="red" icon={<X className="w-3.5 h-3.5" />} label="Затвори" />
                    </>
                  )}
                  {detail.chat.visitor_phone && (
                    <a href={`tel:${detail.chat.visitor_phone}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors">
                      <Phone className="w-3.5 h-3.5" /> Обади се
                    </a>
                  )}
                </div>
              </div>

              {/* Visitor info strip */}
              <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
                {detail.chat.visitor_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{detail.chat.visitor_email}</span>}
                {detail.chat.visitor_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{detail.chat.visitor_phone}</span>}
                {detail.chat.visitor_page_url && (
                  <a href={detail.chat.visitor_page_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sky-600 hover:underline truncate max-w-[200px]">
                    <Globe className="w-3 h-3 shrink-0" />
                    {detail.chat.visitor_page_url.replace(/^https?:\/\/[^/]+/, "")}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                )}
                <span className="flex items-center gap-1 text-slate-400 ml-auto">
                  <Clock className="w-3 h-3" />{formatTime(detail.chat.created_at)}
                </span>
              </div>

              {/* AI context banner */}
              {detail.chat.ai_context && detail.chat.ai_context.length > 0 && (
                <div className="shrink-0 mx-3 mt-2 px-3 py-2 bg-violet-50 border border-violet-100 rounded-xl">
                  <p className="text-[11px] font-bold text-violet-700 flex items-center gap-1 mb-0.5">
                    <Info className="w-3 h-3" /> AI контекст ({detail.chat.ai_context.length} съобщения)
                  </p>
                  <p className="text-[11px] text-violet-600 line-clamp-2">{detail.chat.ai_context.slice(-1)[0]?.content ?? "—"}</p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1 bg-gradient-to-b from-slate-50/50 to-white">
                {detail.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <MessageCircle className="w-8 h-8 text-slate-200" />
                    <p className="text-xs text-slate-400">Няма съобщения все още</p>
                  </div>
                )}
                {detail.messages.map((msg, i) => {
                  const prev = detail.messages[i - 1];
                  const grouped = prev && prev.sender_role === msg.sender_role &&
                    new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 3 * 60 * 1000;
                  return <AdminChatBubble key={msg.id} msg={msg} grouped={grouped} />;
                })}
                {/* User typing indicator */}
                {userTyping && (
                  <div className="flex gap-2 items-end mt-1">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                {detail.chat.status === "closed" && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
                    <Archive className="w-3.5 h-3.5" /> Чатът е затворен
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Notes */}
              <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 flex items-start gap-2">
                <StickyNote className="w-3.5 h-3.5 text-slate-400 mt-2 shrink-0" />
                <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Вътрешни бележки (само за администратора)..."
                  className="flex-1 text-xs text-slate-700 bg-transparent resize-none focus:outline-none placeholder:text-slate-400 leading-relaxed min-h-[36px] max-h-[80px]"
                  rows={2} />
                <button onClick={handleSaveNotes} disabled={savingNotes}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition-colors disabled:opacity-50">
                  {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : "Запази"}
                </button>
              </div>

              {/* Canned responses */}
              {detail.chat.status !== "closed" && showCanned && cannedResponses.length > 0 && (
                <div className="shrink-0 px-3 py-2 bg-white border-t border-slate-100 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {cannedResponses.map((cr) => (
                    <button key={cr.id} onClick={() => handleSend(cr.content)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 transition-colors max-w-[250px] truncate"
                      title={cr.content}>
                      <Zap className="w-3 h-3 shrink-0" />{cr.shortcut}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              {detail.chat.status !== "closed" && (
                <div className="shrink-0 px-3 pt-2 pb-3 border-t border-slate-100 bg-white">
                  <div className="flex gap-2 items-center bg-slate-50 rounded-2xl px-3 py-1 border border-slate-200 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-200 transition">
                    {cannedResponses.length > 0 && (
                      <button onClick={() => setShowCanned(v => !v)} title="Готови отговори"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${showCanned ? "text-sky-600 bg-sky-100" : "text-slate-400 hover:text-sky-600 hover:bg-sky-50"}`}>
                        <Zap className="w-4 h-4" />
                      </button>
                    )}
                    <input ref={inputRef} type="text" value={inputValue}
                      onChange={(e) => { setInputValue(e.target.value); sendAdminTyping(); }}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      placeholder="Напишете отговор..."
                      className="flex-1 bg-transparent text-sm py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0"
                      disabled={sending} />
                    <button onClick={() => handleSend()} disabled={!inputValue.trim() || sending}
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-700 transition-colors shrink-0">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2} />}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-400">Грешка при зареждане</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChatRow({ chat, selected, onClick }: { chat: LiveChat; selected: boolean; onClick: () => void }) {
  const time = chat.last_message_at ?? chat.created_at;
  return (
    <button onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selected ? "bg-sky-50 border-l-2 border-l-sky-500" : ""}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${selected ? "bg-sky-100" : "bg-slate-100"}`}>
        <User className={`w-4 h-4 ${selected ? "text-sky-600" : "text-slate-500"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-slate-900 truncate leading-none">{chat.visitor_name}</span>
          <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(time)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <StatusDot status={chat.status} />
          <span className="text-[10px] text-slate-500 truncate">
            {chat.status === "waiting" ? "Изчаква консултант..." : chat.status === "active" ? "Активен разговор" : "Приключен"}
          </span>
        </div>
      </div>
    </button>
  );
}

function AdminChatBubble({ msg, grouped }: { msg: ChatMsg & { metadata?: { type?: string; product?: ProductCardData } | null }; grouped: boolean }) {
  if (msg.sender_role === "system") {
    const isSep = msg.content.startsWith("—");
    if (isSep) return (
      <div className="flex items-center gap-2 justify-center py-1 my-1">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap px-1">{msg.content}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
    );
    return (
      <div className="mx-auto max-w-[90%] bg-sky-50 border border-sky-100 rounded-2xl px-4 py-2.5 text-xs text-sky-700 text-center my-1.5">{msg.content}</div>
    );
  }

  // Product card
  if (msg.metadata?.type === "product_card" && msg.metadata.product) {
    const p = msg.metadata.product;
    const isAdmin = msg.sender_role === "admin";
    return (
      <div className={`flex gap-2 ${isAdmin ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
        {!isAdmin && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shrink-0 self-end mb-1"><User className="w-3.5 h-3.5 text-white" /></div>}
        <a href={`/product/${p.slug}`} target="_blank" rel="noopener noreferrer"
          className="max-w-[75%] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-sky-200 transition-all">
          {p.image_url && <div className="w-full h-24 bg-slate-50"><img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-2" /></div>}
          <div className="px-3 py-2">
            {p.brand_name && <p className="text-[10px] font-semibold text-sky-600 uppercase">{p.brand_name}</p>}
            <p className="text-xs font-bold text-slate-900">{p.name}</p>
            {p.price_from && <p className="text-xs font-bold text-orange-500 mt-0.5">{p.price_from.toLocaleString("bg-BG")} лв.</p>}
          </div>
        </a>
        {isAdmin && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center shrink-0 self-end mb-1"><Headphones className="w-3.5 h-3.5 text-white" /></div>}
      </div>
    );
  }

  const isAdmin = msg.sender_role === "admin";
  const time = new Date(msg.created_at).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex gap-2 ${isAdmin ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
      {!isAdmin && (
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shrink-0 self-end mb-1 ${grouped ? "opacity-0" : ""}`}>
          <User className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[75%] flex flex-col gap-0.5 ${isAdmin ? "items-end" : "items-start"}`}>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap shadow-sm ${
          isAdmin ? "bg-gradient-to-br from-sky-500 to-sky-700 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
        }`}>{msg.content}</div>
        {!grouped && (
          <div className={`flex items-center gap-1 text-[10px] text-slate-400 px-1 ${isAdmin ? "flex-row-reverse" : ""}`}>
            <span>{time}</span>
            {isAdmin && <CheckCheck className="w-3 h-3 text-sky-400" />}
          </div>
        )}
      </div>
      {isAdmin && (
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center shrink-0 self-end mb-1 ${grouped ? "opacity-0" : ""}`}>
          <Headphones className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ChatStatus }) {
  const cfg = { waiting: "bg-amber-100 border-amber-200 text-amber-800", active: "bg-emerald-100 border-emerald-200 text-emerald-800", closed: "bg-slate-100 border-slate-200 text-slate-600" }[status];
  const labels = { waiting: "Изчаква", active: "Активен", closed: "Затворен" };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg}`}>{labels[status]}</span>;
}

function StatusDot({ status }: { status: ChatStatus }) {
  const colors = { waiting: "text-amber-500", active: "text-emerald-500", closed: "text-slate-300" };
  return <Circle className={`w-2 h-2 fill-current ${colors[status]} shrink-0`} />;
}

function ActionButton({ onClick, color, icon, label }: { onClick: () => void; color: "sky" | "red"; icon: React.ReactNode; label: string }) {
  const cls = color === "sky" ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100" : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100";
  return (
    <button onClick={onClick} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${cls}`}>
      {icon}{label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-full bg-sky-50 border-2 border-sky-100 flex items-center justify-center">
        <MessageCircle className="w-7 h-7 text-sky-300" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-700 mb-1">Изберете разговор</p>
        <p className="text-xs text-slate-400 max-w-xs">Изберете чат от списъка вляво, за да отговорите на посетителя.</p>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "сега";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ч`;
  return `${Math.floor(h / 24)}д`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
