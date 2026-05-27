export type AutoToolPlan = { name: string; args: Record<string, unknown> };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function detectPeriodDays(message: string): number {
  const m = message.toLowerCase();
  if (/годин|г\.|year/.test(m)) return 365;
  if (/месец/.test(m)) return 30;
  const dayMatch = m.match(/(\d+)\s*д(?:ен|ни)/);
  if (dayMatch) return Math.min(Math.max(parseInt(dayMatch[1], 10), 1), 90);
  if (/седмиц/.test(m)) return 7;
  return 30;
}

const META_QUESTION =
  /^(здрав|привет|благодар|help\b|какво можеш|с какво мож|кои си|как работиш|какви теми)/;

/** Въпрос за UI, flow, обучение, навигация в admin панела — knowledge-based, не tools. */
export function isAdminGuideQuestion(message: string): boolean {
  const m = message.toLowerCase().trim();
  if (/обучител|обучени|инструкци|rъководств|tutorial|manual\b|onboarding|обясни.*панел/.test(m)) return true;
  if (/нов(?:и)?\s+(?:офис\s+)?(?:служител|служители|employee|staff)/.test(m)) return true;
  if (/как (?:да|се) (?:работ|ползва|регистрира|създам|запиш|продам|добав|намер|отвор|клик|въвед|направ)/.test(m)) return true;
  if (/къде (?:да|се|е) (?:намер|намирам|отид|кликна|въвед|отвор)/.test(m)) return true;
  if (/(?:flow|процес|стъпк|workflow)/.test(m) && /(?:админ|панел|систем|офис|panel|admin)/.test(m)) return true;
  if (/(?:интерфейс|меню|навигац|екран|бутон|форм)/.test(m) && /(?:админ|panel|admin|панел)/.test(m)) return true;
  if (/административн(?:ия|ия)?\s+панел/.test(m)) return true;
  if (/помощ.*(?:панел|admin|админ|интерфейс|систем)/.test(m)) return true;
  return false;
}

/** Изрично иска списък — допустим е табличен отговор без пълен анализ. */
export function isRawListRequest(message: string): boolean {
  const m = message.toLowerCase().trim();
  return /^(покажи|изброи|списък|дай списък|кои са|преглед на всички|list\b)/.test(m)
    || /покажи ми|списък с|изброи всички|последни\s+\d*\s*(?:запис|реда|продукт|клиент|събит)/.test(m);
}

/** Всяка заявка, която изисква факти от системата. */
export function requiresToolData(message: string): boolean {
  const m = message.toLowerCase().trim();
  if (!m || META_QUESTION.test(m)) return false;
  if (isAdminGuideQuestion(message)) return false;

  return /анализ|активност|продаж|запитван|наличност|склад|монт|сервиз|протокол|отчет|статистик|колко|брой|седмиц|месец|годин|(?:последн|минал).*(?:ден|дни|седмиц|месец|годин)|фирм|компан|календар|доставчик|инвентар|рейтинг|имейл|бюлетин|backup|архив|одит|лог|действ|случил|направил|данни|kpi|показател|обобщ|преглед|продукт|климатик|клиент|контакт|crm|аксесоар|резервн|част|марка|btu|seer|scop|цена|поръчк|синхрон|каталог|блог|статия|чат|абонат|newsletter|екип|служител|персонал|staff|настройк|топ|най-|compare|сравн|препоръ|какво|колко|има ли|кои|where|къде/.test(
    m,
  );
}

function addPlan(plans: AutoToolPlan[], seen: Set<string>, name: string, args: Record<string, unknown>) {
  const key = `${name}:${JSON.stringify(args)}`;
  if (seen.has(key)) return;
  seen.add(key);
  plans.push({ name, args });
}

export function planAutoTools(message: string): AutoToolPlan[] {
  if (!requiresToolData(message)) return [];

  const m = message.toLowerCase();
  const days = detectPeriodDays(m);
  const from = isoDaysAgo(days);
  const to = todayIso();
  const plans: AutoToolPlan[] = [];
  const seen = new Set<string>();

  const wantsPeriod = /седмиц|месец|годин|период|последн|минал|днес|вчера|дни/.test(m);

  // --- Cross-cutting context (period overviews, analysis, „какво се случи“) ---
  if (
    /анализ|обобщ|преглед|отчет|какво се случ|всичко|фирм|компан|бизнес|операци|случил|активност|админ|kpi|показател/.test(m)
  ) {
    addPlan(plans, seen, "get_dashboard_summary", {});
    addPlan(plans, seen, "query_inquiries", { from, to, limit: 50 });
    addPlan(plans, seen, "query_work_items", { from, to, limit: 50 });
    if (/активност|одит|лог|действ|админ/.test(m)) {
      addPlan(plans, seen, "query_activity_logs", { from, to, aggregate: true, limit: 500 });
    }
  }

  // --- Sales & calendar ---
  if (/продаж|оборот|приход|sale/.test(m)) {
    addPlan(plans, seen, "aggregate_sales", { from, to });
    addPlan(plans, seen, "query_work_items", { from, to, eventCode: "sale", limit: 50 });
  }

  if (/монтаж|календар|работ|задач|service_installation|profilakt/.test(m)) {
    addPlan(plans, seen, "query_work_items", { from: wantsPeriod ? from : undefined, to: wantsPeriod ? to : undefined, limit: 50 });
  }

  // --- Inquiries & CRM ---
  if (/запитван|lead|лид|обаждан|конверси/.test(m)) {
    addPlan(plans, seen, "query_inquiries", { from: wantsPeriod ? from : undefined, to: wantsPeriod ? to : undefined, limit: 50 });
  }

  if (/клиент|контакт|crm|телефон.*клиент/.test(m)) {
    addPlan(plans, seen, "query_contacts", { limit: 40 });
  }

  // --- Products & inventory ---
  if (/продукт|климатик|каталог|btu|seer|scop|марка|наличност|склад|инвентар|stock/.test(m)) {
    addPlan(plans, seen, "aggregate_inventory", {});
    if (/продукт|климатик|каталог|btu|seer|марка|най-|топ/.test(m)) {
      addPlan(plans, seen, "query_products", { limit: 40 });
    }
  }

  if (/аксесоар|резервн|част|filter|филтър/.test(m)) {
    addPlan(plans, seen, "query_accessories", { limit: 40 });
  }

  if (/рейтинг|отзив|review|звезд/.test(m)) {
    addPlan(plans, seen, "query_ratings_summary", { limit: 20 });
  }

  // --- Service & protocols ---
  if (/протокол|приемо|предавател|service_protocol|repair protocol/.test(m)) {
    addPlan(plans, seen, "query_service_protocols", { limit: 40 });
  }

  // --- Suppliers ---
  if (/доставчик|bulclima|climacom|condex|bittel|синхрон|sync|каталог.*достав/.test(m)) {
    addPlan(plans, seen, "query_suppliers", {});
    if (/синхрон|sync|bulclima|climacom|condex|bittel/.test(m)) {
      const slug = m.match(/bulclima|climacom|condex|bittel/)?.[0];
      if (slug) addPlan(plans, seen, "get_supplier_sync_status", { catalogSlug: slug });
    }
  }

  if (/поръчк.*доставчик|supplier_order/.test(m)) {
    addPlan(plans, seen, "query_supplier_orders", { limit: 30 });
  }

  // --- Comms & content ---
  if (/имейл|outbox|изпрат.*mail|пощ/.test(m)) {
    addPlan(plans, seen, "query_email_outbox", { limit: 30 });
  }

  if (/чат|live chat|посетител/.test(m)) {
    addPlan(plans, seen, "query_live_chats", { limit: 30 });
  }

  if (/бюлетин|newsletter|абонат/.test(m)) {
    addPlan(plans, seen, "query_newsletter", { limit: 30 });
  }

  if (/статия|блог|article/.test(m)) {
    addPlan(plans, seen, "query_articles", { limit: 20 });
  }

  // --- Team & settings ---
  if (/екип|служител|персонал|staff|админ.*потребител/.test(m)) {
    addPlan(plans, seen, "query_staff", {});
  }

  if (/настройк|settings|конфиг/.test(m)) {
    addPlan(plans, seen, "query_settings", {});
  }

  // --- Activity raw list (explicit only) ---
  if (isRawListRequest(message) && /активност|лог|одит|събит|действ/.test(m)) {
    addPlan(plans, seen, "query_activity_logs", { from, to, limit: 25 });
  }

  // --- Fallback: any data question gets at least dashboard ---
  if (plans.length === 0) {
    addPlan(plans, seen, "get_dashboard_summary", {});
  }

  return plans;
}

/** Cap regex prefetch — remainder can be fetched by Gemini tool loop. */
export function capPrefetchPlans(plans: AutoToolPlan[], max: number): AutoToolPlan[] {
  if (max <= 0 || plans.length <= max) return plans;
  return plans.slice(0, max);
}

export function prefetchToolKey(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(args)}`;
}

export function postPrefetchToolNudge(): string {
  return [
    "Предварителни данни са заредени по-горе.",
    "Ако липсва информация за въпроса — извикай допълнителни tools.",
    "Не повтаряй същите tool calls със същите args.",
    "След достатъчно данни — финален JSON отговор ще бъде поискан отделно.",
  ].join(" ");
}

export function toolDataRefusalNudge(): string {
  return [
    "СТОП. Отговорът трябва да е базиран САМО на реални данни от tools.",
    "Извикай подходящи tools за темата на въпроса.",
    "Забранено е да измисляш имена, дати, числа или примерни таблици.",
    "След tools: анализ + препоръки, не copy-paste от admin панела.",
  ].join(" ");
}

export type PrefetchedToolResult = {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
};

const TOOL_CONTEXT_MAX_CHARS = 5500;
const ARRAY_SAMPLE = 8;

const COMPACT_PRIORITY_KEYS = [
  "summary",
  "chartSuggestion",
  "byAction",
  "byStatus",
  "byEvent",
  "note",
  "totals",
  "count",
  "total",
  "kpis",
  "period",
  "from",
  "to",
  "message",
  "error",
  "ok",
  "success",
] as const;

function compactValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 4) return "[…]";
  if (typeof value === "string") return value.length > 360 ? `${value.slice(0, 360)}…` : value;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    if (value.length <= ARRAY_SAMPLE) return value.map((v) => compactValue(v, depth + 1));
    return {
      _sample: value.slice(0, ARRAY_SAMPLE).map((v) => compactValue(v, depth + 1)),
      _total: value.length,
    };
  }

  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of COMPACT_PRIORITY_KEYS) {
    if (k in o) out[k] = compactValue(o[k], depth + 1);
  }
  for (const [k, v] of Object.entries(o)) {
    if (k in out) continue;
    if (Array.isArray(v) && v.length > ARRAY_SAMPLE) {
      out[k] = {
        _sample: v.slice(0, ARRAY_SAMPLE).map((x) => compactValue(x, depth + 1)),
        _total: v.length,
      };
    } else {
      out[k] = compactValue(v, depth + 1);
    }
  }
  return out;
}

export function compactToolResultForPrompt(result: Record<string, unknown>): Record<string, unknown> {
  const compact = compactValue(result) as Record<string, unknown>;
  let json = JSON.stringify(compact);
  if (json.length <= TOOL_CONTEXT_MAX_CHARS) return compact;

  const minimal: Record<string, unknown> = {};
  for (const k of COMPACT_PRIORITY_KEYS) {
    if (k in result) minimal[k] = result[k];
  }
  if (Object.keys(minimal).length > 0) {
    json = JSON.stringify(minimal);
    if (json.length <= TOOL_CONTEXT_MAX_CHARS) return minimal;
  }

  return { summary: json.slice(0, TOOL_CONTEXT_MAX_CHARS), truncated: true };
}

function formatToolResultBlock(name: string, args: Record<string, unknown>, result: Record<string, unknown>): string {
  const argsJson = JSON.stringify(args);
  const resultJson = JSON.stringify(compactToolResultForPrompt(result));
  return `Tool: ${name}\nArgs: ${argsJson}\nResult: ${resultJson}`;
}

/** Inject prefetched tool data as text — avoids synthetic functionCall (Gemini thought_signature). */
export function formatPrefetchedToolContext(results: PrefetchedToolResult[]): string {
  if (results.length === 0) return "";
  const blocks = results.map((entry) => formatToolResultBlock(entry.name, entry.args, entry.result));
  return [
    "=== Данни от системата (предварително заредени — ползвай за отговора; не измисляй) ===",
    ...blocks,
  ].join("\n\n");
}

export function formatExecutedToolResults(
  entries: Array<{ name: string; args: Record<string, unknown>; result: Record<string, unknown> }>,
): string {
  if (entries.length === 0) return "";
  const blocks = entries.map((entry) => formatToolResultBlock(entry.name, entry.args, entry.result));
  return ["=== Резултати от tools ===", ...blocks].join("\n\n");
}
