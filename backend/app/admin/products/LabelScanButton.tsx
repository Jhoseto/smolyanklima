"use client";

/**
 * Бутон за сканиране на етикет на климатик — камера ИЛИ качване от галерия.
 *
 * Два отделни file input-а:
 *  - `capture="environment"` → директно отваря камерата (задна на телефона).
 *  - без `capture` → избор от галерия/файлове.
 *
 * ВАЖНО за поверителност:
 *  - Снимката се компресира локално в браузъра (canvas).
 *  - Изпраща се като base64 само към `/api/admin/ai` (inlineData към Gemini).
 *  - НЕ се качва в Cloudinary, НЕ се записва в базата, НЕ остава в audit лога.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Loader2, CheckCircle2, AlertTriangle, ImagePlus, X } from "lucide-react";
import { compressImage, validateImageFile } from "@/lib/photos/compressImage";

export type ModelSpecs = {
  coverage_m2?: number | null;
  noise_db?: number | null;
  cooling_power_kw?: number | null;
  heating_power_kw?: number | null;
  energy_class_cool?: string | null;
  energy_class_heat?: string | null;
  seer?: number | null;
  scop?: number | null;
  warranty_months?: number | null;
  wifi?: boolean | null;
  weight_indoor_kg?: number | null;
  weight_outdoor_kg?: number | null;
  dim_indoor_length_mm?: number | null;
  dim_indoor_width_mm?: number | null;
  dim_indoor_height_mm?: number | null;
  dim_outdoor_length_mm?: number | null;
  dim_outdoor_width_mm?: number | null;
  dim_outdoor_height_mm?: number | null;
};

export type LabelExtractResult = {
  from_label: {
    brand_hint?: string | null;
    model_code?: string | null;
    alt_model_codes?: string[] | null;
    indoor_unit_serial?: string | null;
    outdoor_unit_serial?: string | null;
    refrigerant?: string | null;
    refrigerant_amount_g?: number | null;
    voltage?: string | null;
    manufacture_year?: number | null;
  };
  model_specs: ModelSpecs;
  confidence_label: "high" | "medium" | "low" | "none";
  confidence_specs: "high" | "medium" | "low" | "none";
  source?: string | null;
  warnings?: string[];
};

type Phase = "idle" | "compressing" | "uploading" | "analyzing" | "success" | "error";

type Props = {
  whichUnit: "indoor" | "outdoor";
  knownBrand?: string | null;
  knownModel?: string | null;
  availableBrands?: string[] | null;
  onExtracted: (result: LabelExtractResult) => void;
  /** Известява родителя кога този scan е активен — за блокиране на паралелни scan-ове. */
  onBusyChange?: (busy: boolean) => void;
  variant?: "prominent" | "compact";
  children?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
};

function LabelScanInputs({
  cameraRef,
  galleryRef,
  onFile,
}: {
  cameraRef: React.RefObject<HTMLInputElement | null>;
  galleryRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void onFile(f);
    e.target.value = "";
  }

  const accept = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/*";

  return (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input ref={galleryRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
    </>
  );
}

export function LabelScanButton({
  whichUnit,
  knownBrand,
  knownModel,
  availableBrands,
  onExtracted,
  onBusyChange,
  variant = "prominent",
  children,
  disabled = false,
  disabledReason,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const processingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState<{ label: string; specs: string } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const unitLabelBg = whichUnit === "indoor" ? "вътрешно тяло" : "външно тяло";
  const isBusy = phase === "compressing" || phase === "uploading" || phase === "analyzing";
  const isInteractive = !disabled && !isBusy && (phase === "idle" || phase === "error");

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const safeSetPhase = (next: Phase | ((p: Phase) => Phase)) => {
    if (!mountedRef.current) return;
    setPhase(next);
  };

  const schedulePhaseReset = (from: Phase, to: Phase, ms: number) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      safeSetPhase((p) => (p === from ? to : p));
    }, ms);
  };

  function cancelScan() {
    abortRef.current?.abort();
    abortRef.current = null;
    processingRef.current = false;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
    setErrorMsg(null);
    safeSetPhase("idle");
  }

  async function handleFile(file: File) {
    if (processingRef.current || disabled) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      safeSetPhase("error");
      schedulePhaseReset("error", "idle", 4500);
      return;
    }

    processingRef.current = true;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setErrorMsg(null);
    setLastConfidence(null);
    try {
      safeSetPhase("compressing");
      const compressed = await compressImage(file, { maxLongEdge: 2048, quality: 0.85 });
      if (signal.aborted || !mountedRef.current) {
        processingRef.current = false;
        return;
      }

      safeSetPhase("uploading");
      await new Promise((r) => setTimeout(r, 80));
      if (signal.aborted || !mountedRef.current) return;

      safeSetPhase("analyzing");

      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          task: "product_label_extract",
          input: {
            imageBase64: compressed.base64,
            imageMimeType: compressed.mimeType,
            whichUnit,
            knownBrand: knownBrand || null,
            knownModel: knownModel || null,
            availableBrands: availableBrands && availableBrands.length > 0 ? availableBrands : null,
          },
        }),
      });

      if (signal.aborted || !mountedRef.current) return;

      const json = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        throw new Error(((json as { error?: string }).error) || `AI заявката се провали (${res.status}).`);
      }

      const data = (json as { data?: LabelExtractResult }).data;
      if (!data || typeof data !== "object" || !data.from_label || !data.model_specs) {
        throw new Error("AI върна неочакван формат. Опитай отново.");
      }

      onExtracted(data);
      setLastConfidence({ label: data.confidence_label, specs: data.confidence_specs });
      safeSetPhase("success");
      schedulePhaseReset("success", "idle", 2500);
    } catch (e) {
      if (signal.aborted || !mountedRef.current) return;
      const raw = e instanceof Error ? e.message : String(e);
      if (e instanceof Error && e.name === "AbortError") return;
      const friendly =
        /createImageBitmap|ImageBitmap|decode/i.test(raw)
          ? "Браузърът не може да прочете този формат. Опитай JPEG/PNG или снимай директно с камерата."
          : raw;
      setErrorMsg(friendly);
      safeSetPhase("error");
      schedulePhaseReset("error", "idle", 4500);
    } finally {
      if (!signal.aborted) {
        processingRef.current = false;
        abortRef.current = null;
      }
    }
  }

  function openCamera() {
    if (!isInteractive) return;
    cameraInputRef.current?.click();
  }

  function openGallery() {
    if (!isInteractive) return;
    galleryInputRef.current?.click();
  }

  const statusTitle =
    phase === "success"
      ? "Готово!"
      : phase === "error"
        ? "Опитай отново"
        : isBusy
          ? phase === "compressing"
            ? "Подготвям снимката..."
            : phase === "uploading"
              ? "Изпращам..."
              : "AI чете етикета..."
          : whichUnit === "indoor"
            ? "Етикет вътрешно тяло"
            : "Етикет външно тяло";

  const statusSubtitle =
    phase === "success" && lastConfidence
      ? confidenceLabel(lastConfidence)
      : phase === "error"
        ? errorMsg ?? "Грешка при анализа"
        : isBusy
          ? "Анализ ~5-10 сек"
          : whichUnit === "indoor"
            ? "сериен + модел + пълни спецификации"
            : "сериен номер на външното тяло";

  const accent =
    whichUnit === "indoor"
      ? {
          idleBorder: "border-brand-blue-200",
          idleBg: "from-brand-blue-50 to-white",
          idleHover: "hover:from-brand-blue-100 hover:border-brand-blue-400",
          iconBg: "bg-brand-blue-500",
          btn: "bg-brand-blue-50 text-brand-blue-800 border-brand-blue-200 hover:bg-brand-blue-100 hover:border-brand-blue-300",
        }
      : {
          idleBorder: "border-brand-orange-200",
          idleBg: "from-brand-orange-50 to-white",
          idleHover: "hover:from-brand-orange-100 hover:border-brand-orange-400",
          iconBg: "bg-brand-orange-500",
          btn: "bg-brand-orange-50 text-brand-orange-800 border-brand-orange-200 hover:bg-brand-orange-100 hover:border-brand-orange-300",
        };

  const cancelButton = isBusy ? (
    <button
      type="button"
      onClick={cancelScan}
      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] sm:text-xs font-bold hover:bg-slate-50 active:scale-[0.98] transition-all"
    >
      <X className="w-3.5 h-3.5" />
      Отказ
    </button>
  ) : null;

  if (variant === "compact") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <LabelScanInputs cameraRef={cameraInputRef} galleryRef={galleryInputRef} onFile={handleFile} />
        <div className="inline-flex items-center gap-1 flex-wrap justify-end">
          {isBusy ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-brand-blue-50 text-brand-blue-700 border border-brand-blue-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {phase === "compressing" ? "Обработка..." : phase === "uploading" ? "Качване..." : "AI чете..."}
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={openCamera}
                disabled={!isInteractive}
                title={
                  disabled
                    ? disabledReason ?? "Скенирането е изключено"
                    : `Снимай етикета на ${unitLabelBg} с камерата. Снимките не се запазват.`
                }
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap border ${
                  disabled
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                    : phase === "success"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : phase === "error"
                        ? "bg-red-100 text-red-800 border-red-300"
                        : accent.btn
                }`}
              >
                {phase === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : phase === "error" ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                {children ?? (phase === "success" ? "Готово" : phase === "error" ? "Грешка" : "Снимай")}
              </button>
              {isInteractive && !disabled && (
                <button
                  type="button"
                  onClick={openGallery}
                  title={`Качи снимка на етикета на ${unitLabelBg} от галерията.`}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap border ${accent.btn}`}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Качи
                </button>
              )}
            </>
          )}
          {cancelButton}
        </div>
        {phase === "error" && errorMsg && (
          <p className="text-[10px] text-red-700 leading-snug max-w-[14rem] text-right" title={errorMsg}>
            {errorMsg}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <LabelScanInputs cameraRef={cameraInputRef} galleryRef={galleryInputRef} onFile={handleFile} />
      <div
        className={`flex flex-col items-center justify-center gap-1.5 max-md:gap-1 p-2.5 max-md:py-2 sm:p-4 rounded-xl max-md:rounded-lg border-2 transition-all w-full text-center ${
          disabled
            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
            : phase === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-200"
              : phase === "error"
                ? "bg-red-50 border-red-300 text-red-900"
                : isBusy
                  ? "bg-brand-blue-50 border-brand-blue-300 text-brand-blue-900 ring-2 ring-brand-blue-100"
                  : `bg-gradient-to-br ${accent.idleBg} ${accent.idleBorder} text-slate-900 ${accent.idleHover} hover:shadow-md`
        }`}
      >
        <div
          className={`flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl text-white shadow-sm ${
            disabled
              ? "bg-slate-300"
              : phase === "success"
                ? "bg-emerald-500"
                : phase === "error"
                  ? "bg-red-500"
                  : isBusy
                    ? "bg-brand-blue-500"
                    : accent.iconBg
          }`}
        >
          {isBusy ? (
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
          ) : phase === "success" ? (
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : phase === "error" ? (
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </div>

        <div className="text-xs sm:text-base font-bold leading-tight">{statusTitle}</div>
        <div className="text-[10px] sm:text-xs font-normal opacity-80 leading-tight px-0.5">{statusSubtitle}</div>

        {isInteractive && (
          <div className="grid grid-cols-2 gap-2 w-full mt-1">
            <button
              type="button"
              onClick={openCamera}
              className={`inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:py-2.5 rounded-lg border-2 text-xs sm:text-sm font-bold transition-all active:scale-[0.98] ${accent.btn}`}
            >
              <Camera className="w-4 h-4 shrink-0" />
              Снимай
            </button>
            <button
              type="button"
              onClick={openGallery}
              className="inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:py-2.5 rounded-lg border-2 border-slate-200 bg-white text-slate-800 text-xs sm:text-sm font-bold transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
            >
              <ImagePlus className="w-4 h-4 shrink-0" />
              Качи снимка
            </button>
          </div>
        )}

        {cancelButton && <div className="mt-1">{cancelButton}</div>}
      </div>
    </>
  );
}

function confidenceLabel(c: { label: string; specs: string }): string {
  const map: Record<string, string> = { high: "висока", medium: "средна", low: "ниска", none: "няма" };
  return `Точност: текст ${map[c.label] ?? c.label}, спецификации ${map[c.specs] ?? c.specs}`;
}
