"use client";

/**
 * Универсален lightbox за разглеждане на продуктови снимки в голям размер.
 *
 * Особености:
 *  - Fullscreen overlay с blur backdrop; клик извън снимката затваря.
 *  - ESC key за затваряне; ←/→ за навигация между снимките.
 *  - Брояч „N/Total“ горе вдясно.
 *  - Бутони „Назад“ / „Напред“ при ≥2 снимки.
 *  - Body scroll lock докато е отворен (за по-добър mobile UX).
 *  - Може да приема и blob: URL-и (за pending preview), и Cloudinary URL-и.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Props = {
  images: string[];
  /** Активен индекс или null = затворен. */
  index: number | null;
  /** Callback за затваряне (предава null към parent state). */
  onClose: () => void;
  /** (По избор) Callback при навигация — синхронизира parent state-а. */
  onIndexChange?: (next: number) => void;
};

export function ImageLightbox({ images, index, onClose, onIndexChange }: Props) {
  const [internalIndex, setInternalIndex] = useState(index ?? 0);

  // Sync на initial / external промени на index.
  useEffect(() => {
    if (index !== null) setInternalIndex(index);
  }, [index]);

  const active = index !== null;

  // Keyboard навигация + ESC.
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (images.length < 2) return;
      if (e.key === "ArrowRight") {
        const next = (internalIndex + 1) % images.length;
        setInternalIndex(next);
        onIndexChange?.(next);
      } else if (e.key === "ArrowLeft") {
        const prev = (internalIndex - 1 + images.length) % images.length;
        setInternalIndex(prev);
        onIndexChange?.(prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, images.length, internalIndex, onClose, onIndexChange]);

  // Body scroll lock при отворен lightbox.
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!active || internalIndex < 0 || internalIndex >= images.length) return null;

  function go(delta: number) {
    const next = (internalIndex + delta + images.length) % images.length;
    setInternalIndex(next);
    onIndexChange?.(next);
  }

  const url = images[internalIndex];
  const hasMany = images.length > 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Преглед на снимка"
    >
      {/* Затваряне */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-3 right-3 sm:top-5 sm:right-5 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur-md transition-colors"
        aria-label="Затвори"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Брояч */}
      {hasMany && (
        <div className="absolute top-3 left-3 sm:top-5 sm:left-5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold backdrop-blur-md">
          {internalIndex + 1} / {images.length}
        </div>
      )}

      {/* Голяма снимка */}
      <img
        src={url}
        alt={`preview-${internalIndex}`}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
        draggable={false}
      />

      {/* Стрелки за навигация */}
      {hasMany && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur-md transition-colors"
            aria-label="Предишна"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur-md transition-colors"
            aria-label="Следваща"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Малки thumbnail-и долу при ≥2 снимки. */}
      {hasMany && (
        <div
          className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-2 rounded-xl bg-white/15 backdrop-blur-md max-w-[90vw] overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((u, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setInternalIndex(i);
                onIndexChange?.(i);
              }}
              className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden border-2 transition-all ${
                i === internalIndex
                  ? "border-white scale-105"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={u} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
