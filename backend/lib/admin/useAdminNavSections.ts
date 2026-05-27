"use client";

import { useCallback, useEffect, useState } from "react";

export type AdminNavSectionId = "office" | "catalog" | "service" | "reports" | "admin";

const STORAGE_KEY = "sk-admin-nav-sections-v1";

const DEFAULTS: Record<AdminNavSectionId, boolean> = {
  office: true,
  catalog: true,
  service: true,
  reports: true,
  admin: true,
};

export function useAdminNavSections() {
  const [open, setOpen] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<AdminNavSectionId, boolean>>;
        setOpen({ ...DEFAULTS, ...parsed });
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
    } catch {
      /* ignore */
    }
  }, [open, ready]);

  const toggle = useCallback((id: AdminNavSectionId) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const expand = useCallback((id: AdminNavSectionId) => {
    setOpen((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  return { open, toggle, expand };
}
