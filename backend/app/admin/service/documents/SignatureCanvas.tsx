"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { X, RotateCcw, Check } from "lucide-react";

interface Props {
  label: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
  existing?: string | null;
}

export function SignatureCanvas({ label, onSave, onClose, existing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [isEmpty, setIsEmpty]   = useState(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // ── Inicializacia ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Размери — цял viewport
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      // Ако има съществуващ подпис — презареди го
      if (existing) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
        img.src = existing;
        setIsEmpty(false);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Помощни функции ───────────────────────────────────────────────────────

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getCtx = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    return ctx;
  };

  // ── Рисуване ──────────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    setIsEmpty(false);
    lastPos.current = getPos(e);
    const ctx = getCtx();
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !lastPos.current) return;
    const pos = getPos(e);
    const ctx = getCtx();
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [drawing]);

  const onPointerUp = useCallback(() => {
    setDrawing(false);
    lastPos.current = null;
  }, []);

  // ── Изчисти ───────────────────────────────────────────────────────────────

  const clear = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    setIsEmpty(true);
  }, []);

  // ── Запази ────────────────────────────────────────────────────────────────

  const save = useCallback(() => {
    const canvas = canvasRef.current!;
    // Компресирана PNG с качество 0.85
    const dataUrl = canvas.toDataURL("image/png", 0.85);
    onSave(dataUrl);
  }, [onSave]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0 safe-top">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-slate-300 active:text-white"
        >
          <X className="w-5 h-5" />
          <span>Отказ</span>
        </button>

        <p className="text-sm font-semibold text-center truncate max-w-[180px]">{label}</p>

        <div className="flex gap-3">
          <button
            onClick={clear}
            className="flex items-center gap-1.5 text-sm text-slate-300 active:text-white"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="hidden sm:inline">Изчисти</span>
          </button>
          <button
            onClick={save}
            disabled={isEmpty}
            className="flex items-center gap-1.5 text-sm bg-blue-600 disabled:bg-slate-600 text-white px-3 py-1.5 rounded-lg font-semibold active:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            <span>Запази</span>
          </button>
        </div>
      </div>

      {/* ── Насока ── */}
      <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-500 text-center shrink-0">
        Подпишете се с пръст в полето по-долу
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ touchAction: "none", cursor: "crosshair", display: "block" }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl px-10 py-8 text-center">
              <p className="text-slate-300 text-base">Подпишете тук</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
