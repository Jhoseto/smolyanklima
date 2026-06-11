"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { countPendingMutations, getPendingQueueSampleError } from "@/lib/offline/queue";
import { syncAllPending, type SyncResult } from "@/lib/offline/sync";
import { useOnlineStatus } from "./useOnlineStatus";

export interface QueueState {
  /** Брой неизпратени мутации. */
  pendingCount: number;
  /** Текущо ли тече sync. */
  isSyncing: boolean;
  /** Резултат от последен sync (за toast). */
  lastResult?: SyncResult;
  /** Грешка при последен опит. */
  lastError?: string;
  /** Примерна грешка от чакаща мутация (HTTP/сървър), за пояснение в UI. */
  pendingSampleError?: string;
  /** Ръчно стартира sync (idempotent). */
  syncNow: () => Promise<void>;
  /** Обновява брояча и примерната грешка от IDB (след нов запис в опашката). */
  refreshQueueState: () => Promise<void>;
}

const DEFAULT_STATE: QueueState = {
  pendingCount: 0,
  isSyncing: false,
  pendingSampleError: undefined,
  syncNow: async () => { /* no-op fallback */ },
  refreshQueueState: async () => { /* no-op */ },
};

const OfflineQueueContext = createContext<QueueState>(DEFAULT_STATE);

/**
 * Глобален Provider за offline опашката (виж P9 в кода ревюто).
 *
 * Един брояч + един sync таймер за цялото app, вместо всеки компонент
 * да инстанцира свой `useEffect` + `setInterval`. Това намалява IDB чрешения
 * до 1× на всеки 30s и предотвратява race condition-и между множество
 * паралелни sync повиквания (макар че `flushQueue()` сам по себе си е
 * idempotent чрез inflight guard + Web Locks).
 *
 * Слага се в админ layout-а веднъж; `useOfflineQueue()` чете от него.
 */
export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | undefined>();
  const [lastError, setLastError] = useState<string | undefined>();
  const [pendingSampleError, setPendingSampleError] = useState<string | undefined>();
  const mountedRef = useRef(true);

  const refreshCount = useCallback(async () => {
    try {
      const n = await countPendingMutations();
      const sample = n > 0 ? await getPendingQueueSampleError() : undefined;
      if (mountedRef.current) {
        setPendingCount(n);
        setPendingSampleError(sample);
      }
    } catch { /* IDB може да не е готов */ }
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    setIsSyncing(true);
    setLastError(undefined);
    try {
      const result = await syncAllPending();
      if (mountedRef.current) {
        setLastResult(result);
        await refreshCount();
      }
    } catch (e: unknown) {
      if (mountedRef.current) {
        setLastError(e instanceof Error ? e.message : "Грешка при синхронизация");
      }
    } finally {
      if (mountedRef.current) setIsSyncing(false);
    }
  }, [refreshCount]);

  // Initial + periodic count refresh — 1× за цялото app
  useEffect(() => {
    mountedRef.current = true;
    void refreshCount();
    const id = setInterval(() => { void refreshCount(); }, 30_000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [refreshCount]);

  // Sync при възстановяване на мрежа
  useEffect(() => {
    if (online) void syncNow();
  }, [online, syncNow]);

  // Sync при focus на таба
  useEffect(() => {
    const onFocus = () => {
      void refreshCount();
      if (typeof navigator !== "undefined" && navigator.onLine) void syncNow();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [syncNow, refreshCount]);

  // Подаваме съобщение към SW при reconnect (фолбек за Safari/Firefox, които нямат Background Sync).
  useEffect(() => {
    if (!online) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.controller?.postMessage({ type: "FLUSH_QUEUE" });
  }, [online]);

  const value = useMemo<QueueState>(() => ({
    pendingCount,
    isSyncing,
    lastResult,
    lastError,
    pendingSampleError,
    syncNow,
    refreshQueueState: refreshCount,
  }), [pendingCount, isSyncing, lastResult, lastError, pendingSampleError, syncNow, refreshCount]);

  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

/**
 * Чете глобалното състояние на offline опашката.
 * Ако се вика извън provider → връща default no-op стойности
 * (важно за SSR safety и unit тестове).
 */
export function useOfflineQueue(): QueueState {
  return useContext(OfflineQueueContext);
}
