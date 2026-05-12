"use client";

/**
 * Бутон за сканиране на етикет на климатик с камера ИЛИ от галерия.
 *
 * Поведение на input-а:
 *  - НЯМА `capture` атрибут → браузърите показват native picker, който
 *    позволява И двете опции: „Снимай сега“ ИЛИ „Избери от галерия/файл“.
 *    Това работи навсякъде (iOS Safari, Android Chrome, desktop).
 *  - На phone-а ще се покаже системно меню „Camera | Photo Library | File“.
 *  - На desktop-а — стандартен file dialog.
 *
 * ВАЖНО за поверителност:
 *  - Снимката се компресира локално в браузъра (canvas).
 *  - Изпраща се като base64 само към `/api/admin/ai` (inlineData към Gemini).
 *  - НЕ се качва в Cloudinary, НЕ се записва в базата, НЕ остава в audit лога.
 *  - След като AI върне JSON, base64 е garbage-collect-нат → нула storage.
 */

import { useRef, useState, type ReactNode } from "react";
import { Camera, Loader2, CheckCircle2, AlertTriangle, Sparkles, ImagePlus } from "lucide-react";
import { compressImage } from "@/lib/photos/compressImage";

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
  model_specs: {
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
  confidence_label: "high" | "medium" | "low" | "none";
  confidence_specs: "high" | "medium" | "low" | "none";
  source?: string | null;
  warnings?: string[];
};

type Phase = "idle" | "compressing" | "uploading" | "analyzing" | "success" | "error";

type Props = {
  whichUnit: "indoor" | "outdoor";
  /** Hints от вече попълнените полета — повишават точността при втора снимка. */
  knownBrand?: string | null;
  knownModel?: string | null;
  /** Имената на марките в нашата база — AI ще се опита да върне ТОЧНОТО име
   *  от този списък, за да направим веднага точен match (вместо да
   *  правим heuristic mapping от „Mitsubishi“ → „Mitsubishi Electric“). */
  availableBrands?: string[] | null;
  /** Callback с резултата — родителят прави merge в основния form. */
  onExtracted: (result: LabelExtractResult) => void;
  /** „prominent" = голям бутон за начален flow; „compact" = малък бутон до серията. */
  variant?: "prominent" | "compact";
  /** Опционално override на icon/label. */
  children?: ReactNode;
  /** Disabled (напр. ако вече има попълнен сериен номер за това тяло). */
  disabled?: boolean;
  /** Disabled-причина за tooltip. */
  disabledReason?: string;
};

export function LabelScanButton({
  whichUnit,
  knownBrand,
  knownModel,
  availableBrands,
  onExtracted,
  variant = "prominent",
  children,
  disabled = false,
  disabledReason,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState<{ label: string; specs: string } | null>(null);

  const unitLabelBg = whichUnit === "indoor" ? "вътрешно тяло" : "външно тяло";

  async function handleFile(file: File) {
    setErrorMsg(null);
    setLastConfidence(null);
    try {
      setPhase("compressing");
      const compressed = await compressImage(file, { maxLongEdge: 2048, quality: 0.85 });

      setPhase("uploading");
      // Малък throttle — UI да покаже „uploading" преди да започне fetch.
      await new Promise((r) => setTimeout(r, 80));

      setPhase("analyzing");
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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
      setPhase("success");
      // Reset бутона след 2.5s — да изчезне „зеленото потвърждение" и да позволи нов скан.
      setTimeout(() => {
        setPhase((p) => (p === "success" ? "idle" : p));
      }, 2500);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
      setTimeout(() => {
        setPhase((p) => (p === "error" ? "idle" : p));
      }, 4500);
    }
  }

  function openCamera() {
    if (disabled) return;
    inputRef.current?.click();
  }

  const isBusy = phase === "compressing" || phase === "uploading" || phase === "analyzing";

  if (variant === "compact") {
    return (
      <>
        {/* БЕЗ `capture` — отваря native picker: камера ИЛИ галерия по избор. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={openCamera}
          disabled={disabled || isBusy}
          title={
            disabled
              ? disabledReason ?? "Скенирането е изключено"
              : `Снимай или избери снимка на етикета на ${unitLabelBg} → AI попълва серийния номер и пълните спецификации. Снимките не се запазват.`
          }
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap ${
            disabled
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : phase === "success"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : phase === "error"
                  ? "bg-red-100 text-red-800 border border-red-300"
                  : "bg-brand-blue-50 text-brand-blue-700 border border-brand-blue-200 hover:bg-brand-blue-100 hover:border-brand-blue-300"
          }`}
        >
          {isBusy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : phase === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : phase === "error" ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          {children ?? (
            isBusy
              ? phase === "compressing"
                ? "Обработка..."
                : phase === "uploading"
                  ? "Качване..."
                  : "AI чете..."
              : phase === "success"
                ? "Готово"
                : phase === "error"
                  ? "Грешка"
                  : "Скан"
          )}
        </button>
      </>
    );
  }

  // Prominent variant — голяма CTA на върха на формата.
  return (
    <>
      {/* БЕЗ `capture` — потребителят сам избира „Снимай сега“ или „От галерия“. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={openCamera}
        disabled={disabled || isBusy}
        className={`flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 rounded-2xl border-2 transition-all w-full text-center ${
          disabled
            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
            : phase === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-200"
              : phase === "error"
                ? "bg-red-50 border-red-300 text-red-900"
                : isBusy
                  ? "bg-brand-blue-50 border-brand-blue-300 text-brand-blue-900 ring-2 ring-brand-blue-100"
                  : whichUnit === "indoor"
                    ? "bg-gradient-to-br from-brand-blue-50 to-white border-brand-blue-200 text-brand-blue-900 hover:from-brand-blue-100 hover:border-brand-blue-400 hover:shadow-md active:scale-[0.98]"
                    : "bg-gradient-to-br from-brand-orange-50 to-white border-brand-orange-200 text-brand-orange-900 hover:from-brand-orange-100 hover:border-brand-orange-400 hover:shadow-md active:scale-[0.98]"
        }`}
      >
        <div
          className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl text-white shadow-sm ${
            disabled
              ? "bg-slate-300"
              : phase === "success"
                ? "bg-emerald-500"
                : phase === "error"
                  ? "bg-red-500"
                  : isBusy
                    ? "bg-brand-blue-500"
                    : whichUnit === "indoor"
                      ? "bg-brand-blue-500"
                      : "bg-brand-orange-500"
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
        <div className="text-sm sm:text-base font-bold leading-tight">
          {phase === "success"
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
                  : "Етикет външно тяло"}
        </div>
        <div className="text-[11px] sm:text-xs font-normal opacity-80 leading-tight">
          {phase === "success" && lastConfidence
            ? confidenceLabel(lastConfidence)
            : phase === "error"
              ? errorMsg ?? "Грешка при анализа"
              : isBusy
                ? "Анализ ~5-10 сек"
                : whichUnit === "indoor"
                  ? "сериен + модел + пълни спецификации"
                  : "сериен номер на външното тяло"}
        </div>
        {!isBusy && phase === "idle" && !disabled && (
          <div className="inline-flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1">
              <Camera className="w-3 h-3" /> снимай
            </span>
            <span className="text-slate-300">/</span>
            <span className="inline-flex items-center gap-1">
              <ImagePlus className="w-3 h-3" /> галерия
            </span>
          </div>
        )}
      </button>
    </>
  );
}

function confidenceLabel(c: { label: string; specs: string }): string {
  const map: Record<string, string> = { high: "висока", medium: "средна", low: "ниска", none: "няма" };
  return `Точност: текст ${map[c.label] ?? c.label}, спецификации ${map[c.specs] ?? c.specs}`;
}
