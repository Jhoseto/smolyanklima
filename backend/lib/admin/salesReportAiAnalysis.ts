import { getEnv } from "@/lib/env";
import type { SalesHistoryReport } from "@/lib/admin/computeSalesHistoryReport";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type AnalysisPeriodTier = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type AnalysisProfile = {
  tier: AnalysisPeriodTier;
  periodLabel: string;
  spanDays: number | null;
  minWords: number;
  maxWords: number;
  minChars: number;
  tooShortChars: number;
  maxOutputTokens: number;
  allowContinue: boolean;
  temperature: number;
};

export type SalesReportAnalysisInput = {
  report: SalesHistoryReport;
  sectionLabel?: string;
  filtersHint?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type SalesReportAnalysisResult = {
  text: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
    completionTokens: number;
    model: string;
  };
  profile: AnalysisProfile;
};

const TONE_RULES = `СТИЛ НА ИЗКАЗ:
- Нормален, разговорен български — все едно обясняваш на собственика за кафе, не пишеш одитен доклад
- Без канцеларищина и consulting жаргон: „осъществяване“, „оптимизация на процесите“, „стратегически хоризонт“, „ключови заинтересовани страни“, „драйвери на растеж“
- Кратки, ясни изречения; може „реално“, „тук“, „вижте“ — но оставай професионален
- Не представяй ролята си; без „като аналитик…“`;

const BANNED_RULES = `ЗАБРАНЕНО:
- Служебно/мемо оформление: „До:“, „От:“, „Тема:“, „Уважаеми…“, подпис
- Започни ДИРЕКТНО с първото ## заглавие — без preamble
- Преизброяване на KPI („оборот X“, „Y продажби“, „марж Z%“) — графиките вече ги показват
- Клишета без конкретика: „стабилен период“, „здравословен марж“, „силен екип“, „фокус върху клиента“
- Празни препоръки („подобрете маркетинга“, „следете пазара“)`;

function parseIsoDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function spanDaysInclusive(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function parseDatesFromFiltersHint(filtersHint?: string): { from?: string; to?: string } {
  if (!filtersHint) return {};
  const match = filtersHint.match(/(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return {};
  return { from: match[1], to: match[2] };
}

function tierFromSpanDays(spanDays: number): AnalysisPeriodTier {
  if (spanDays <= 7) return "daily";
  if (spanDays <= 14) return "weekly";
  if (spanDays <= 45) return "monthly";
  if (spanDays <= 120) return "quarterly";
  return "yearly";
}

function tierFromMonthCount(monthCount: number): AnalysisPeriodTier {
  if (monthCount <= 1) return "monthly";
  if (monthCount <= 3) return "quarterly";
  return "yearly";
}

function buildProfile(tier: AnalysisPeriodTier, spanDays: number | null): AnalysisProfile {
  switch (tier) {
    case "daily":
      return {
        tier,
        periodLabel: "кратък период (до седмица)",
        spanDays,
        minWords: 120,
        maxWords: 280,
        minChars: 450,
        tooShortChars: 180,
        maxOutputTokens: 1024,
        allowContinue: false,
        temperature: 0.62,
      };
    case "weekly":
      return {
        tier,
        periodLabel: "седмичен период",
        spanDays,
        minWords: 180,
        maxWords: 400,
        minChars: 700,
        tooShortChars: 280,
        maxOutputTokens: 1536,
        allowContinue: false,
        temperature: 0.6,
      };
    case "monthly":
      return {
        tier,
        periodLabel: "месечен период",
        spanDays,
        minWords: 280,
        maxWords: 550,
        minChars: 1100,
        tooShortChars: 450,
        maxOutputTokens: 2048,
        allowContinue: false,
        temperature: 0.58,
      };
    case "quarterly":
      return {
        tier,
        periodLabel: "тримесечен / няколко месеца",
        spanDays,
        minWords: 450,
        maxWords: 850,
        minChars: 1800,
        tooShortChars: 700,
        maxOutputTokens: 4096,
        allowContinue: true,
        temperature: 0.56,
      };
    case "yearly":
    default:
      return {
        tier: "yearly",
        periodLabel: "годишен или дълъг период",
        spanDays,
        minWords: 900,
        maxWords: 1500,
        minChars: 2800,
        tooShortChars: 800,
        maxOutputTokens: 8192,
        allowContinue: true,
        temperature: 0.55,
      };
  }
}

export function inferAnalysisProfile(input: SalesReportAnalysisInput): AnalysisProfile {
  const hintDates = parseDatesFromFiltersHint(input.filtersHint);
  const fromStr = input.dateFrom?.trim() || hintDates.from;
  const toStr = input.dateTo?.trim() || hintDates.to;
  const from = parseIsoDate(fromStr);
  const to = parseIsoDate(toStr);

  if (from && to) {
    const span = spanDaysInclusive(from, to);
    return buildProfile(tierFromSpanDays(span), span);
  }

  const monthCount = input.report.byMonth.length;
  if (monthCount > 0) {
    return buildProfile(tierFromMonthCount(monthCount), null);
  }

  return buildProfile("monthly", null);
}

export function analysisLoadingMessage(profile: AnalysisProfile): string {
  switch (profile.tier) {
    case "daily":
    case "weekly":
      return "AI преглежда данните — кратък текст (10–20 сек.)…";
    case "monthly":
      return "AI анализира периода — кратък до среден текст (20–40 сек.)…";
    case "quarterly":
      return "AI анализира данните — среден текст (30–60 сек.)…";
    default:
      return "AI анализира данните — обемен годишен анализ (1–2 мин.)…";
  }
}

export function analysisEmptyHint(profile: AnalysisProfile): string {
  switch (profile.tier) {
    case "daily":
    case "weekly":
      return "Натиснете за кратък AI коментар — какво се случва в този период и какво си струва да направите.";
    case "monthly":
      return "Натиснете за AI анализ на месеца — ясно и без излишен текст.";
    case "quarterly":
      return "Натиснете за AI анализ на периода — баланс между дълбочина и четливост.";
    default:
      return "Натиснете за задълбочен AI анализ на периода — интерпретации, рискове и препоръки.";
  }
}

export function analysisSubtitleHint(profile: AnalysisProfile): string {
  switch (profile.tier) {
    case "daily":
    case "weekly":
      return "Кратък коментар на нормален език — без излишен текст.";
    case "monthly":
      return "Средна дължина — смисъл и препоръки, не преразказ на графиките.";
    case "quarterly":
      return "По-задълбочен преглед на няколко месеца.";
    default:
      return "Пълен годишен анализ — интерпретации, рискове и препоръки.";
  }
}

function enrichReportInsights(report: SalesHistoryReport): Record<string, unknown> {
  const s = report.summary;
  const months = report.byMonth;
  const top3ClientShare = report.topClients.slice(0, 3).reduce((acc, c) => acc + c.revenueSharePercent, 0);
  const top1ClientShare = report.topClients[0]?.revenueSharePercent ?? 0;
  const top3SupplierShare =
    s.totalRevenue > 0
      ? Math.round(
          (report.bySupplier.slice(0, 3).reduce((acc, x) => acc + x.revenue, 0) / s.totalRevenue) * 1000,
        ) / 10
      : null;
  const top3BrandShare =
    s.totalRevenue > 0
      ? Math.round(
          (report.byBrand.slice(0, 3).reduce((acc, x) => acc + x.revenue, 0) / s.totalRevenue) * 1000,
        ) / 10
      : null;

  const monthMomentum =
    months.length >= 2
      ? months.slice(1).map((m, i) => {
          const prev = months[i];
          const countDelta = prev.count ? Math.round(((m.count - prev.count) / prev.count) * 100) : null;
          const revDelta = prev.revenue ? Math.round(((m.revenue - prev.revenue) / prev.revenue) * 100) : null;
          return { month: m.month, countDeltaPct: countDelta, revenueDeltaPct: revDelta };
        })
      : [];

  const peakMonth = months.length
    ? [...months].sort((a, b) => b.revenue - a.revenue)[0]?.month
    : null;
  const lowMonth = months.length
    ? [...months].sort((a, b) => a.revenue - b.revenue)[0]?.month
    : null;

  const mountBacklogRatio =
    s.saleCount > 0 ? Math.round((s.pendingMountCount / s.saleCount) * 1000) / 10 : 0;
  const cancelRatio = s.saleCount > 0 ? Math.round((s.cancelledCount / s.saleCount) * 1000) / 10 : 0;
  const purchaseCoverage =
    s.saleCount > 0 ? Math.round((s.withPurchaseData / s.saleCount) * 1000) / 10 : 0;

  const priceSkew =
    report.priceBuckets.length >= 2
      ? (() => {
          const total = report.priceBuckets.reduce((a, b) => a + b.count, 0);
          const mid = Math.floor(report.priceBuckets.length / 2);
          const lower = report.priceBuckets.slice(0, mid).reduce((a, b) => a + b.count, 0);
          const upper = report.priceBuckets.slice(mid).reduce((a, b) => a + b.count, 0);
          return total
            ? { lowerHalfSharePct: Math.round((lower / total) * 100), upperHalfSharePct: Math.round((upper / total) * 100) }
            : null;
        })()
      : null;

  return {
    meta: {
      totalMatching: report.totalMatching,
      sampledCount: report.sampledCount,
      truncated: report.truncated,
    },
    derivedPatterns: {
      top1ClientSharePct: top1ClientShare,
      top3ClientsSharePct: Math.round(top3ClientShare * 10) / 10,
      top3SuppliersSharePct: top3SupplierShare,
      top3BrandsSharePct: top3BrandShare,
      monthMomentum,
      peakRevenueMonth: peakMonth,
      lowestRevenueMonth: lowMonth,
      mountBacklogRatioPct: mountBacklogRatio,
      cancellationRatioPct: cancelRatio,
      purchaseDataCoveragePct: purchaseCoverage,
      priceSegmentSkew: priceSkew,
      marginQuality: s.marginPercent != null ? (s.marginPercent >= 25 ? "strong" : s.marginPercent >= 15 ? "moderate" : "thin") : "unknown",
    },
    summary: s,
    byMonth: months,
    byMountPhase: report.byMountPhase,
    byOperationalStatus: report.byOperationalStatus,
    bySupplier: report.bySupplier,
    byBrand: report.byBrand,
    byProduct: report.byProduct,
    priceBuckets: report.priceBuckets,
    revenueVsPurchaseMonthly: report.revenueVsPurchaseMonthly,
    topClients: report.topClients.map((c, i) => ({
      rank: i + 1,
      name: c.name,
      count: c.count,
      revenueSharePercent: c.revenueSharePercent,
      marginPercent: c.marginPercent,
      pendingMountCount: c.pendingMountCount,
      completedCount: c.completedCount,
      cancelledCount: c.cancelledCount,
      topBrand: c.topBrand,
      repeatBuyer: c.count > 1,
    })),
  };
}

function sectionBlock(profile: AnalysisProfile): string {
  switch (profile.tier) {
    case "daily":
      return `СТРУКТУРА (само тези ## секции):
## Накратко
2–3 изречения — най-важното, без очевидности.

## Какво се случва
1 абзац — какво излиза от данните; причинно-следствени връзки накратко.

## Какво да направите
3–4 bullets — конкретни, изпълними стъпки за следващите дни.`;

    case "weekly":
      return `СТРУКТУРА (само тези ## секции):
## Накратко
2–4 изречения — главният извод.

## Ключово тази седмица
1–2 абзаца — клиенти, продукти, монтаж/откази — само ако има смисъл в данните.

## Рискове и възможности
По 2–3 bullets — конкретни, с „ако → тогава“ логика.

## Следващи стъпки
3–5 номерирани действия.`;

    case "monthly":
      return `СТРУКТУРА (само тези ## секции):
## Обобщение
3–4 изречения — неочакваното, не препис на графиките.

## Какво показват данните
2 абзаца — динамика, клиенти, продукти, марж/операции — само релевантното.

## Рискове и възможности
По 3–4 bullets с обяснение защо.

## Препоръки
4–6 номерирани стъпки за следващия месец.`;

    case "quarterly":
      return `СТРУКТУРА (само тези ## секции):
## Обобщение
3–4 изречения.

## Динамика и mix
2 абзаца — трендове, сезонност, промени в продукти/клиенти.

## Клиенти и концентрация
1–2 абзаца — зависимости, repeat buyers, VIP риск.

## Продукти, марки и доставчици
1–2 абзаца — къде е volume vs margin.

## Операции и марж
1 абзац — монтаж, откази, purchase data gaps.

## Рискове
4–5 bullets с механизъм.

## Възможности и препоръки
5–7 номерирани стъпки за 30/90 дни.`;

    case "yearly":
    default:
      return `СТРУКТУРА (всички ## секции задължителни):

## Обобщение
3–4 изречения — само неочакваният извод.

## Динамика и сезонност
monthMomentum, peak/low месеци — какво значи за търсене, капацитет, cashflow.

## Клиентска концентрация
topClients, repeatBuyer, top3 share — зависимости, VIP риск, upsell.

## Продуктов портфейл и цени
byProduct, priceBuckets — volume vs margin.

## Марки и доставчици
byBrand, bySupplier — concentration, преговорна позиция.

## Марж и data gaps
marginQuality, purchaseCoverage — blind spots.

## Операции: монтаж и откази
mountBacklog, cancellations — bottleneck-и.

## Рискове
5–7 bullets — „ако → тогава“.

## Възможности
5–7 bullets — actionable.

## Препоръки за 30 / 90 дни
8–12 номерирани стъпки.`;
  }
}

function depthRules(profile: AnalysisProfile): string {
  switch (profile.tier) {
    case "daily":
      return `ОБЕМ: ${profile.minWords}–${profile.maxWords} думи общо. Кратко и точно — периодът е малък, не разтягай текста.
Фокус: само най-важното за тези дни; пропусни секции без данни.`;
    case "weekly":
      return `ОБЕМ: ${profile.minWords}–${profile.maxWords} думи. Компактно — без излишни подсекции.
Фокус: седмичната картина + 3–5 ясни действия.`;
    case "monthly":
      return `ОБЕМ: ${profile.minWords}–${profile.maxWords} думи. Средна дължина — достатъчно дълбочина, без годишен одит.
Фокус: месечният модел, не преразказ на всяка графика.`;
    case "quarterly":
      return `ОБЕМ: ${profile.minWords}–${profile.maxWords} думи. Средно-дълъг текст с ясна структура.
Фокус: трендове и стратегически избори, не KPI списък.`;
    default:
      return `ОБЕМ: ${profile.minWords}–${profile.maxWords} думи. МИНИМУМ 8 абзаца по 4–6 изречения.
Фокус: дълбока интерпретация — причинно-следствени връзки, сравнения между сегменти, рискове с механизъм, конкретни препоръки.`;
  }
}

function continuePrompt(profile: AnalysisProfile, priorText: string): string {
  const sectionsByTier: Record<AnalysisPeriodTier, string> = {
    daily: "## Какво да направите",
    weekly: "## Следващи стъпки",
    monthly: "## Препоръки",
    quarterly: "## Възможности и препоръки",
    yearly: "## Препоръки за 30 / 90 дни",
  };

  return `Продължи анализа на български (markdown) от там, където спря. НЕ повтаряй вече написаното.

ВЕЧЕ НАПИСАНО:
${priorText}

ДОПЪЛНИ липсващите секции до минимум ${profile.minWords} думи общо. Задължително приключи с ${sectionsByTier[profile.tier]}.
Само markdown — без JSON. Без „До:“ / „От:“. Започни директно с липсваща ## секция.`;
}

export function buildSalesReportAnalysisPrompt(
  input: SalesReportAnalysisInput,
  profile: AnalysisProfile,
  mode: "full" | "continue" = "full",
  priorText?: string,
): string {
  const sectionLabel = input.sectionLabel?.trim() || "История на продажби";
  const filtersHint = input.filtersHint?.trim() || "Без допълнителни филтри";
  const payload = JSON.stringify(enrichReportInsights(input.report), null, 2);

  if (mode === "continue" && priorText) {
    return continuePrompt(profile, priorText);
  }

  return `Ти помагаш на собственик/мениджър на СМОЛЯНКЛИМА (HVAC продажби и монтаж). Вече вижда графиките — твоята работа е да кажеш какво означават и какво да направи, не да преписваш цифри.

ПЕРИОД: ${profile.periodLabel}${profile.spanDays != null ? ` (~${profile.spanDays} дни)` : ""}
КОНТЕКСТ: ${sectionLabel} | Филтри: ${filtersHint}

ДАННИ + derivedPatterns (JSON — само за теб, НЕ цитирай като таблица):
${payload}

${depthRules(profile)}

${TONE_RULES}

${BANNED_RULES}

${sectionBlock(profile)}

Пиши на български, markdown, без code blocks. Започни веднага с първото ## заглавие.`;
}

/** Маха служебно „До:/От:“ и подобни preamble редове, ако моделът ги добави. */
export function stripAnalysisMemoPreamble(text: string): string {
  const lines = text.replace(/^\uFEFF/, "").split("\n");
  let start = 0;

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line) {
      start = i + 1;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) break;
    if (/^(до|от|тема|subject|date|дата)\s*:/i.test(line)) {
      start = i + 1;
      continue;
    }
    if (/^(уважаеми|уважаем|здравейте|нашият анализ)/i.test(line) && line.length < 160) {
      start = i + 1;
      continue;
    }
    if (/^(старши|senior|стратегически аналитик)/i.test(line) && line.length < 120) {
      start = i + 1;
      continue;
    }
    break;
  }

  return lines.slice(start).join("\n").trim();
}

function extractGeminiText(body: Record<string, unknown>): string {
  const parts = (body?.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined)?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text ?? "").join("").trim();
}

function getFinishReason(body: Record<string, unknown>): string | undefined {
  return (body?.candidates as { finishReason?: string }[] | undefined)?.[0]?.finishReason;
}

async function callGeminiText(
  prompt: string,
  profile: AnalysisProfile,
): Promise<{ text: string; usage: SalesReportAnalysisResult["usage"]; finishReason?: string }> {
  const env = getEnv();
  if (env.AI_ENABLED === false) {
    throw new Error("AI_DISABLED");
  }
  if (!env.GEMINI_API_KEY) {
    throw new Error("AI_MISCONFIGURED");
  }

  const model = env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: profile.temperature,
        maxOutputTokens: profile.maxOutputTokens,
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Gemini upstream error ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  }

  const text = extractGeminiText(body);
  const finishReason = getFinishReason(body);

  return {
    text,
    finishReason,
    usage: {
      promptTokens: (body?.usageMetadata as { promptTokenCount?: number })?.promptTokenCount ?? 0,
      completionTokens: (body?.usageMetadata as { candidatesTokenCount?: number })?.candidatesTokenCount ?? 0,
      totalTokens: (body?.usageMetadata as { totalTokenCount?: number })?.totalTokenCount ?? 0,
      model,
    },
  };
}

export async function generateSalesReportAiAnalysis(
  input: SalesReportAnalysisInput,
): Promise<SalesReportAnalysisResult> {
  const profile = inferAnalysisProfile(input);
  const first = await callGeminiText(buildSalesReportAnalysisPrompt(input, profile, "full"), profile);
  let text = first.text;
  let usage = first.usage;

  if (!text) {
    throw new Error("AI_EMPTY_RESPONSE");
  }

  const needsContinue =
    profile.allowContinue && (first.finishReason === "MAX_TOKENS" || text.length < profile.minChars);

  if (needsContinue) {
    const second = await callGeminiText(buildSalesReportAnalysisPrompt(input, profile, "continue", text), profile);
    if (second.text) {
      text = `${text}\n\n${second.text}`.trim();
      usage = {
        ...usage,
        completionTokens: usage.completionTokens + second.usage.completionTokens,
        totalTokens: usage.totalTokens + second.usage.totalTokens,
      };
    }
  }

  if (text.length < profile.tooShortChars) {
    throw new Error("AI_ANALYSIS_TOO_SHORT");
  }

  text = stripAnalysisMemoPreamble(text);

  return { text, usage, profile };
}
