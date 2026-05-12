"use client";

/**
 * AIPhotoFinder — модал за намиране на официални продуктови снимки
 * чрез AI web search (Gemini + Google Search grounding).
 *
 * Flow:
 *   1. При open → автоматично пуска търсене с (марка, модел, тяло).
 *   2. Показва grid от 0-8 кандидата с thumbnail + source domain + confidence.
 *   3. Потребителят избира 1-N снимки (checkboxes).
 *   4. „Добави избраните“ → за всяка избрана:
 *        a. Сваляме чрез server-side proxy (CORS safety).
 *        b. Конвертираме в File.
 *        c. Подаваме нагоре като pending photo (като ръчно качените).
 *   5. Потребителят след това решава дали да приложи ✨ AI enhance — със
 *      същите бутони като при стандартния flow.
 *
 * Случаи:
 *   • Климатикът е в кашон и НЕ може да се снима физически.
 *   • Старите снимки в Cloudinary са лоши и искаме да ги заменим с
 *     каталожни.
 *   • Бърз start за нови продукти без на ръка да правим скрийншоти.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";

export type AiSearchResult = {
  url: string;
  source_domain: string | null;
  description: string | null;
  confidence: "high" | "medium" | "low";
  suspected_unit: "indoor" | "outdoor" | "both" | "unknown";
};

type Props = {
  open: boolean;
  onClose: () => void;
  brand: string;
  modelCode: string;
  /** Какво тяло преди всичко търсим — UI default selection. */
  unit?: "indoor" | "outdoor" | "both";
  /** Колко свободни slot-а има (max images - вече добавени). */
  remainingSlots: number;
  /** Callback: за всяко избрано — File готов за добавяне в pending list. */
  onFilesPicked: (files: File[]) => void;
};

type Phase = "idle" | "searching" | "ready" | "downloading" | "error";

export function AIPhotoFinder({
  open,
  onClose,
  brand,
  modelCode,
  unit = "both",
  remainingSlots,
  onFilesPicked,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AiSearchResult[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeUnit, setActiveUnit] = useState<"indoor" | "outdoor" | "both">(unit);
  /** За всеки URL: дали thumbnail-ът се е зареди успешно (за да скрием broken images). */
  const [imgErrored, setImgErrored] = useState<Set<string>>(new Set());

  // Reset при отваряне.
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setError(null);
      setResults([]);
      setWarnings([]);
      setSelected(new Set());
      setImgErrored(new Set());
      setActiveUnit(unit);
    }
  }, [open, unit]);

  /**
   * Изпълнява AI search с текущата (brand, model, unit) комбинация.
   */
  const runSearch = useCallback(async () => {
    if (!brand.trim() || !modelCode.trim()) {
      setError("Попълни марка и модел първо.");
      setPhase("error");
      return;
    }
    setPhase("searching");
    setError(null);
    setResults([]);
    setWarnings([]);
    setSelected(new Set());
    setImgErrored(new Set());
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "product_image_search",
          input: {
            brand: brand.trim(),
            modelCode: modelCode.trim(),
            unit: activeUnit,
            maxResults: 8,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { images?: AiSearchResult[]; warnings?: string[] };
        error?: string;
      };
      // Backend може да върне 502 с empty `data.images` + grешка в `warnings`
      // (graceful degradation). В този случай UI показва „няма снимки“ +
      // warning banner, БЕЗ да хвърля error popup.
      if (!res.ok && !json.data) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const images = Array.isArray(json.data?.images) ? json.data.images : [];
      const warnings = Array.isArray(json.data?.warnings) ? json.data.warnings : [];
      // Ако backend върна error, добавяме го в warnings.
      if (!res.ok && json.error) warnings.unshift(json.error);
      setResults(images);
      setWarnings(warnings);
      setPhase("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setPhase("error");
    }
  }, [brand, modelCode, activeUnit]);

  // Auto-search при отваряне.
  useEffect(() => {
    if (open && phase === "idle") {
      void runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Сваля URL-овете на избраните snimki и ги дава нагоре като File-ове. */
  const downloadSelected = useCallback(async () => {
    const urls = Array.from(selected);
    if (urls.length === 0) return;
    if (urls.length > remainingSlots) {
      setError(
        `Избра ${urls.length}, но има място само за още ${remainingSlots}. Снижи селекцията.`,
      );
      return;
    }
    setPhase("downloading");
    setError(null);
    const files: File[] = [];
    const failures: string[] = [];
    for (const url of urls) {
      try {
        const res = await fetch("/api/admin/photos/fetch-remote", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { base64: string; mimeType: string; sizeBytes: number };
          error?: string;
        };
        if (!res.ok || !json.data) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        // Превръщаме base64 в File.
        const binary = atob(json.data.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const mime = json.data.mimeType || "image/jpeg";
        const ext = mime.split("/")[1] || "jpg";
        const filename = `${brand.trim().toLowerCase()}-${modelCode.trim().toLowerCase()}-ai-${files.length + 1}.${ext}`;
        const file = new File([bytes], filename, { type: mime });
        files.push(file);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push(`${shortUrl(url)}: ${msg}`);
      }
    }
    if (files.length > 0) {
      onFilesPicked(files);
    }
    if (failures.length > 0 && files.length === 0) {
      setError(`Никоя снимка не успя да се свали:\n${failures.join("\n")}`);
      setPhase("error");
      return;
    }
    if (failures.length > 0) {
      setError(`Внимание: ${failures.length} от ${urls.length} не успяха.`);
    }
    // Затваряме при успех.
    onClose();
  }, [selected, remainingSlots, brand, modelCode, onFilesPicked, onClose]);

  const toggleSelected = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const filteredResults = useMemo(
    () => results.filter((r) => !imgErrored.has(r.url)),
    [results, imgErrored],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/55 backdrop-blur-md"
      onClick={() => phase !== "downloading" && onClose()}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-white/70 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.3)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative border-b border-slate-100 bg-gradient-to-br from-violet-50 via-white to-brand-blue-50/40 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                AI намиране на официални снимки
              </h2>
              <p className="text-[12px] text-slate-600 leading-snug mt-0.5">
                <strong>{brand} {modelCode}</strong> — AI намира продуктови страници в Google и извлича
                официалната hero снимка от всяка (og:image meta tag). Избери кои да добавиш.
              </p>
            </div>
            <button
              type="button"
              onClick={() => phase !== "downloading" && onClose()}
              disabled={phase === "downloading"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              title="Затвори"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Unit toggle + retry */}
          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-bold">
              {(["both", "indoor", "outdoor"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setActiveUnit(u)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    activeUnit === u
                      ? "bg-brand-blue-500 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {u === "both" ? "Двете тела" : u === "indoor" ? "Вътрешно" : "Външно"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={phase === "searching" || phase === "downloading"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {phase === "searching" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {phase === "searching" ? "Търся..." : "Ново търсене"}
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-auto p-4">
          {phase === "searching" && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-violet-500" />
              <div className="text-sm font-semibold">AI търси в Google и extrahira снимки...</div>
              <div className="text-[12px] mt-1 max-w-md text-center">
                1) Намира продуктови страници (5-15s) · 2) Fetch-ва og:image от всяка (5-10s).
                Общо ~15-30 секунди.
              </div>
            </div>
          )}

          {phase === "error" && error && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <div className="font-bold">Грешка</div>
                <div className="mt-0.5 whitespace-pre-wrap">{error}</div>
              </div>
            </div>
          )}

          {(phase === "ready" || phase === "downloading") && (
            <>
              {warnings.length > 0 && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  <div>{warnings.join(" · ")}</div>
                </div>
              )}

              {filteredResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Globe className="w-8 h-8 mb-3 text-slate-300" />
                  <div className="text-sm font-semibold">Няма намерени снимки</div>
                  <div className="text-[12px] mt-1 max-w-md text-center">
                    AI не намери официални снимки за <strong>{brand} {modelCode}</strong>.
                    Опитай с друга комбинация „тяло“ или провери дали моделът е правилен.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredResults.map((r) => {
                    const isSelected = selected.has(r.url);
                    return (
                      <button
                        key={r.url}
                        type="button"
                        disabled={phase === "downloading"}
                        onClick={() => toggleSelected(r.url)}
                        className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-slate-50 ${
                          isSelected
                            ? "border-brand-blue-500 ring-2 ring-brand-blue-200 shadow-md"
                            : "border-slate-200 hover:border-slate-400 hover:shadow-sm"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        <img
                          src={r.url}
                          alt={r.description ?? "AI candidate"}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setImgErrored((prev) => {
                              const next = new Set(prev);
                              next.add(r.url);
                              return next;
                            })
                          }
                          className="w-full h-full object-contain bg-white"
                        />
                        {/* Confidence badge горе вляво */}
                        <div
                          className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            r.confidence === "high"
                              ? "bg-emerald-500 text-white"
                              : r.confidence === "medium"
                                ? "bg-amber-500 text-white"
                                : "bg-slate-400 text-white"
                          }`}
                          title={`Доверие на AI: ${r.confidence}`}
                        >
                          {r.confidence}
                        </div>
                        {/* Selected check */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue-500 text-white shadow-md">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                        {/* Source + suspected unit footer */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/85 via-slate-900/70 to-transparent p-1.5 text-white text-left">
                          <div className="text-[10px] font-bold truncate leading-tight">
                            {r.source_domain ?? "—"}
                          </div>
                          {r.suspected_unit !== "unknown" && (
                            <div className="text-[9px] opacity-80 leading-tight">
                              {r.suspected_unit === "indoor"
                                ? "вътрешно"
                                : r.suspected_unit === "outdoor"
                                  ? "външно"
                                  : "двете"}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12px] text-slate-600 leading-tight">
            {selected.size > 0 ? (
              <>
                <strong className="text-slate-900">Избрани: {selected.size}</strong>
                {" "}/ свободни slot-а: <strong>{remainingSlots}</strong>
              </>
            ) : (
              <span>Кликни върху снимките за избор · <Sparkles className="w-3 h-3 inline -mt-0.5" /> AI enhance е по избор след добавянето</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={phase === "downloading"}
              className="px-3 py-2 rounded-lg text-[12px] font-bold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Откажи
            </button>
            <button
              type="button"
              onClick={() => void downloadSelected()}
              disabled={
                selected.size === 0 ||
                phase === "downloading" ||
                phase === "searching" ||
                selected.size > remainingSlots
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-blue-500 text-white text-[12px] font-bold hover:bg-brand-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === "downloading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Свалям...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Добави {selected.size > 0 ? `(${selected.size})` : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Скъсява URL за UX (показва само домейна + последния segment). */
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}/...${u.pathname.split("/").pop() ?? ""}`;
  } catch {
    return url.slice(0, 50);
  }
}
