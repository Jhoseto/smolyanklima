"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AdminRole } from "@/lib/admin/db";
import {
  playNewChatSound,
  playNewMessageSound,
  requestChatBrowserNotification,
  installAdminChatAudioUnlock,
} from "@/lib/admin/chatSounds";
import type { ChatAlertSnapshot } from "@/lib/live-chat/chatAlertSnapshot";

type AdminChatAlertsContextValue = {
  streamConnected: boolean;
  waitingCount: number;
  reconnectFailed: boolean;
  setViewingChatId: (chatId: string | null) => void;
  acknowledgeUserMessage: (chatId: string, messageId: string) => void;
  subscribeInboxChange: (cb: () => void) => () => void;
};

const AdminChatAlertsContext = createContext<AdminChatAlertsContextValue | null>(null);

const ALERTS_DEBOUNCE_MS = 12_000;
const STREAM_RECONNECT_MS = 8_000;
const MAX_RECONNECT_FAILURES = 5;
// Disconnect SSE after 15 min of no intentional user activity (click / keydown / touchstart).
// mousemove and scroll only reset the timer — they do NOT trigger reconnect.
const IDLE_MS = 15 * 60 * 1000;

export function useAdminChatAlerts(): AdminChatAlertsContextValue {
  const ctx = useContext(AdminChatAlertsContext);
  if (!ctx) {
    return {
      streamConnected: false,
      waitingCount: 0,
      reconnectFailed: false,
      setViewingChatId: () => {},
      acknowledgeUserMessage: () => {},
      subscribeInboxChange: () => () => {},
    };
  }
  return ctx;
}

function isChatOperator(role: AdminRole): boolean {
  return role === "master_admin" || role === "office_staff";
}

export function AdminChatAlertsProvider({
  role,
  children,
}: {
  role: AdminRole;
  children: ReactNode;
}) {
  const enabled = isChatOperator(role);
  const [streamConnected, setStreamConnected] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const streamConnectedRef = useRef(false);
  const viewingChatIdRef = useRef<string | null>(null);
  const knownWaitingIdsRef = useRef<Set<string>>(new Set());
  const lastUserMsgIdRef = useRef<Map<string, string>>(new Map());
  const seededRef = useRef(false);
  const inboxListenersRef = useRef(new Set<() => void>());
  const lastAlertsFetchAtRef = useRef(0);
  const alertsInFlightRef = useRef(false);

  const setViewingChatId = useCallback((chatId: string | null) => {
    viewingChatIdRef.current = chatId;
  }, []);

  const acknowledgeUserMessage = useCallback((chatId: string, messageId: string) => {
    lastUserMsgIdRef.current.set(chatId, messageId);
  }, []);

  const subscribeInboxChange = useCallback((cb: () => void) => {
    inboxListenersRef.current.add(cb);
    return () => {
      inboxListenersRef.current.delete(cb);
    };
  }, []);

  const notifyInboxListeners = useCallback(() => {
    for (const cb of inboxListenersRef.current) {
      try {
        cb();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const processSnapshot = useCallback((snapshot: ChatAlertSnapshot, notify: boolean) => {
    const newWaiting = snapshot.waiting.filter((w) => !knownWaitingIdsRef.current.has(w.id));
    const newWaitingIdSet = new Set(newWaiting.map((w) => w.id));

    if (notify && seededRef.current && newWaiting.length > 0) {
      playNewChatSound();
      const chat = newWaiting[0];
      requestChatBrowserNotification(
        "Нов чат",
        `${chat.visitorName} започна разговор${chat.visitorPhone ? ` · ${chat.visitorPhone}` : ""}`,
      );
    }

    knownWaitingIdsRef.current = new Set(snapshot.waiting.map((w) => w.id));
    setWaitingCount(snapshot.waiting.length);

    for (const msg of snapshot.userMessages) {
      if (newWaitingIdSet.has(msg.chatId)) {
        lastUserMsgIdRef.current.set(msg.chatId, msg.messageId);
        continue;
      }

      const prevId = lastUserMsgIdRef.current.get(msg.chatId);
      const isNew = prevId !== msg.messageId;

      if (notify && seededRef.current && isNew) {
        const viewing = viewingChatIdRef.current === msg.chatId;
        if (!viewing) {
          playNewMessageSound();
          requestChatBrowserNotification(
            "Ново съобщение",
            `${msg.visitorName}: ново съобщение в чата${msg.visitorPhone ? ` · ${msg.visitorPhone}` : ""}`,
          );
        }
      }

      lastUserMsgIdRef.current.set(msg.chatId, msg.messageId);
    }

    seededRef.current = true;
  }, []);

  const fetchAlerts = useCallback(
    async (notify: boolean, opts?: { force?: boolean }) => {
      const now = Date.now();
      if (!opts?.force && now - lastAlertsFetchAtRef.current < ALERTS_DEBOUNCE_MS) return;
      if (alertsInFlightRef.current) return;

      alertsInFlightRef.current = true;
      try {
        const res = await fetch("/api/admin/chat/alerts", { credentials: "include" });
        if (!res.ok) return;
        const snapshot = (await res.json()) as ChatAlertSnapshot;
        lastAlertsFetchAtRef.current = Date.now();
        processSnapshot(snapshot, notify);
      } catch {
        /* ignore */
      } finally {
        alertsInFlightRef.current = false;
      }
    },
    [processSnapshot],
  );

  useEffect(() => {
    if (!enabled) return;

    const removeUnlock = installAdminChatAudioUnlock();

    // НЕ викай Notification.requestPermission() тук — без user gesture чупи
    // Web Push enable на мобилен PWA (диалогът се блокира / второто викане виси).

    void fetchAlerts(false, { force: true });

    let aborted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let activeCtrl: AbortController | null = null;
    let connecting = false;
    // Prevents scheduleReconnect from firing after an intentional idle disconnect
    let intentionalDisconnect = false;
    // Counts consecutive failed reconnect attempts for the stale-connection banner
    let failedAttempts = 0;

    const setStreamState = (connected: boolean) => {
      streamConnectedRef.current = connected;
      setStreamConnected(connected);
    };

    const scheduleReconnect = () => {
      if (aborted || reconnectTimer || connecting || intentionalDisconnect) return;
      if (typeof document !== "undefined" && document.hidden) return;
      failedAttempts += 1;
      if (failedAttempts >= MAX_RECONNECT_FAILURES) setReconnectFailed(true);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!aborted && !document.hidden) void connectStream();
      }, STREAM_RECONNECT_MS);
    };

    const connectStream = async () => {
      if (aborted || connecting) return;
      if (typeof document !== "undefined" && document.hidden) return;
      connecting = true;
      activeCtrl?.abort();
      activeCtrl = new AbortController();
      const ctrl = activeCtrl;

      try {
        const res = await fetch("/api/admin/chat/stream", { signal: ctrl.signal, credentials: "include" });
        if (!res.ok || !res.body) {
          setStreamState(false);
          scheduleReconnect();
          return;
        }

        // Successful connection — reset failure counter and clear banner
        failedAttempts = 0;
        setReconnectFailed(false);
        setStreamState(true);
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
            if (part.includes("event: ready")) {
              // Server sends this immediately on connect — refresh data after every reconnect
              void fetchAlerts(true, { force: true });
            }
            if (part.includes("event: changed")) {
              void fetchAlerts(true);
              notifyInboxListeners();
            }
          }
        }
      } catch {
        /* aborted or network error */
      } finally {
        connecting = false;
        if (!aborted) {
          setStreamState(false);
          scheduleReconnect();
        }
      }
    };

    void connectStream();

    const disconnectStream = (intentional = false) => {
      intentionalDisconnect = intentional;
      activeCtrl?.abort();
      activeCtrl = null;
      connecting = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      setStreamState(false);
    };

    // ── Idle timeout ──────────────────────────────────────────────────────────
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      // Never auto-disconnect while a client is actively waiting
      if (knownWaitingIdsRef.current.size > 0) return;
      idleTimer = setTimeout(() => {
        if (!aborted && !document.hidden) disconnectStream(true);
      }, IDLE_MS);
    };

    // mousemove / scroll: only push back the disconnect timer, never reconnect
    const onPassiveActivity = () => {
      resetIdle();
    };

    // click / keydown / touchstart: intentional action — reconnect if disconnected, then reset timer
    const onIntentionalAction = () => {
      intentionalDisconnect = false;
      if (!streamConnectedRef.current && !aborted && !document.hidden) {
        void connectStream();
      }
      resetIdle();
    };

    window.addEventListener("mousemove", onPassiveActivity, { passive: true });
    window.addEventListener("scroll", onPassiveActivity, { passive: true });
    window.addEventListener("click", onIntentionalAction, { passive: true });
    window.addEventListener("keydown", onIntentionalAction, { passive: true });
    window.addEventListener("touchstart", onIntentionalAction, { passive: true });

    // Start the initial idle timer
    resetIdle();

    // ── Visibility ────────────────────────────────────────────────────────────
    const onVisibility = () => {
      if (document.hidden) {
        disconnectStream();
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        return;
      }
      // Tab became visible — clear intentional flag and restart idle timer
      intentionalDisconnect = false;
      void fetchAlerts(true);
      if (!aborted) void connectStream();
      resetIdle();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      aborted = true;
      activeCtrl?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (idleTimer) clearTimeout(idleTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("mousemove", onPassiveActivity);
      window.removeEventListener("scroll", onPassiveActivity);
      window.removeEventListener("click", onIntentionalAction);
      window.removeEventListener("keydown", onIntentionalAction);
      window.removeEventListener("touchstart", onIntentionalAction);
      setStreamState(false);
      removeUnlock();
    };
  }, [enabled, fetchAlerts, notifyInboxListeners]);

  const value: AdminChatAlertsContextValue = {
    streamConnected,
    waitingCount,
    reconnectFailed,
    setViewingChatId,
    acknowledgeUserMessage,
    subscribeInboxChange,
  };

  return (
    <AdminChatAlertsContext.Provider value={value}>
      {reconnectFailed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex justify-between items-center">
          <span>Връзката е прекъсната. Данните може да не са актуални.</span>
          <button
            onClick={() => window.location.reload()}
            className="font-bold underline ml-4"
          >
            Обнови страницата
          </button>
        </div>
      )}
      {children}
    </AdminChatAlertsContext.Provider>
  );
}
