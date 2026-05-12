"use client";

/**
 * Multi-photo upload компонент за продуктовата форма.
 *
 * Поведение:
 *  1. Един бутон „Снимай / Избери снимки“ — отваря native picker (камера ИЛИ
 *     галерия). На phone-а ще се покаже системно меню „Camera | Photos | Files“.
 *  2. След избор, снимките попадат в локален „pending“ списък и се показват
 *     като thumbnails (preview) — НЕ са качени в Cloudinary все още.
 *  3. Максимален лимит — MAX_PRODUCT_IMAGES (4) за продукт. Ако вече има
 *     качени, оставащите слотове се отчитат.
 *  4. Бутон „Качи снимките“ — bulk upload към Cloudinary в папка по
 *     модела (brand + model_code). При успех URL-ите се добавят към
 *     основния form state.
 *  5. Защита: parent компонентът се известява чрез `onPendingChange`, така
 *     че save-action-ът може да предупреди, ако pending > 0.
 *
 * Поверителност / съхранение:
 *  - Снимките се качват в Cloudinary с auto-оптимизация (q_auto, f_auto)
 *    в отделна папка с името на модела (споделена между инстанции).
 *  - Re-use: ако вече има снимки за същия (brand, model_code) в каталога,
 *    показва се панел „Този модел вече има N снимки“ + бутон „Линкни ги“.
 */

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, Upload, CheckCircle2, AlertTriangle, Sparkles, Link2 } from "lucide-react";

type Props = {
  brandSlug: string | null | undefined;
  modelCode: string;
  productSlug: string;
  cloudinaryKind: "product" | "accessory";
  /** Колко още снимки могат да се добавят (MAX - вече качени). */
  remainingSlots: number;
  /** Callback при успешно качване — добавя URL-ите към form.images. */
  onUploaded: (urls: string[]) => void;
  /** Известява родителя за pending count — за save-protection. */
  onPendingChange: (count: number) => void;
  /** Pre-fetched URL-ите от съществуващ продукт със същия модел (или null). */
  reusableImages?: Array<{ url: string; sort_order?: number; is_main?: boolean }> | null;
  /** Името на продукта-източник на reusableImages — за UI обяснение. */
  reusableFromName?: string | null;
  /** Callback за linking на reusable снимки в текущия продукт. */
  onLinkReusable?: () => void;
};

type Pending = {
  id: string;
  file: File;
  previewUrl: string;
  status: "ready" | "uploading" | "done" | "error";
  errorMsg?: string;
};

export const MAX_PRODUCT_IMAGES = 4;

export function ProductPhotoUploader({
  brandSlug,
  modelCode,
  productSlug,
  cloudinaryKind,
  remainingSlots,
  onUploaded,
  onPendingChange,
  reusableImages,
  reusableFromName,
  onLinkReusable,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  // Revoke object URLs at unmount, за да не теча в паметта.
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Не пускам known onPendingChange в useEffect deps — извикваме го синхронно
  // вътре в state setters за да избегнем стария-снимков closure problem.

  function notifyPending(next: Pending[]) {
    onPendingChange(next.length);
  }

  function openPicker() {
    if (uploading) return;
    if (remainingSlots - pending.length <= 0) {
      setGlobalError(`Достигнат е лимитът от ${MAX_PRODUCT_IMAGES} снимки на продукт.`);
      return;
    }
    inputRef.current?.click();
  }

  function handleFilesIn(filesIn: FileList | File[]) {
    const filesArr = Array.from(filesIn);
    const available = Math.max(0, remainingSlots - pending.length);
    if (available <= 0) {
      setGlobalError(`Достигнат е лимитът от ${MAX_PRODUCT_IMAGES} снимки на продукт.`);
      return;
    }
    const accepted = filesArr.slice(0, available);
    const overflow = filesArr.length - accepted.length;
    if (overflow > 0) {
      setGlobalError(`Качени са само първите ${accepted.length} снимки (макс. ${MAX_PRODUCT_IMAGES}).`);
    } else {
      setGlobalError(null);
    }
    const newPending: Pending[] = accepted
      .filter((f) => /^image\//.test(f.type))
      .map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: "ready",
      }));
    setPending((prev) => {
      const next = [...prev, ...newPending];
      notifyPending(next);
      return next;
    });
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((p) => p.id !== id);
      notifyPending(next);
      return next;
    });
  }

  function clearAllPending() {
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
    notifyPending([]);
    setGlobalError(null);
  }

  /**
   * Изгражда подходящия Cloudinary folder key:
   *  - Ако имаме (brand, model_code) → споделена папка с името на модела
   *    (тогава различни инстанции на същия модел ще ползват едни и същи
   *    снимки от Cloudinary, без дублиране).
   *  - Иначе → fallback към product slug (за legacy продукти без model_code).
   */
  function resolveFolderKey(): { key: string; warning: string | null } {
    const mc = modelCode.trim();
    if (mc) {
      const cleanBrand = String(brandSlug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const cleanModel = mc.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const combined = cleanBrand ? `${cleanBrand}-${cleanModel}` : cleanModel;
      if (combined.length >= 2) return { key: combined, warning: null };
    }
    const fallback = productSlug.trim();
    if (fallback.length >= 2) {
      return { key: fallback, warning: "Папката се определя по slug. По-добре попълни марка + модел за обединяване с други инстанции на същия модел." };
    }
    return { key: "", warning: "Попълни марка + модел (или slug) преди качването." };
  }

  async function uploadAll() {
    if (pending.length === 0) return;
    const { key: folderKey, warning } = resolveFolderKey();
    if (!folderKey) {
      setGlobalError(warning ?? "Не може да се изгради папка за качване.");
      return;
    }
    setUploading(true);
    setGlobalError(null);
    setSuccessNote(null);
    setProgress({ done: 0, total: pending.length });

    const uploadedUrls: string[] = [];
    let failed = 0;

    // Sequential upload — Cloudinary handles parallel зле при HTTP/1.1 origins.
    for (const item of pending) {
      setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "uploading" } : p)));
      try {
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("kind", cloudinaryKind);
        fd.append("slug", folderKey);
        const res = await fetch("/api/admin/uploads/image", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
        const url = (json as { data?: { url?: string } }).data?.url;
        if (!url) throw new Error("Cloudinary върна празен URL.");
        uploadedUrls.push(url);
        setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "done" } : p)));
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", errorMsg: msg } : p)));
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : null));
    }

    if (uploadedUrls.length > 0) onUploaded(uploadedUrls);

    // След успех — изчистваме само успешните pending записи; failed остават
    // за retry от потребителя.
    setPending((prev) => {
      const stillFailed = prev.filter((p) => p.status === "error");
      const removedSuccessful = prev.filter((p) => p.status !== "error");
      removedSuccessful.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      notifyPending(stillFailed);
      return stillFailed;
    });

    setUploading(false);
    setTimeout(() => setProgress(null), 1500);
    if (failed === 0) {
      setSuccessNote(`Качени са ${uploadedUrls.length} снимки в Cloudinary.`);
      setTimeout(() => setSuccessNote(null), 4000);
    } else {
      setGlobalError(`Качени са ${uploadedUrls.length} от ${pending.length}. ${failed} се провалиха — пробвай отново.`);
    }
  }

  const remainingAfterPending = Math.max(0, remainingSlots - pending.length);
  const canAddMore = remainingAfterPending > 0 && !uploading;
  const showReusePanel = reusableImages && reusableImages.length > 0 && pending.length === 0;

  return (
    <div className="space-y-3">
      {/* Re-use панел: показва се над uploader-а, ако имаме готов модел и
          вече има снимки за същия (brand, model_code) в каталога. */}
      {showReusePanel && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-start gap-3">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-emerald-900 leading-tight">
              Този модел вече има {reusableImages!.length}{" "}
              {reusableImages!.length === 1 ? "снимка" : "снимки"} в каталога
            </div>
            <p className="text-[12px] text-emerald-800 leading-snug mt-0.5">
              {reusableFromName
                ? <>От продукта „<strong>{reusableFromName}</strong>“. </>
                : null}
              Няма нужда да качваш нови — можеш да ползваш същите снимки.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {reusableImages!.slice(0, 4).map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={`reuse-${i}`}
                  className="h-12 w-12 rounded-md object-cover border border-emerald-200 bg-white"
                />
              ))}
            </div>
            {onLinkReusable && (
              <button
                type="button"
                onClick={onLinkReusable}
                disabled={uploading}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                <Link2 className="w-3.5 h-3.5" />
                Линкни тези снимки към новия продукт
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input — multiple, без `capture` за да отвори native picker. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFilesIn(e.target.files);
          e.target.value = "";
        }}
      />

      {/* CTA бутон — голям, в стила на горните scan бутончета. */}
      <button
        type="button"
        onClick={openPicker}
        disabled={!canAddMore}
        className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 w-full text-center transition-all ${
          !canAddMore
            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
            : "bg-gradient-to-br from-brand-blue-50 to-brand-orange-50/60 border-dashed border-brand-blue-300 text-brand-blue-900 hover:from-brand-blue-100 hover:border-brand-blue-400 hover:shadow-md active:scale-[0.99]"
        }`}
      >
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ${canAddMore ? "bg-brand-blue-500 text-white" : "bg-slate-300 text-white"}`}>
          <ImagePlus className="w-5 h-5" />
        </div>
        <div className="text-sm sm:text-base font-bold leading-tight">Снимай или избери снимки</div>
        <div className="text-[11px] sm:text-xs font-normal opacity-80 leading-tight">
          {canAddMore
            ? `Можеш да добавиш още ${remainingAfterPending} ${remainingAfterPending === 1 ? "снимка" : "снимки"} (макс. ${MAX_PRODUCT_IMAGES} общо)`
            : `Достигнат е лимитът от ${MAX_PRODUCT_IMAGES} снимки`}
        </div>
        {canAddMore && (
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

      {/* Preview grid + контроли */}
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
          <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
            <div className="text-[12px] font-semibold text-amber-900 leading-snug">
              <AlertTriangle className="inline w-3.5 h-3.5 mb-0.5 mr-1 text-amber-600" />
              {pending.length} {pending.length === 1 ? "снимка чака" : "снимки чакат"} качване — не са в Cloudinary все още.
            </div>
            {!uploading && (
              <button
                type="button"
                onClick={clearAllPending}
                className="text-[11px] text-slate-500 hover:text-red-600 underline-offset-2 hover:underline"
              >
                Изчисти всички
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {pending.map((p) => (
              <div
                key={p.id}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                  p.status === "done"
                    ? "border-emerald-300"
                    : p.status === "error"
                      ? "border-red-300"
                      : p.status === "uploading"
                        ? "border-brand-blue-300"
                        : "border-amber-200"
                } bg-white shadow-sm group`}
              >
                <img src={p.previewUrl} alt="preview" className="w-full h-full object-cover" />
                {p.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-brand-blue-900/40 text-white">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
                {p.status === "done" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/30 text-white">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                )}
                {p.status === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/60 text-white p-1.5 text-center">
                    <AlertTriangle className="w-5 h-5 mb-0.5" />
                    <div className="text-[9px] font-semibold leading-tight">{p.errorMsg ?? "Грешка"}</div>
                  </div>
                )}
                {!uploading && p.status !== "done" && (
                  <button
                    type="button"
                    onClick={() => removePending(p.id)}
                    className="absolute top-1 right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-90 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Премахни от preview"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Bulk upload бутон */}
          <button
            type="button"
            onClick={() => void uploadAll()}
            disabled={uploading || pending.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-blue-600 text-white text-sm font-bold shadow-sm hover:bg-brand-blue-700 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Качване {progress ? `(${progress.done}/${progress.total})` : "..."}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Качи {pending.length} {pending.length === 1 ? "снимка" : "снимки"} в Cloudinary
              </>
            )}
          </button>
        </div>
      )}

      {/* Глобален error и success notice. */}
      {globalError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
          <span>{globalError}</span>
        </div>
      )}
      {successNote && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          <span>{successNote}</span>
        </div>
      )}
    </div>
  );
}
