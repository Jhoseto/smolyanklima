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

type AlertSnapshot = {
  waiting: Array<{ id: string; visitorName: string; visitorPhone: string | null; createdAt: string }>;
  userMessages: Array<{
    chatId: string;
    visitorName: string;
    visitorPhone: string | null;
    messageId: string;
    createdAt: string;
  }>;
};

type AdminChatAlertsContextValue = {
  streamConnected: boolean;
  setViewingChatId: (chatId: string | null) => void;
  acknowledgeUserMessage: (chatId: string, messageId: string) => void;
  subscribeInboxChange: (cb: () => void) => () => void;
};

const AdminChatAlertsContext = createContext<AdminChatAlertsContextValue | null>(null);

export function useAdminChatAlerts(): AdminChatAlertsContextValue {
  const ctx = useContext(AdminChatAlertsContext);
  if (!ctx) {
    return {
      streamConnected: false,
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
  const viewingChatIdRef = useRef<string | null>(null);
  const knownWaitingIdsRef = useRef<Set<string>>(new Set());
  const lastUserMsgIdRef = useRef<Map<string, string>>(new Map());
  const seededRef = useRef(false);
  const inboxListenersRef = useRef(new Set<() => void>());

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

  const processSnapshot = useCallback((snapshot: AlertSnapshot, notify: boolean) => {
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
    async (notify: boolean) => {
      try {
        const res = await fetch("/api/admin/chat/alerts", { credentials: "include" });
        if (!res.ok) return;
        const snapshot = (await res.json()) as AlertSnapshot;
        processSnapshot(snapshot, notify);
      } catch {
        /* ignore */
      }
    },
    [processSnapshot],
  );

  useEffect(() => {
    if (!enabled) return;

    const removeUnlock = installAdminChatAudioUnlock();

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    void fetchAlerts(false);

    let aborted = false;
    const ctrl = new AbortController();
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const pollAlerts = () => {
      if (aborted || (typeof document !== "undefined" && document.hidden)) return;
      void fetchAlerts(true);
    };

    pollTimer = setInterval(pollAlerts, 3_000);

    (async () => {
      try {
        const res = await fetch("/api/admin/chat/stream", { signal: ctrl.signal, credentials: "include" });
        if (!res.ok || !res.body) return;
        setStreamConnected(true);
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
            if (part.includes("event: changed")) {
              await fetchAlerts(true);
              notifyInboxListeners();
            }
          }
        }
      } catch {
        /* aborted */
      } finally {
        if (!aborted) setStreamConnected(false);
      }
    })();

    return () => {
      aborted = true;
      ctrl.abort();
      if (pollTimer) clearInterval(pollTimer);
      setStreamConnected(false);
      removeUnlock();
    };
  }, [enabled, fetchAlerts, notifyInboxListeners]);

  const value: AdminChatAlertsContextValue = {
    streamConnected,
    setViewingChatId,
    acknowledgeUserMessage,
    subscribeInboxChange,
  };

  return <AdminChatAlertsContext.Provider value={value}>{children}</AdminChatAlertsContext.Provider>;
}
