"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../ui";

type Props = {
  imageSrc: string;
  onCancel: () => void;
  /** Изрязан JPEG, готов за Cloudinary. */
  onConfirm: (file: File) => void | Promise<void>;
};

const VIEW = 280;
const OUT = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Неуспешно зареждане на изображението"));
    img.src = src;
  });
}

function computeLayout(
  iw: number,
  ih: number,
  zoom: number,
  panX: number,
  panY: number,
) {
  const cover = Math.max(VIEW / iw, VIEW / ih);
  const scale = cover * zoom;
  const dispW = iw * scale;
  const dispH = ih * scale;
  const left0 = (VIEW - dispW) / 2;
  const top0 = (VIEW - dispH) / 2;
  const left = left0 + panX;
  const top = top0 + panY;
  return { dispW, dispH, left, top, iw, ih };
}

function clampPan(
  panX: number,
  panY: number,
  dispW: number,
  dispH: number,
): { x: number; y: number } {
  const halfRangeX = Math.max(0, (dispW - VIEW) / 2);
  const halfRangeY = Math.max(0, (dispH - VIEW) / 2);
  return {
    x: Math.min(halfRangeX, Math.max(-halfRangeX, panX)),
    y: Math.min(halfRangeY, Math.max(-halfRangeY, panY)),
  };
}

async function renderCroppedJpeg(
  img: HTMLImageElement,
  zoom: number,
  panX: number,
  panY: number,
): Promise<File> {
  const { dispW, dispH, left, top, iw, ih } = computeLayout(img.naturalWidth, img.naturalHeight, zoom, panX, panY);
  const canvas = document.createElement("canvas");
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas не е наличен");

  const k = OUT / VIEW;
  ctx.save();
  ctx.scale(k, k);
  ctx.beginPath();
  ctx.arc(VIEW / 2, VIEW / 2, VIEW / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 0, 0, iw, ih, left, top, dispW, dispH);
  ctx.restore();

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Неуспешен износ"));
          return;
        }
        resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function StaffAvatarCropModal({ imageSrc, onCancel, onConfirm }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const drag = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const panRef = useRef(pan);
  panRef.current = pan;

  useEffect(() => {
    let cancelled = false;
    void loadImage(imageSrc).then(
      (i) => {
        if (!cancelled) {
          setImg(i);
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      },
      () => {
        if (!cancelled) setLoadErr("Неуспешно зареждане на файла");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const layout = useMemo(() => {
    if (!img) return null;
    return computeLayout(img.naturalWidth, img.naturalHeight, zoom, pan.x, pan.y);
  }, [img, zoom, pan.x, pan.y]);

  const setPanClamped = useCallback(
    (nx: number, ny: number) => {
      if (!img) return;
      const { dispW, dispH } = computeLayout(img.naturalWidth, img.naturalHeight, zoom, 0, 0);
      setPan(clampPan(nx, ny, dispW, dispH));
    },
    [img, zoom],
  );

  useEffect(() => {
    if (!img) return;
    const { dispW, dispH } = computeLayout(img.naturalWidth, img.naturalHeight, zoom, 0, 0);
    setPan((p) => clampPan(p.x, p.y, dispW, dispH));
  }, [zoom, img]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: panRef.current.x,
      origY: panRef.current.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current?.active) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    setPanClamped(drag.current.origX + dx, drag.current.origY + dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
    drag.current = null;
  };

  const handleZoom = (delta: number) => {
    setZoom((z) => Math.min(3, Math.max(1, Math.round((z + delta) * 100) / 100)));
  };

  const handleApply = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const file = await renderCroppedJpeg(img, zoom, pan.x, pan.y);
      await onConfirm(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Позициониране на профилна снимка"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Позиционирай снимката</h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loadErr ? (
            <p className="text-sm text-red-600">{loadErr}</p>
          ) : !img ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-brand-blue-600" />
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-500 leading-snug">
                Влачи снимката и ползвай мащаба. Кръгът показва как ще изглежда профилът.
              </p>

              <div className="flex justify-center">
                <div
                  className="relative touch-none select-none rounded-full bg-slate-900 shadow-inner ring-2 ring-slate-300"
                  style={{ width: VIEW, height: VIEW }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <div
                    className="absolute inset-0 overflow-hidden rounded-full cursor-grab active:cursor-grabbing"
                    style={{ width: VIEW, height: VIEW }}
                  >
                    {layout ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageSrc}
                        alt=""
                        draggable={false}
                        className="absolute max-w-none max-h-none"
                        style={{
                          width: layout.dispW,
                          height: layout.dispH,
                          left: layout.left,
                          top: layout.top,
                        }}
                      />
                    ) : null}
                  </div>
                  <div
                    className="pointer-events-none absolute inset-0 rounded-full ring-[10px] ring-black/25 ring-inset"
                    aria-hidden
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  onClick={() => handleZoom(-0.08)}
                  aria-label="Намали"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-brand-blue-600"
                  aria-label="Мащаб"
                />
                <button
                  type="button"
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  onClick={() => handleZoom(0.08)}
                  aria-label="Увеличи"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/80">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={busy}>
            Отказ
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => void handleApply()}
            disabled={busy || !img || !!loadErr}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Приложи"}
          </Button>
        </div>
      </div>
    </div>
  );
}
