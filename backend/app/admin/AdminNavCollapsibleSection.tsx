"use client";

import { ChevronDown } from "lucide-react";
import type { AdminNavSectionId } from "@/lib/admin/useAdminNavSections";

export function AdminNavCollapsibleSection({
  id,
  label,
  open,
  onToggle,
  children,
  variant = "sidebar",
}: {
  id: AdminNavSectionId;
  label: string;
  open: boolean;
  onToggle: (id: AdminNavSectionId) => void;
  children: React.ReactNode;
  variant?: "sidebar" | "drawer";
}) {
  const panelId = `admin-nav-section-${id}`;

  if (variant === "drawer") {
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={open}
          aria-controls={panelId}
          className="mb-1 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            aria-hidden
          />
        </button>
        {open && (
          <div id={panelId} className="grid grid-cols-3 gap-2">
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          aria-hidden
        />
      </button>
      {open && <div id={panelId}>{children}</div>}
    </div>
  );
}
