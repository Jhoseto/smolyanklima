"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "../ui";
import {
  PRODUCT_STOCK_LOCATIONS,
  productStockLocationBadgeClass,
  productStockLocationLabel,
  productStockLocationLabelCompact,
  normalizeProductStockLocation,
  type ProductStockLocation,
} from "@/lib/admin/productStockLocation";

type Props = {
  productId: string;
  stockLocation: unknown;
  canEdit: boolean;
  busy?: boolean;
  compact?: boolean;
  onConfirmChange: (next: ProductStockLocation) => void;
};

type AnchorRect = { top: number; left: number; width: number; height: number };

function readAnchorRect(el: HTMLElement | null): AnchorRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function StockLocationCell({
  productId,
  stockLocation,
  canEdit,
  busy = false,
  compact = true,
  onConfirmChange,
}: Props) {
  const current = normalizeProductStockLocation(stockLocation);
  const label = compact ? productStockLocationLabelCompact(stockLocation) : productStockLocationLabel(stockLocation);
  const badgeClass = productStockLocationBadgeClass(stockLocation);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingNext, setPendingNext] = useState<ProductStockLocation | null>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    if (!menuOpen && !pendingNext) return;
    setAnchor(readAnchorRect(buttonRef.current));
  }, [menuOpen, pendingNext, productId, current]);

  useEffect(() => {
    if (!menuOpen && !pendingNext) return;
    function refreshAnchor() {
      setAnchor(readAnchorRect(buttonRef.current));
    }
    window.addEventListener("resize", refreshAnchor);
    window.addEventListener("scroll", refreshAnchor, true);
    return () => {
      window.removeEventListener("resize", refreshAnchor);
      window.removeEventListener("scroll", refreshAnchor, true);
    };
  }, [menuOpen, pendingNext]);

  useEffect(() => {
    if (!menuOpen && !pendingNext) return;
    function onDocPointer(e: PointerEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      if (confirmRef.current?.contains(t)) return;
      setMenuOpen(false);
      setPendingNext(null);
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [menuOpen, pendingNext]);

  useEffect(() => {
    setMenuOpen(false);
    setPendingNext(null);
  }, [productId, current]);

  if (!canEdit) {
    return (
      <span
        className={`inline-flex items-center justify-center px-1 py-px rounded text-[10px] font-semibold border border-slate-200/80 ${badgeClass}`}
      >
        {label}
      </span>
    );
  }

  function pickLocation(next: ProductStockLocation) {
    setMenuOpen(false);
    if (next === current) {
      setPendingNext(null);
      return;
    }
    setPendingNext(next);
  }

  function cancelConfirm() {
    setPendingNext(null);
  }

  function acceptConfirm() {
    if (!pendingNext) return;
    onConfirmChange(pendingNext);
    setPendingNext(null);
  }

  const fromLabel = productStockLocationLabelCompact(current);
  const toLabel = pendingNext ? productStockLocationLabelCompact(pendingNext) : "";

  const menuStyle =
    anchor &&
    ({
      position: "fixed",
      top: anchor.top + anchor.height + 4,
      left: anchor.left + anchor.width / 2,
      transform: "translateX(-50%)",
      zIndex: 80,
    } as const);

  const confirmStyle =
    anchor &&
    ({
      position: "fixed",
      top: anchor.top + anchor.height + 6,
      left: Math.min(Math.max(anchor.left + anchor.width / 2, 140), window.innerWidth - 140),
      transform: "translateX(-50%)",
      zIndex: 81,
    } as const);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={busy}
        onClick={() => {
          setPendingNext(null);
          setMenuOpen((open) => !open);
        }}
        title="Избор на място: склад, магазин или сервиз"
        className={`inline-flex items-center gap-0.5 justify-center px-1 py-px rounded text-[10px] font-semibold border border-slate-200/80 cursor-pointer hover:opacity-90 disabled:opacity-60 ${badgeClass}`}
      >
        {busy ? "…" : label}
        {!busy && <ChevronDown className="w-2.5 h-2.5 opacity-70 shrink-0" />}
      </button>

      {typeof document !== "undefined" && menuOpen && anchor && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="min-w-[7.5rem] rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-left"
              role="menu"
            >
              {PRODUCT_STOCK_LOCATIONS.map((loc) => {
                const optionLabel = productStockLocationLabelCompact(loc);
                const active = loc === current;
                return (
                  <button
                    key={loc}
                    type="button"
                    role="menuitem"
                    onClick={() => pickLocation(loc)}
                    className={`w-full px-2.5 py-1.5 text-[11px] font-semibold text-left hover:bg-slate-50 ${
                      active ? "text-brand-blue-700 bg-brand-blue-50/60" : "text-slate-800"
                    }`}
                  >
                    {optionLabel}
                    {active ? " ✓" : ""}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" && pendingNext && anchor && confirmStyle
        ? createPortal(
            <div
              ref={confirmRef}
              style={confirmStyle}
              className="w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 shadow-xl text-left"
              role="dialog"
              aria-label="Потвърждение за смяна на място"
            >
              <div className="text-[11px] font-bold text-amber-950 leading-snug">
                Сигурни ли сте, че искате да смените мястото от{" "}
                <span className="text-slate-900">{fromLabel}</span> на{" "}
                <span className="text-slate-900">{toLabel}</span>?
              </div>
              <div className="mt-2 flex justify-end gap-1.5">
                <Button variant="secondary" size="sm" className="!py-1 !px-2 !text-[11px]" onClick={cancelConfirm}>
                  Не
                </Button>
                <Button variant="primary" size="sm" className="!py-1 !px-2 !text-[11px]" onClick={acceptConfirm}>
                  Да, смени
                </Button>
              </div>
              <div
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-l border-t border-amber-200 bg-amber-50"
                aria-hidden
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
