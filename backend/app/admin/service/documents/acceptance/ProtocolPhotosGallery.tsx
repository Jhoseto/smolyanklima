"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";

export function ProtocolPhotosGallery({
  urls,
  title = "Снимки от монтажа",
  compact = false,
}: {
  urls: string[];
  title?: string;
  /** По-малки thumbnails за вграден преглед (напр. в PDF preview). */
  compact?: boolean;
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!urls.length) return null;

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={`font-semibold text-slate-700 flex items-center gap-1.5 ${compact ? "text-xs" : "text-sm"}`}>
            <Camera className={`text-slate-500 ${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
            {title}
          </p>
          <span className="text-xs text-slate-400 tabular-nums">{urls.length}</span>
        </div>
        <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-3"}`}>
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxIdx(i)}
              className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 active:opacity-80"
              aria-label={`Отвори снимка ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Снимка ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {lightboxIdx !== null && (
        <PhotoLightbox
          urls={urls}
          index={lightboxIdx}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}

function PhotoLightbox({
  urls,
  index,
  onIndexChange,
  onClose,
}: {
  urls: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const hasPrev = index > 0;
  const hasNext = index < urls.length - 1;

  const prev = () => { if (hasPrev) onIndexChange(index - 1); };
  const next = () => { if (hasNext) onIndexChange(index + 1); };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) next(); else prev();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="fixed inset-0 z-[250] bg-black/95 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Преглед на снимка"
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/60 text-sm tabular-nums">{index + 1} / {urls.length}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-white active:bg-white/20"
          aria-label="Затвори"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-2 min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={urls[index]}
          src={urls[index]}
          alt={`Снимка ${index + 1}`}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
          draggable={false}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-4 shrink-0">
        <button
          type="button"
          onClick={prev}
          disabled={!hasPrev}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold disabled:opacity-20 active:bg-white/20"
        >
          <ChevronLeft className="w-4 h-4" />
          Предишна
        </button>
        <button
          type="button"
          onClick={next}
          disabled={!hasNext}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold disabled:opacity-20 active:bg-white/20"
        >
          Следваща
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
