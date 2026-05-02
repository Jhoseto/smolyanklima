"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle, Send, X, CheckCircle2, Clock, Loader2,
  AlertCircle, Wifi, WifiOff, XCircle, Headphones, Bot, Star, ExternalLink,
} from "lucide-react";

type ChatMsg = {
  id: string;
  sender_role: "user" | "admin" | "system";
  content: string;
  created_at: string;
  metadata?: { type?: string; product?: ProductCardData } | null;
};
type ChatStatus = "waiting" | "active" | "closed";

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
  price_from?: number | null;
  brand_name?: string | null;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const SESSION_KEY = "smolyan-klima-live-chat-v1";
const TYPING_THROTTLE_MS = 3_000;

interface SessionBlob { chatId: string; sessionToken: string; visitorName: string }

function loadSession(): SessionBlob | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.chatId || !parsed?.sessionToken) return null;
    return parsed as SessionBlob;
  } catch { return null; }
}
function saveSession(s: SessionBlob) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
function apiHeaders(token: string) {
  return { "Content-Type": "application/json", "X-Chat-Session-Token": token };
}

/** Web Audio API notification sound — no external assets */
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* ignore — autoplay policy */ }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LiveChatWidgetProps {
  aiContext?: Array<{ role: "user" | "assistant"; content: string }>;
  onClose?: () => void;
  initialName?: string;
  /** Called when a product card is clicked — navigate without closing chat */
  onNavigate?: (slug: string) => void;
  /** Unread message count callback for parent (floating badge) */
  onUnreadChange?: (count: number) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LiveChatWidget({ aiContext, onClose, initialName, onNavigate, onUnreadChange }: LiveChatWidgetProps) {
  const [phase, setPhase] = useState<"form" | "chat">(() => loadSession() ? "chat" : "form");
  const [session, setSession] = useState<SessionBlob | null>(() => loadSession());
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("waiting");
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [formName, setFormName] = useState(initialName ?? "");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  // CSAT state
  const [csatPhase, setCsatPhase] = useState<"hidden" | "rating" | "done">("hidden");
  const [csatRating, setCsatRating] = useState(0);
  const [csatComment, setCsatComment] = useState("");
  const [csatHover, setCsatHover] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef<number>(0);
  const isVisibleRef = useRef(true); // track if widget area is in foreground

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, adminTyping]);

  // Track visibility for unread counting
  useEffect(() => {
    const onVisibility = () => { isVisibleRef.current = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Load existing chat on mount
  const lastMsgTsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch(`${BASE_URL}/api/chat/${session.chatId}`, { headers: apiHeaders(session.sessionToken) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { clearSession(); setPhase("form"); return; }
        const msgs: ChatMsg[] = data.messages ?? [];
        setMessages(msgs);
        setChatStatus(data.chat.status);
        // Track the last message timestamp so the SSE can start from the right point
        if (msgs.length > 0) {
          lastMsgTsRef.current = msgs[msgs.length - 1].created_at;
        }
      })
      .catch(() => { clearSession(); setPhase("form"); });
  }, [session]);

  // SSE subscription
  useEffect(() => {
    if (!session || phase !== "chat") return;

    let aborted = false;
    const controller = new AbortController();
    let unread = 0;

    (async () => {
      try {
        const afterParam = lastMsgTsRef.current
          ? `?after=${encodeURIComponent(lastMsgTsRef.current)}`
          : "";
        const res = await fetch(`${BASE_URL}/api/chat/${session.chatId}/stream${afterParam}`, {
          headers: { "X-Chat-Session-Token": session.sessionToken },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        setConnected(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const eventLine = part.match(/^event: (.+)/m);
            const dataLine = part.match(/^data: (.+)/m);
            if (!eventLine || !dataLine) continue;
            const eventType = eventLine[1].trim();
            const payload = JSON.parse(dataLine[1]);

            if (eventType === "messages" && payload.messages?.length > 0) {
              const adminMsgs = (payload.messages as ChatMsg[]).filter(m => m.sender_role === "admin");
              if (adminMsgs.length > 0 && !isVisibleRef.current) {
                unread += adminMsgs.length;
                onUnreadChange?.(unread);
                playNotificationSound();
              } else if (adminMsgs.length > 0) {
                playNotificationSound();
              }
              setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const fresh = payload.messages.filter((m: ChatMsg) => !existingIds.has(m.id));
                return fresh.length > 0 ? [...prev, ...fresh] : prev;
              });
            }
            if (eventType === "status") {
              setChatStatus(payload.status);
              if (payload.status === "closed") {
                setCsatPhase((prev) => (prev === "hidden" ? "rating" : prev));
              }
            }
            if (eventType === "typing") setAdminTyping(payload.typing);
          }
        }
      } catch { /* disconnected */ } finally {
        setConnected(false);
      }
    })();

    // Reset unread when user focuses
    const onFocus = () => {
      if (unread > 0) { unread = 0; onUnreadChange?.(0); }
    };
    window.addEventListener("focus", onFocus);

    return () => {
      aborted = true;
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [session, phase, onUnreadChange]);

  // Typing — throttled send to API
  const sendTyping = useCallback(() => {
    if (!session) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    fetch(`${BASE_URL}/api/chat/${session.chatId}/typing`, {
      method: "POST",
      headers: apiHeaders(session.sessionToken),
    }).catch(() => {});
  }, [session]);

  // Start new chat
  const handleStart = useCallback(async () => {
    if (!formName.trim()) { setFormError("Моля, въведете вашето ime."); return; }
    const emailVal = formEmail.trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setFormError("Моля, въведете валиден имейл адрес.");
      return;
    }
    setFormError(null);
    setStarting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_name: formName.trim(),
          visitor_email: emailVal || undefined,
          visitor_phone: formPhone.trim() || undefined,
          ai_context: aiContext?.slice(-12),
          visitor_page_url: window.location.href,
        }),
      });
      if (!res.ok) throw new Error("start_failed");
      const data = await res.json();
      const blob: SessionBlob = { chatId: data.chatId, sessionToken: data.sessionToken, visitorName: data.visitorName };
      saveSession(blob);
      setSession(blob);
      setChatStatus((data.status as ChatStatus) ?? "waiting");
      setMessages([]);
      setPhase("chat");
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch {
      setFormError("Неуспешно свързване. Моля, опитайте отново.");
    } finally {
      setStarting(false);
    }
  }, [formName, formEmail, formPhone, aiContext]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !session || sending) return;
    const content = inputValue.trim();
    setInputValue("");
    setSending(true);
    try {
      await fetch(`${BASE_URL}/api/chat/${session.chatId}`, {
        method: "POST",
        headers: apiHeaders(session.sessionToken),
        body: JSON.stringify({ content }),
      });
    } catch { /* SSE will reflect */ } finally {
      setSending(false);
    }
  }, [inputValue, session, sending]);

  // Submit CSAT
  const handleCsatSubmit = useCallback(async () => {
    if (!session || csatRating === 0) return;
    await fetch(`${BASE_URL}/api/chat/${session.chatId}`, {
      method: "PATCH",
      headers: apiHeaders(session.sessionToken),
      body: JSON.stringify({ csat_rating: csatRating, csat_comment: csatComment.trim() || undefined }),
    }).catch(() => {});
    setCsatPhase("done");
  }, [session, csatRating, csatComment]);

  // Minimize / hide the widget — session stays alive in localStorage
  const handleMinimize = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Explicitly end the chat session
  const handleEndChat = useCallback(async () => {
    if (session && chatStatus !== "closed") {
      await fetch(`${BASE_URL}/api/chat/${session.chatId}`, {
        method: "PATCH",
        headers: apiHeaders(session.sessionToken),
        body: JSON.stringify({ status: "closed" }),
      }).catch(() => {});
    }
    clearSession();
    setSession(null);
    setMessages([]);
    setChatStatus("waiting");
    setCsatPhase("hidden");
    setPhase("form");
    onClose?.();
  }, [session, chatStatus, onClose]);

  // ── Render: Start Form ──────────────────────────────────────────────────────
  if (phase === "form") {
    return (
      <div className="flex flex-col h-full bg-white">
        <SharedHeader chatStatus="waiting" connected={false} onClose={onClose} activeTab="live" />
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Свържете се директно с нашите специалисти. Обикновено отговаряме до <strong>2 минути</strong>.
          </p>
          <div className="flex flex-col gap-3">
            <Field label="Вашето им*">
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="Иван Иванов" onKeyDown={(e) => e.key === "Enter" && handleStart()}
                className="chat-input" />
            </Field>
            <Field label="Телефон" hint="по желание">
              <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+359 888 ..." className="chat-input" />
            </Field>
            <Field label="Имейл" hint="по желание">
              <input type="email" value={formEmail}
                onChange={(e) => { setFormEmail(e.target.value); setFormError(null); }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) setFormError("Моля, въведете валиден имейл адрес.");
                }}
                placeholder="ivan@example.com" className="chat-input" />
            </Field>
          </div>
          {formError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formError}
            </div>
          )}
          <button onClick={handleStart} disabled={starting || !formName.trim()}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#FF4D00] to-[#e63900] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.98]">
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {starting ? "Свързване..." : "Започни чат"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Chat Window ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white">
      <SharedHeader chatStatus={chatStatus} connected={connected} onClose={handleMinimize} activeTab="live" onSwitchToAI={onClose} />

      {/* CSAT overlay */}
      {csatPhase === "rating" && (
        <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-5 px-6 py-8">
          <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center">
            <Star className="w-6 h-6 text-amber-400" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-slate-900">Как беше обслужването?</p>
            <p className="text-xs text-slate-500 mt-1">Вашата оценка е важна за нас</p>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setCsatRating(n)}
                onMouseEnter={() => setCsatHover(n)} onMouseLeave={() => setCsatHover(0)}
                className="transition-transform hover:scale-110">
                <Star className={`w-9 h-9 ${n <= (csatHover || csatRating) ? "text-amber-400 fill-amber-400" : "text-slate-300"}`} />
              </button>
            ))}
          </div>
          <textarea value={csatComment} onChange={(e) => setCsatComment(e.target.value)}
            placeholder="Коментар (незадължително)..."
            className="w-full h-20 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:border-[#FF4D00] focus:ring-2 focus:ring-[#FF4D00]/20 transition" />
          <div className="flex gap-2 w-full">
            <button onClick={() => setCsatPhase("done")} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition">
              Пропусни
            </button>
            <button onClick={handleCsatSubmit} disabled={csatRating === 0}
              className="flex-1 h-10 rounded-xl bg-[#FF4D00] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#e63900] transition">
              Изпрати
            </button>
          </div>
        </div>
      )}
      {csatPhase === "done" && (
        <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-base font-bold text-slate-900">Благодарим Ви!</p>
          <p className="text-sm text-slate-500 text-center">Вашата оценка беше записана.</p>
          <button onClick={handleMinimize} className="mt-2 px-6 h-10 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition">
            Затвори
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1 bg-gradient-to-b from-slate-50/60 to-white relative">
        {chatStatus === "waiting" && messages.filter(m => m.sender_role !== "system").length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Свързваме ви с консултант...</p>
            <p className="text-xs text-slate-500">Обикновено отговаряме до 2 минути</p>
          </div>
        )}

        <MessageList messages={messages} onNavigate={onNavigate} />

        {/* Admin typing indicator */}
        {adminTyping && (
          <div className="flex gap-2 items-end mt-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF4D00] to-[#e63900] flex items-center justify-center shrink-0">
              <Headphones className="w-3.5 h-3.5 text-white" />
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

        {chatStatus === "closed" && csatPhase === "hidden" && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
            <XCircle className="w-3.5 h-3.5" /> Чатът е приключен
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {chatStatus !== "closed" ? (
        <div className="shrink-0 border-t border-slate-100 bg-white">
          <div className="px-3 pt-3 pb-1 flex gap-2 items-center bg-slate-50 mx-3 rounded-2xl border border-slate-200 focus-within:border-[#FF4D00] focus-within:ring-2 focus-within:ring-[#FF4D00]/20 transition">
            <input ref={inputRef} type="text" value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); sendTyping(); }}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Напишете съобщение..."
              className="flex-1 bg-transparent text-sm py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0"
              disabled={sending} />
            <button onClick={handleSend} disabled={!inputValue.trim() || sending}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#FF4D00] text-white disabled:opacity-40 hover:bg-[#e63900] transition-colors shrink-0">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
            </button>
          </div>
          <div className="flex justify-center pb-2 pt-1">
            <button
              onClick={handleEndChat}
              className="text-[11px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <XCircle className="w-3 h-3" /> Приключи чата
            </button>
          </div>
        </div>
      ) : csatPhase === "hidden" ? (
        <div className="shrink-0 px-4 py-3 border-t border-slate-100 bg-slate-50">
          <button onClick={() => { clearSession(); setSession(null); setPhase("form"); setMessages([]); setChatStatus("waiting"); }}
            className="w-full h-10 rounded-xl bg-[#FF4D00] text-white text-sm font-semibold hover:bg-[#e63900] transition-colors flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" /> Нов чат
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Shared Header ────────────────────────────────────────────────────────────

function SharedHeader({
  chatStatus, connected, onClose, activeTab, onSwitchToAI,
}: {
  chatStatus: ChatStatus; connected: boolean; onClose?: () => void;
  activeTab: "ai" | "live"; onSwitchToAI?: () => void;
}) {
  return (
    <div className="relative bg-white border-b border-slate-100 shrink-0">
      <div className="flex h-[3px]">
        <span className="flex-1 bg-[#00B4D8]" />
        <span className="flex-1 bg-[#FF4D00]" />
      </div>
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#FF4D00] to-[#e63900] flex items-center justify-center shadow-sm shrink-0">
            <Headphones className="w-4 h-4 text-white" strokeWidth={1.75} />
            <span className="absolute -bottom-0.5 -right-0.5 w-[11px] h-[11px] rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">Смолян Клима</p>
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
              {chatStatus === "waiting" && <><span className="text-amber-500 font-semibold">• Изчакване</span><span className="text-slate-300">·</span><span>Свързваме ви...</span></>}
              {chatStatus === "active"  && <><span className="text-emerald-600 font-semibold">• На линия</span><span className="text-slate-300">·</span><span>Реален консултант</span></>}
              {chatStatus === "closed"  && <><span className="text-slate-400 font-semibold">• Приключен</span></>}
              {!connected && chatStatus !== "closed" && <span className="ml-1 text-slate-300 flex items-center gap-0.5"><WifiOff className="w-2.5 h-2.5" /> Reconnect...</span>}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors shrink-0">
          <X className="w-[15px] h-[15px]" />
        </button>
      </div>
      <div className="flex px-3 pt-2 gap-1">
        <button onClick={onSwitchToAI}
          className="flex-1 flex items-center justify-center gap-1.5 py-[7px] text-xs font-medium text-slate-400 border-b-2 border-transparent hover:text-[#00B4D8] hover:border-[#00B4D8]/40 transition-all">
          <Bot className="w-3.5 h-3.5" strokeWidth={2} /> AI Асистент
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-[7px] text-xs font-semibold text-[#FF4D00] border-b-2 border-[#FF4D00] cursor-default">
          <Headphones className="w-3.5 h-3.5" strokeWidth={2} /> Жива връзка
        </button>
      </div>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-slate-700">
        {label} {hint && <span className="text-slate-400 font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Message list with grouping ───────────────────────────────────────────────

function MessageList({ messages, onNavigate }: { messages: ChatMsg[]; onNavigate?: (slug: string) => void }) {
  return (
    <>
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const isSameSender = prev && prev.sender_role === msg.sender_role;
        const timeDiffMs = prev ? new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() : Infinity;
        const showAvatar = !isSameSender || timeDiffMs > 3 * 60 * 1000;
        return <ChatBubble key={msg.id} msg={msg} showAvatar={showAvatar} onNavigate={onNavigate} />;
      })}
    </>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ msg, showAvatar, onNavigate }: { msg: ChatMsg; showAvatar: boolean; onNavigate?: (slug: string) => void }) {
  if (msg.sender_role === "system") {
    const isSeparator = msg.content.startsWith("—") || msg.content.startsWith("-");
    if (isSeparator) {
      return (
        <div className="flex items-center gap-2 justify-center py-1 my-1">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap px-1">{msg.content}</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-[90%] bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 text-xs text-sky-700 leading-relaxed text-center my-2 shadow-sm">
        {msg.content}
      </div>
    );
  }

  // Product card message
  if (msg.metadata?.type === "product_card" && msg.metadata.product) {
    return <ProductCardMessage product={msg.metadata.product} onNavigate={onNavigate} isAdmin={msg.sender_role === "admin"} />;
  }

  const isUser = msg.sender_role === "user";
  const time = new Date(msg.created_at).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"} ${showAvatar ? "mt-2" : "mt-0.5"}`}>
      {!isUser && (
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-[#FF4D00] to-[#e63900] flex items-center justify-center shrink-0 self-end mb-1 ${showAvatar ? "opacity-100" : "opacity-0"}`}>
          <Headphones className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[78%] flex flex-col gap-0.5 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
          isUser
            ? "bg-gradient-to-br from-[#00B4D8] to-[#0077B6] text-white rounded-br-sm"
            : "bg-white border border-slate-200 text-slate-800 shadow-sm rounded-bl-sm"
        }`}>
          {msg.content}
        </div>
        {showAvatar && <span className="text-[10px] text-slate-400 px-1">{time}</span>}
      </div>
    </div>
  );
}

// ─── Product Card in chat ─────────────────────────────────────────────────────

function ProductCardMessage({ product, onNavigate, isAdmin }: { product: ProductCardData; onNavigate?: (slug: string) => void; isAdmin: boolean }) {
  return (
    <div className={`flex gap-2 ${isAdmin ? "justify-start" : "justify-end"} mt-2`}>
      {isAdmin && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF4D00] to-[#e63900] flex items-center justify-center shrink-0 self-end mb-1">
          <Headphones className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <button
        onClick={() => onNavigate?.(product.slug)}
        className="max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-bl-sm overflow-hidden shadow-sm hover:shadow-md hover:border-[#00B4D8]/40 transition-all text-left group"
      >
        {product.image_url && (
          <div className="w-full h-32 bg-slate-100 overflow-hidden">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" />
          </div>
        )}
        <div className="px-3 py-2.5">
          {product.brand_name && <p className="text-[10px] font-semibold text-[#00B4D8] uppercase tracking-wide">{product.brand_name}</p>}
          <p className="text-sm font-bold text-slate-900 leading-tight mt-0.5">{product.name}</p>
          {product.price_from && (
            <p className="text-sm font-bold text-[#FF4D00] mt-1">{product.price_from.toLocaleString("bg-BG")} лв.</p>
          )}
          <div className="flex items-center gap-1 mt-2 text-[11px] text-[#00B4D8] font-medium">
            <ExternalLink className="w-3 h-3" /> Виж детайли
          </div>
        </div>
      </button>
    </div>
  );
}
