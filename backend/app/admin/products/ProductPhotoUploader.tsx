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
import { Camera, ImagePlus, Loader2, Trash2, Upload, CheckCircle2, AlertTriangle, Sparkles, Link2, Wand2, RotateCcw, Search } from "lucide-react";
import { ImageLightbox } from "./ImageLightbox";
import { AIPhotoFinder } from "./AIPhotoFinder";
import { enhancePhotoViaAI } from "@/lib/photos/enhancePhoto";

type Props = {
  brandSlug: string | null | undefined;
  /** Човекочетимо име на марката (напр. „Daikin“, „Mitsubishi Electric“).
   *  Ползва се за AI search prompt-а — slug-ът би объркал търсенето. */
  brandName?: string | null;
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
  /** Оригиналният файл от потребителя — пазим го за undo на AI. */
  file: File;
  /** Текущ blob URL за preview (може да е оригинала ИЛИ AI версията). */
  previewUrl: string;
  /** Оригинален blob URL (запазваме за undo / before-after сравнение). */
  originalUrl: string;
  /** AI-обработената версия — ползва се при upload, ако има. */
  enhancedBlob?: Blob;
  /** AI обработка статус — за UI индикатор. */
  aiStatus: "idle" | "processing" | "done" | "error";
  aiError?: string;
  /** Cloudinary upload статус. */
  status: "ready" | "uploading" | "done" | "error";
  errorMsg?: string;
};

export const MAX_PRODUCT_IMAGES = 4;

/** Официална цена на AI подобрение (Gemini 2.5 Flash Image / Nano Banana,
 *  към май 2026 г.): $0.039 за 1024×1024 снимка. Стандартен real-time режим.
 *
 *  ВАЖНО: Gemini 2.5 Flash Image се pension-ва на 2 октомври 2026. Тогава
 *  трябва да мигрираме към `gemini-3.1-flash-image-preview`, който струва
 *  $0.067 / 1024px (≈ 72 % по-скъпо). Кодът вече поддържа смяна през
 *  ENV променливата `GEMINI_IMAGE_MODEL`. */
export const AI_ENHANCE_PRICE_USD = 0.039;

/** Цената за UI-показване — показваме „~$0.03“ (закръглено надолу до 2
 *  знака), за да изглежда чисто и без излишни decimals. Реалната стойност
 *  при сметнение остава точна (0.039). */
export const AI_ENHANCE_PRICE_DISPLAY = "$0.03";

export function ProductPhotoUploader({
  brandSlug,
  brandName,
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
  /** AIPhotoFinder modal — отваря се от бутона „🔍 AI от интернет“. */
  const [aiFinderOpen, setAiFinderOpen] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  /** Lightbox: index + източник (pending vs reusable) на отворената снимка. */
  const [lightbox, setLightbox] = useState<{
    source: "pending" | "reuse";
    index: number;
  } | null>(null);

  // Mounted ref — пазим setState на unmount-нат компонент по време на bulk upload.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync ref към текущия pending — нужен на cleanup (closure bug fix).
  // Cleanup-ът се изпълнява веднъж при unmount и в момента на изпълнение
  // вижда последната стойност от ref-а (а НЕ stale snapshot от initial render).
  const pendingRef = useRef<Pending[]>([]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Revoke на всички ОСТАНАЛИ blob URLs при unmount, за да не теча в паметта.
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  // Известяваме родителя за pending count САМО през useEffect (след render),
  // защото React забранява извикването на parent's setState от inside на child
  // state-updater callback (това би предизвикало render-phase setState грешка).
  useEffect(() => {
    onPendingChange(pending.length);
  }, [pending.length, onPendingChange]);

  // Защитен reset при unmount: ако компонентът се разкачи с „lingering“
  // pending count > 0 в parent state-а, save-protection-ът ще остане
  // активен дори когато реално няма pending снимки. Затова при unmount
  // експлицитно нулираме count-а в родителя.
  useEffect(() => {
    return () => onPendingChange(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Малък helper за safe setState — игнорира извикване след unmount.
  // Callback стил, защото generic-ът от setter+value не се извежда коректно
  // от TS (T → null засилва съкращаване и счупва типа на real setter-а).
  const safeRun = (fn: () => void) => {
    if (mountedRef.current) fn();
  };

  // Auto-clear на globalError след 7 секунди — да не остава „lingering“ преди
  // потребителят да забележи. Cleanup на timer-а при нова грешка.
  useEffect(() => {
    if (!globalError) return;
    const t = setTimeout(() => safeRun(() => setGlobalError(null)), 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalError]);

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
      .map((f) => {
        const blobUrl = URL.createObjectURL(f);
        return {
          id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file: f,
          previewUrl: blobUrl,
          originalUrl: blobUrl, // първоначално оригиналът = preview
          aiStatus: "idle" as const,
          status: "ready" as const,
        };
      });
    setPending((prev) => [...prev, ...newPending]);
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function clearAllPending() {
    pending.forEach((p) => {
      URL.revokeObjectURL(p.previewUrl);
      if (p.originalUrl !== p.previewUrl) URL.revokeObjectURL(p.originalUrl);
    });
    setPending([]);
    setGlobalError(null);
  }

  /**
   * AI „подобри тази снимка“ — real-time Gemini Nano Banana call.
   * Приема item-а директно (НЕ id), за да не зависи от race с React state
   * (вътрешният state в closure не се update-ва между sequential await-и).
   */
  async function enhanceOne(item: Pending) {
    if (item.aiStatus === "processing") return;

    safeRun(() =>
      setPending((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, aiStatus: "processing", aiError: undefined } : p,
        ),
      ),
    );

    try {
      // Ползваме оригиналния File за input (НЕ предишния AI резултат) —
      // за да не правим AI върху AI (което би деградирало детайлите).
      const result = await enhancePhotoViaAI(item.file);
      if (!mountedRef.current) return;
      const newUrl = URL.createObjectURL(result.blob);
      safeRun(() =>
        setPending((prev) =>
          prev.map((p) => {
            if (p.id !== item.id) return p;
            if (p.previewUrl !== p.originalUrl) URL.revokeObjectURL(p.previewUrl);
            return {
              ...p,
              previewUrl: newUrl,
              enhancedBlob: result.blob,
              aiStatus: "done",
              aiError: undefined,
            };
          }),
        ),
      );
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      safeRun(() =>
        setPending((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, aiStatus: "error", aiError: msg } : p,
          ),
        ),
      );
    }
  }

  /** Връща оригиналната снимка след AI enhancement (undo). */
  function revertAi(id: string) {
    safeRun(() =>
      setPending((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          if (p.previewUrl !== p.originalUrl) URL.revokeObjectURL(p.previewUrl);
          return {
            ...p,
            previewUrl: p.originalUrl,
            enhancedBlob: undefined,
            aiStatus: "idle",
            aiError: undefined,
          };
        }),
      ),
    );
  }

  /** Batch enhance на всички pending snimки (sequential real-time calls). */
  async function enhanceAll() {
    // Снимаме targets ПРЕДИ цикъла — pending може да се променя по време на
    // изпълнението, но ние искаме да enhance-нем оригиналния списък.
    const targets = pending.filter(
      (p) => p.aiStatus !== "processing" && p.aiStatus !== "done",
    );
    for (const item of targets) {
      if (!mountedRef.current) return;
      await enhanceOne(item);
    }
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
    // Snapshot-ваме броя за финалния summary преди да изчистим pending.
    const totalAttempted = pending.length;
    for (const item of pending) {
      safeRun(() =>
        setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "uploading" } : p))),
      );
      try {
        // Ако имаме AI-обработена версия, качваме нея. Иначе — оригинала.
        // AI-генерираните блобове са PNG (от Nano Banana), затова сменяме
        // разширението на името, за да остане consistent.
        let fileForUpload: File | Blob = item.file;
        if (item.enhancedBlob && item.aiStatus === "done") {
          const baseName = item.file.name.replace(/\.[^./]+$/, "") || "photo";
          fileForUpload = new File(
            [item.enhancedBlob],
            `${baseName}-ai.png`,
            { type: item.enhancedBlob.type || "image/png" },
          );
        }
        const fd = new FormData();
        fd.append("file", fileForUpload);
        fd.append("kind", cloudinaryKind);
        fd.append("slug", folderKey);
        const res = await fetch("/api/admin/uploads/image", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!mountedRef.current) return; // компонентът е изчезнал — спираме
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
        const url = (json as { data?: { url?: string } }).data?.url;
        if (!url) throw new Error("Cloudinary върна празен URL.");
        uploadedUrls.push(url);
        safeRun(() =>
          setPending((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "done" } : p))),
        );
      } catch (e) {
        if (!mountedRef.current) return;
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        safeRun(() =>
          setPending((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: "error", errorMsg: msg } : p)),
          ),
        );
      }
      safeRun(() => setProgress((p) => (p ? { done: p.done + 1, total: p.total } : null)));
    }

    if (!mountedRef.current) return;
    if (uploadedUrls.length > 0) onUploaded(uploadedUrls);

    // След успех — изчистваме само успешните pending записи; failed остават
    // за retry от потребителя.
    safeRun(() =>
      setPending((prev) => {
        const stillFailed = prev.filter((p) => p.status === "error");
        const removedSuccessful = prev.filter((p) => p.status !== "error");
        removedSuccessful.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return stillFailed;
      }),
    );

    safeRun(() => setUploading(false));
    setTimeout(() => safeRun(() => setProgress(null)), 1500);
    if (failed === 0) {
      safeRun(() => setSuccessNote(`Качени са ${uploadedUrls.length} снимки в Cloudinary.`));
      setTimeout(() => safeRun(() => setSuccessNote(null)), 4000);
    } else {
      safeRun(() =>
        setGlobalError(
          `Качени са ${uploadedUrls.length} от ${totalAttempted}. ${failed} се провалиха — пробвай отново.`,
        ),
      );
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
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox({ source: "reuse", index: i })}
                  className="h-12 w-12 rounded-md overflow-hidden border border-emerald-200 bg-white cursor-zoom-in hover:ring-2 hover:ring-emerald-400 transition-all"
                  title="Кликни за уголемяване"
                >
                  <img
                    src={img.url}
                    alt={`reuse-${i}`}
                    className="h-full w-full object-cover"
                  />
                </button>
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

      {/* Secondary CTA: AI намира официални снимки в интернет — за случаите,
          когато климатикът е в кашон и не може да се снима. Активен е САМО
          ако има марка + модел (иначе AI search не работи). */}
      {(() => {
        const aiSearchReady = Boolean(
          brandName && brandName.trim().length > 1 && modelCode.trim().length > 1,
        );
        const showButton = canAddMore;
        if (!showButton) return null;
        return (
          <button
            type="button"
            onClick={() => {
              if (!aiSearchReady) {
                setGlobalError("Попълни марка и модел горе, преди да търсиш в интернет.");
                return;
              }
              setAiFinderOpen(true);
            }}
            className={`group flex items-center gap-3 p-3 rounded-xl border w-full text-left transition-all ${
              aiSearchReady
                ? "bg-gradient-to-br from-violet-50 to-fuchsia-50/60 border-violet-200 hover:border-violet-400 hover:shadow-sm active:scale-[0.99]"
                : "bg-slate-50 border-slate-200 cursor-help"
            }`}
            title={
              aiSearchReady
                ? `AI ще търси в Google за официални снимки на ${brandName} ${modelCode}`
                : "Попълни марка + модел горе за да активираш AI търсенето"
            }
          >
            <div
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg shadow-sm shrink-0 ${
                aiSearchReady ? "bg-violet-500 text-white" : "bg-slate-300 text-white"
              }`}
            >
              <Search className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-bold leading-tight ${aiSearchReady ? "text-violet-900" : "text-slate-500"}`}>
                AI намери официални снимки от интернет
              </div>
              <p className={`text-[11px] leading-snug mt-0.5 ${aiSearchReady ? "text-violet-800" : "text-slate-400"}`}>
                {aiSearchReady ? (
                  <>
                    Когато не можеш да снимаш. AI търси на{" "}
                    <strong>официалния сайт на {brandName}</strong>, после на дистрибутори.
                  </>
                ) : (
                  <>Попълни „Марка“ и „Модел“ горе, за да активираш AI търсенето.</>
                )}
              </p>
            </div>
          </button>
        );
      })()}

      {/* Preview grid + контроли */}
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
          <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
            <div className="text-[12px] font-semibold text-amber-900 leading-snug">
              <AlertTriangle className="inline w-3.5 h-3.5 mb-0.5 mr-1 text-amber-600" />
              {pending.length} {pending.length === 1 ? "снимка чака" : "снимки чакат"} качване в хранилището за снимки.
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

          {/* AI enhance batch + информативен текст с цена */}
          {(() => {
            const aiBusy = pending.some((p) => p.aiStatus === "processing");
            const aiEligible = pending.filter(
              (p) => p.aiStatus !== "processing" && p.aiStatus !== "done",
            );
            const aiDoneCount = pending.filter((p) => p.aiStatus === "done").length;
            if (pending.length === 0) return null;
            return (
              <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50/60 p-2.5 flex items-start gap-2.5">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-white shadow-sm shrink-0">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-violet-900 leading-tight">
                    AI „професионален каталог“ вид
                  </div>
                  <p className="text-[11px] text-violet-800 leading-snug mt-0.5">
                    Бял фон + soft shadow + балансирано осветление. Запазва
                    всеки детайл на продукта. Цена: <strong>~{AI_ENHANCE_PRICE_DISPLAY}/снимка</strong>{" "}
                    (Gemini Nano Banana).
                    {aiDoneCount > 0 && (
                      <> Обработени: <strong>{aiDoneCount}/{pending.length}</strong>.</>
                    )}
                  </p>
                  {aiEligible.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void enhanceAll()}
                      disabled={aiBusy || uploading}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {aiBusy ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI обработва...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Подобри {aiEligible.length === pending.length ? "всички" : `${aiEligible.length} още`} с AI
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="flex flex-wrap gap-1.5">
            {pending.map((p, idx) => (
              <div
                key={p.id}
                className={`group relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  p.aiStatus === "done"
                    ? "border-violet-400 ring-1 ring-violet-200"
                    : p.status === "done"
                      ? "border-emerald-300"
                      : p.status === "error"
                        ? "border-red-300"
                        : p.status === "uploading"
                          ? "border-brand-blue-300"
                          : "border-amber-300"
                } bg-white shadow-sm`}
              >
                <button
                  type="button"
                  onClick={() => setLightbox({ source: "pending", index: idx })}
                  className="w-full h-full block cursor-zoom-in"
                  title="Кликни за уголемяване"
                >
                  <img src={p.previewUrl} alt="preview" className="w-full h-full object-cover" />
                </button>

                {/* AI-обработена индикация горе вляво */}
                {p.aiStatus === "done" && (
                  <div
                    className="absolute top-0.5 left-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-white shadow-md pointer-events-none"
                    title="AI подобрена"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                  </div>
                )}

                {/* Status overlay (приоритет: AI processing > upload status > AI error) */}
                {p.aiStatus === "processing" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-violet-900/55 text-white pointer-events-none">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <div className="text-[8px] font-bold mt-0.5">AI...</div>
                  </div>
                )}
                {p.aiStatus !== "processing" && p.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-brand-blue-900/40 text-white pointer-events-none">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
                {p.aiStatus !== "processing" && p.status === "done" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/30 text-white pointer-events-none">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                )}
                {p.aiStatus !== "processing" && p.status === "error" && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-red-900/65 text-white pointer-events-none"
                    title={p.errorMsg ?? "Грешка"}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                {p.aiStatus === "error" && p.status !== "uploading" && p.status !== "done" && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-red-900/85 text-white text-[8px] font-bold p-0.5 text-center leading-tight pointer-events-none"
                    title={p.aiError ?? "AI грешка"}
                  >
                    AI ✕
                  </div>
                )}

                {/* Action бутони — показват се при hover */}
                {!uploading && p.status !== "done" && p.aiStatus !== "processing" && (
                  <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                    {/* AI enhance (или undo, ако вече е обработена) */}
                    {p.aiStatus === "done" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          revertAi(p.id);
                        }}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-600 text-white shadow-md hover:bg-slate-700 active:scale-90 transition-all"
                        title="Върни оригинала"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void enhanceOne(p);
                        }}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-500 text-white shadow-md hover:bg-violet-600 active:scale-90 transition-all"
                        title={`AI подобри (~${AI_ENHANCE_PRICE_DISPLAY})`}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePending(p.id);
                      }}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-90 transition-all"
                      title="Премахни от preview"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
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
          <span className="flex-1">{globalError}</span>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="shrink-0 text-red-500 hover:text-red-800 font-bold text-sm leading-none px-1"
            aria-label="Затвори"
          >
            ×
          </button>
        </div>
      )}
      {successNote && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          <span>{successNote}</span>
        </div>
      )}

      {/* Lightbox за уголемяване — pending preview ИЛИ reusable снимки.
          Активният източник се избира от state-а. */}
      <ImageLightbox
        images={
          lightbox?.source === "reuse"
            ? (reusableImages ?? []).map((im) => im.url)
            : pending.map((p) => p.previewUrl)
        }
        index={lightbox ? lightbox.index : null}
        onClose={() => setLightbox(null)}
        onIndexChange={(n) =>
          setLightbox((prev) => (prev ? { ...prev, index: n } : prev))
        }
      />

      {/* AI намиране на снимки от интернет — Modal с Google Search grounding. */}
      <AIPhotoFinder
        open={aiFinderOpen}
        onClose={() => setAiFinderOpen(false)}
        brand={brandName ?? ""}
        modelCode={modelCode}
        remainingSlots={remainingAfterPending}
        onFilesPicked={(files) => {
          // Добавяме като нови pending записи (ще минат през стандартния
          // upload flow + optional AI enhance).
          if (files.length === 0) return;
          const blobUrls = files.map((f) => URL.createObjectURL(f));
          const newPending: Pending[] = files.map((f, i) => ({
            id: `ai-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
            file: f,
            previewUrl: blobUrls[i],
            originalUrl: blobUrls[i],
            aiStatus: "idle" as const,
            status: "ready" as const,
          }));
          safeRun(() => setPending((prev) => [...prev, ...newPending]));
        }}
      />
    </div>
  );
}
