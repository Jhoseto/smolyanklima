import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';

type Props = {
  images: string[];
  alt: string;
  badgeText?: string;
  badgeClassName?: string;
  energyClass?: string;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function PremiumImageGallery({ images, alt, badgeText, badgeClassName, energyClass, className }: Props) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const mainRef = useRef<HTMLButtonElement | null>(null);

  const count = safeImages.length || 1;
  const currentIdx = clamp(idx, 0, count - 1);
  const current = safeImages[currentIdx] || '/images/hero-ac.jpg';

  const setSafeIdx = (next: number) => setIdx(clamp(next, 0, count - 1));
  const prev = () => setSafeIdx(currentIdx - 1);
  const next = () => setSafeIdx(currentIdx + 1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentIdx, count]);

  const showThumbs = safeImages.length > 1;

  return (
    <div className={className}>
      <div className="relative rounded-[2.5rem] border border-gray-100 bg-gradient-to-b from-gray-50 to-white shadow-[0_18px_60px_rgba(0,0,0,.06)] overflow-hidden">
        {/* Top chrome */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/[0.06] to-transparent pointer-events-none" />

        {badgeText && (
          <span
            className={
              badgeClassName ||
              'absolute top-6 left-6 px-4 py-1.5 rounded-full text-xs font-black shadow-sm bg-yellow-100 text-yellow-700'
            }
          >
            {badgeText}
          </span>
        )}

        {energyClass && (
          <span className="absolute top-6 right-6 bg-green-500 text-white text-sm font-black px-4 py-1.5 rounded-full shadow-md">
            {energyClass}
          </span>
        )}

        {/* Main */}
        <button
          ref={mainRef}
          type="button"
          onClick={() => setOpen(true)}
          className="relative w-full aspect-square p-8 md:p-10 flex items-center justify-center group focus:outline-none"
          aria-label="Отвори галерия"
        >
          <motion.img
            key={current}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22 }}
            src={imgError[currentIdx] ? '/images/hero-ac.jpg' : current}
            alt={alt}
            onError={() => setImgError((m) => ({ ...m, [currentIdx]: true }))}
            className="w-full h-full object-contain mix-blend-multiply drop-shadow-[0_30px_70px_rgba(0,0,0,.12)] group-hover:scale-[1.03] transition-transform duration-500"
          />

          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,180,216,0.18),rgba(255,255,255,0)_55%)]" />
          </div>

          <div className="absolute bottom-6 left-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-gray-200 text-xs font-black text-gray-800 shadow-sm">
              <Expand className="w-4 h-4 text-[#00B4D8]" />
              Увеличи
            </span>
          </div>
        </button>

        {/* Arrows */}
        {showThumbs && (
          <>
            <button
              type="button"
              onClick={prev}
              disabled={currentIdx === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-lg flex items-center justify-center text-gray-700 hover:text-[#00B4D8] hover:border-[#00B4D8] transition disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
              aria-label="Предишна снимка"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={currentIdx === count - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-lg flex items-center justify-center text-gray-700 hover:text-[#00B4D8] hover:border-[#00B4D8] transition disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
              aria-label="Следваща снимка"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Thumbs */}
        {showThumbs && (
          <div className="px-6 pb-6">
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {safeImages.slice(0, 10).map((src, i) => {
                const active = i === currentIdx;
                return (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={() => setSafeIdx(i)}
                    className={`relative shrink-0 w-16 h-16 rounded-2xl border overflow-hidden bg-white shadow-sm transition ${
                      active ? 'border-[#00B4D8] ring-2 ring-[#00B4D8]/20' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    aria-label={`Снимка ${i + 1}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                    {active && <div className="absolute inset-0 bg-[#00B4D8]/5" />}
                  </button>
                );
              })}
              {safeImages.length > 10 && (
                <div className="shrink-0 w-16 h-16 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-black text-gray-600">
                  +{safeImages.length - 10}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[800]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed inset-4 md:inset-10 z-[801] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Галерия"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="text-sm font-black text-gray-800">
                  {currentIdx + 1} / {count}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                  aria-label="Затвори"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              <div className="relative flex-1 bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
                <img
                  src={imgError[currentIdx] ? '/images/hero-ac.jpg' : current}
                  alt={alt}
                  className="max-w-full max-h-full object-contain mix-blend-multiply drop-shadow-[0_40px_100px_rgba(0,0,0,.14)]"
                />

                {showThumbs && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      disabled={currentIdx === 0}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-lg flex items-center justify-center text-gray-700 hover:text-[#00B4D8] hover:border-[#00B4D8] transition disabled:opacity-30"
                      aria-label="Предишна снимка"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      disabled={currentIdx === count - 1}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-lg flex items-center justify-center text-gray-700 hover:text-[#00B4D8] hover:border-[#00B4D8] transition disabled:opacity-30"
                      aria-label="Следваща снимка"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {showThumbs && (
                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {safeImages.map((src, i) => {
                      const active = i === currentIdx;
                      return (
                        <button
                          key={`lb-${src}-${i}`}
                          type="button"
                          onClick={() => setSafeIdx(i)}
                          className={`shrink-0 w-14 h-14 rounded-2xl border overflow-hidden bg-white transition ${
                            active ? 'border-[#00B4D8] ring-2 ring-[#00B4D8]/20' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          aria-label={`Снимка ${i + 1}`}
                        >
                          <img src={src} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

