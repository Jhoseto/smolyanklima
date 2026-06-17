/**
 * Persists form draft state in sessionStorage so that closing a modal
 * and reopening it restores the last entered values.
 *
 * Usage:
 *   const [draft, setDraft, clearDraft] = useSessionDraft("adminDraft:newContact", defaultValues);
 *
 * Call clearDraft() on successful form submission.
 * The draft is keyed by `key`; include an entity id for edit forms, e.g. "adminDraft:editStaff:123".
 */

import { useCallback, useRef, useState } from "react";

function readDraft<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeDraft<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or private mode — silent
  }
}

function removeDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function useSessionDraft<T>(
  key: string,
  defaultValues: T,
): [T, (updater: T | ((prev: T) => T)) => void, () => void] {
  // Keep a ref so clearDraft always sees the latest defaultValues without
  // needing it in the dependency array (avoids stale-closure bug when the
  // caller creates a new defaultValues object on every render).
  const defaultValuesRef = useRef(defaultValues);
  defaultValuesRef.current = defaultValues;

  const [draft, setDraftState] = useState<T>(() => readDraft(key, defaultValues));

  const setDraft = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setDraftState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
        writeDraft(key, next);
        return next;
      });
    },
    [key],
  );

  const clearDraft = useCallback(() => {
    removeDraft(key);
    setDraftState(defaultValuesRef.current);
  }, [key]);

  return [draft, setDraft, clearDraft];
}
