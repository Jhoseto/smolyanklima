"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Sparkles, Search } from "lucide-react";
import type { LabelExtractResult, ModelSpecs } from "./LabelScanButton";

type Phase = "idle" | "checking_db" | "analyzing" | "success" | "error";

type Props = {
  brandId: string;
  brandName: string;
  modelCode: string;
  availableBrands?: string[] | null;
  excludeProductId?: string | null;
  /** Същият callback като LabelScanButton — mergeLabelExtract в ProductForm. */
  onExtracted: (result: LabelExtractResult) => void;
  disabled?: boolean;
};

type DbResponse = {
  data?: {
    source?: "db" | null;
    source_product_name?: string | null;
    model_specs?: ModelSpecs | null;
    refrigerant?: string | null;
  };
  error?: string;
};

function dbResultToLabelExtract(
  dbData: NonNullable<DbResponse["data"]>,
  brandName: string,
  modelCode: string,
): LabelExtractResult {
  return {
    from_label: {
      brand_hint: brandName,
      model_code: modelCode,
      refrigerant: dbData.refrigerant ?? null,
    },
    model_specs: dbData.model_specs ?? {},
    confidence_label: "high",
    confidence_specs: "high",
    source: dbData.source_product_name
      ? `Копирано от: ${dbData.source_product_name}`
      : "Копирано от съществуващ продукт в каталога",
  };
}

export function ModelSpecsLookupButton({
  brandId,
  brandName,
  modelCode,
  availableBrands,
  excludeProductId,
  onExtracted,
  disabled = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmedModel = modelCode.trim();
  const trimmedBrand = brandName.trim();
  const canLookup = Boolean(brandId && trimmedModel.length >= 2 && trimmedBrand.length >= 2);
  const isBusy = phase === "checking_db" || phase === "analyzing";

  async function handleLookup() {
    if (!canLookup || disabled) return;
    setErrorMsg(null);

    try {
      setPhase("checking_db");
      const dbUrl = new URL("/api/admin/products/specs-for-model", window.location.origin);
      dbUrl.searchParams.set("brandId", brandId);
      dbUrl.searchParams.set("modelCode", trimmedModel);
      if (excludeProductId) dbUrl.searchParams.set("excludeId", excludeProductId);

      const dbRes = await fetch(dbUrl.toString(), { credentials: "include" });
      const dbJson = (await dbRes.json().catch(() => ({}))) as DbResponse;
      if (!dbRes.ok) {
        throw new Error(dbJson.error || `Грешка при търсене в каталога (${dbRes.status}).`);
      }

      const dbData = dbJson.data;
      if (dbData?.source === "db" && dbData.model_specs) {
        onExtracted(dbResultToLabelExtract(dbData, trimmedBrand, trimmedModel));
        setPhase("success");
        setTimeout(() => setPhase((p) => (p === "success" ? "idle" : p)), 2500);
        return;
      }

      // Същият AI task като при сканиране на етикет — без снимка, само knownBrand + knownModel.
      setPhase("analyzing");
      await new Promise((r) => setTimeout(r, 80));

      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "product_label_extract",
          input: {
            whichUnit: "indoor",
            knownBrand: trimmedBrand,
            knownModel: trimmedModel,
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
      setPhase("success");
      setTimeout(() => setPhase((p) => (p === "success" ? "idle" : p)), 2500);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
      setTimeout(() => setPhase((p) => (p === "error" ? "idle" : p)), 4500);
    }
  }

  const disabledReason = !brandId
    ? "Попълни марка по-долу"
    : !trimmedModel
      ? "Попълни модел по-долу"
      : trimmedModel.length < 2
        ? "Моделът трябва да е поне 2 знака"
        : !trimmedBrand
          ? "Попълни марка по-долу"
          : undefined;

  return (
    <button
      type="button"
      onClick={() => void handleLookup()}
      disabled={disabled || !canLookup || isBusy}
      title={
        disabled
          ? "Попълването е изключено"
          : !canLookup
            ? disabledReason
            : `Попълни пълните технически данни за ${trimmedBrand} ${trimmedModel} — първо от каталога, после от AI (същият engine като при етикет).`
      }
      className={`flex items-center justify-center gap-2 w-full p-2.5 sm:p-3.5 rounded-xl border-2 transition-all text-center ${
        disabled || !canLookup
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
          : phase === "success"
            ? "bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-200"
            : phase === "error"
              ? "bg-red-50 border-red-300 text-red-900"
              : isBusy
                ? "bg-violet-50 border-violet-300 text-violet-900 ring-2 ring-violet-100"
                : "bg-gradient-to-r from-violet-50 via-white to-brand-blue-50 border-violet-200 text-violet-900 hover:from-violet-100 hover:border-violet-400 hover:shadow-md active:scale-[0.99]"
      }`}
    >
      <div
        className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg text-white shadow-sm shrink-0 ${
          disabled || !canLookup
            ? "bg-slate-300"
            : phase === "success"
              ? "bg-emerald-500"
              : phase === "error"
                ? "bg-red-500"
                : "bg-violet-500"
        }`}
      >
        {isBusy ? (
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
        ) : phase === "success" ? (
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : phase === "error" ? (
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </div>
      <div className="min-w-0 text-left flex-1">
        <div className="text-xs sm:text-sm font-bold leading-tight">
          {phase === "success"
            ? "Готово!"
            : phase === "error"
              ? "Опитай отново"
              : isBusy
                ? phase === "checking_db"
                  ? "Търся в каталога..."
                  : "AI чете спецификации..."
                : "Попълни по марка и модел"}
        </div>
        <div className="text-[10px] sm:text-xs font-normal opacity-80 leading-tight">
          {phase === "error"
            ? errorMsg ?? "Грешка при търсенето"
            : isBusy
              ? "Анализ ~5-10 сек"
              : !canLookup
                ? (disabledReason ?? "Попълни марка и модел по-долу")
                : "без снимка — същата AI логика като етикета"}
        </div>
      </div>
      {!isBusy && phase === "idle" && canLookup && !disabled && (
        <Sparkles className="w-4 h-4 text-violet-500 shrink-0 hidden sm:block" />
      )}
    </button>
  );
}
