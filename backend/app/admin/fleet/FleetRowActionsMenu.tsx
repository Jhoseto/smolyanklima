"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

const MENU_WIDTH = 168;

export function FleetRowActionsMenu({
  open,
  onOpenChange,
  onDetails,
  onEdit,
  onDelete,
  canDelete = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete?: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
      const top = rect.bottom + 4;
      setPos({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const itemClass =
    "block w-full px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-50 text-slate-800";

  const menu =
    open && pos && mounted
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[200] rounded-lg border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5"
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          >
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                onOpenChange(false);
                onDetails();
              }}
            >
              Детайли
            </button>
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
            >
              Редакция
            </button>
            {canDelete && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2.5 text-left text-sm font-bold text-red-700 hover:bg-red-50"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete();
                  }}
                >
                  Изтрий…
                </button>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className="p-1.5 rounded-lg hover:bg-slate-100 min-w-[2rem] min-h-[2rem] inline-flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <MoreVertical className="h-4 w-4 text-slate-500" />
      </button>
      {menu}
    </>
  );
}
