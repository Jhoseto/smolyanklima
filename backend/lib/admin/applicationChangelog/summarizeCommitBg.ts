import { getEnv } from "@/lib/env";
import type { CommitSummaryBg } from "./types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_TITLE_LEN = 220;
const MAX_SUMMARY_LEN = 600;
const MIN_FALLBACK_TITLE_LEN = 50;

function resolveModel(): string {
  const env = getEnv();
  return env.GEMINI_CHANGELOG_MODEL ?? env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

function extractGeminiText(body: Record<string, unknown>): string {
  const parts = (body?.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined)?.[0]
    ?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text ?? "").join("").trim();
}

function parseSummaryJson(raw: string): CommitSummaryBg | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const tryParse = (text: string): CommitSummaryBg | null => {
    try {
      const parsed = JSON.parse(text) as { title_bg?: string; summary_bg?: string };
      const title = parsed.title_bg?.trim();
      const summary = parsed.summary_bg?.trim();
      if (!title || !summary) return null;
      if (title.length < 20) return null;
      return {
        title_bg: title.slice(0, MAX_TITLE_LEN),
        summary_bg: summary.slice(0, MAX_SUMMARY_LEN),
      };
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return tryParse(jsonMatch[0]);
}

function commitSubject(message: string): string {
  const first = message.split("\n")[0]?.trim() || message.trim();
  return first
    .replace(/^(feat|fix|refactor|chore|docs|style|test|perf|build|ci)(\([^)]*\))?!?:\s*/i, "")
    .trim();
}

function buildPrompt(input: SummarizeInput): string {
  const subject = commitSubject(input.message);
  const body = input.message.split("\n").slice(1).join("\n").trim();

  return `Преведи Git commit на български за собственик на бизнес (не програмист).

ВАЖНО за title_bg:
- Това е ПЪЛЕН превод на subject реда на commit-а — запази всички части и детайли
- Трябва да е ДЪЛГО и КОНКРЕТНО (50–220 символа), като заглавието в GitHub но на български
- НЕ съкращавай до 4–5 думи! НЕ използвай общи фрази като „Обновление на приложението“
- Ако subject съдържа няколко неща разделени с „;“ или „,“ — преведи ги ВСИЧКИ в title_bg
- Без feat/fix/refactor, без имена на файлове (.ts, .mjs), без SHA

За summary_bg:
- 1–2 изречения — какво означава промяната за екипа или клиентите на сайта
- Без английски

Subject (първи ред на commit):
${subject}
${body ? `\nДопълнителен текст:\n${body.slice(0, 500)}` : ""}

Върни САМО JSON:
{"title_bg":"...","summary_bg":"..."}`;
}

async function callGemini(prompt: string): Promise<string> {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const model = resolveModel();
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }

  const text = extractGeminiText(body);
  if (!text) throw new Error("Gemini empty response");
  return text;
}

export type SummarizeInput = {
  message: string;
  authorName: string | null;
  branches: string[];
  changedFiles: string[];
  insertions: number | null;
  deletions: number | null;
};

function cleanSubjectForTranslation(subject: string): string {
  return subject
    .replace(/\b[\w./-]+\.(ts|tsx|js|mjs|jsx|json|sql)\b/gi, "")
    .replace(/\bnext\.config\.mjs\b/gi, "конфигурацията на сайта")
    .replace(/\bin\s+[\w.-]+\.(ts|tsx|js|mjs|jsx)\b/gi, "в")
    .replace(/\s+/g, " ")
    .trim();
}

/** Phrase-level EN→BG for commit subjects when AI is unavailable. */
const PHRASE_MAP: [RegExp, string][] = [
  [/implement(ed)?/gi, "имплементирани"],
  [/legacy redirects?/gi, "пренасочвания на стари URL адреси"],
  [/enhance(d)?/gi, "подобрени"],
  [/improve(d)?/gi, "подобрени"],
  [/update(d)?/gi, "обновени"],
  [/add(ed)?/gi, "добавени"],
  [/introduce(d)?/gi, "въведена"],
  [/normalize(d)?/gi, "нормализирана"],
  [/integrate(d)?/gi, "интегрирани"],
  [/refactor(ed)?/gi, "преработени"],
  [/separate(d)?/gi, "разделено"],
  [/block(ing|ed|s)?/gi, "блокиране на"],
  [/\bto\b/gi, ""],
  [/\bin\b/gi, "в"],
  [/ with /gi, " с "],
  [/ and /gi, " и "],
  [/admin chat alerts?/gi, "известия в админ чата"],
  [/admin chat/gi, "админ чат"],
  [/admin functionality/gi, "функции в админ панела"],
  [/admin panel/gi, "админ панел"],
  [/admin navigation/gi, "навигация в админ панела"],
  [/verification scripts?/gi, "скриптове за проверка"],
  [/event terminology/gi, "наименования на събития"],
  [/visibility handling/gi, "показване на елементи"],
  [/inquiries components?/gi, "компоненти за запитвания"],
  [/reconnect handling/gi, "автоматично преключване при прекъсване на връзката"],
  [/idle timeout/gi, "изчакване при неактивност"],
  [/raw IP requests?/gi, "директни заявки по IP адрес"],
  [/proxy/gi, "прокси"],
  [/ProtocolFormWizard/gi, "формуляр за сервизни протоколи"],
  [/ProtocolPreview/gi, "преглед на протоколи"],
  [/materials handling/gi, "обработка на материали"],
  [/resolveMaterialQty/gi, "изчисление на количества материали"],
  [/quantity resolution/gi, "определяне на количества"],
  [/step labels/gi, "наименования на стъпки"],
  [/photo upload/gi, "качване на снимки"],
  [/camera and file input/gi, "камера и избор на файл"],
  [/user experience/gi, "удобство за потребителя"],
  [/accessibility/gi, "достъпност"],
  [/photo gallery/gi, "галерия със снимки"],
  [/signature display/gi, "показване на подпис"],
  [/PDF generation/gi, "генериране на PDF"],
  [/supplier orders?/gi, "поръчки към доставчици"],
  [/drag-and-drop sorting/gi, "подреждане с drag-and-drop"],
  [/product reservation/gi, "резервиране на продукти"],
  [/stock status/gi, "статус на наличност"],
  [/catalog filters?/gi, "филтри в каталога"],
  [/offline document/gi, "офлайн документи"],
  [/work items/gi, "работни задачи"],
  [/calendar/gi, "календар"],
  [/sale event/gi, "събитие тип продажба"],
  [/password validation/gi, "валидация на пароли"],
  [/mobile nav/gi, "мобилна навигация"],
  [/sidebar/gi, "странично меню"],
  [/sitemap/gi, "карта на сайта"],
  [/Montaz/gi, "страница Монтаж"],
  [/Bulclima|Condex|Bittel/gi, "каталог от доставчик"],
];

function applyPhraseMap(text: string): string {
  let out = text;
  for (const [re, bg] of PHRASE_MAP) {
    out = out.replace(re, bg);
  }
  return out
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s+,\s+/g, ", ")
    .replace(/,\s+и\s+/g, " и ")
    .replace(/\s+в\s+,/g, ",")
    .trim();
}

/** Detailed fallback: preserve full commit subject structure with phrase translation. */
export function detailedFallbackSummaryBg(message: string): CommitSummaryBg {
  const subject = cleanSubjectForTranslation(commitSubject(message));
  const body = message.split("\n").slice(1).join("\n").trim();

  let title = applyPhraseMap(subject);
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  if (title.length < MIN_FALLBACK_TITLE_LEN) {
    title = applyPhraseMap(commitSubject(message));
    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
  }

  const summary = body
    ? "Допълнителни подробности от разработката на системата."
    : "Промяна в админ панела или публичния сайт на Смолян Клима.";

  return {
    title_bg: title.slice(0, MAX_TITLE_LEN),
    summary_bg: summary.slice(0, MAX_SUMMARY_LEN),
  };
}

/** @deprecated Use detailedFallbackSummaryBg */
export function heuristicSummaryBg(message: string): CommitSummaryBg {
  return detailedFallbackSummaryBg(message);
}

export async function summarizeCommitBg(input: SummarizeInput): Promise<CommitSummaryBg> {
  const prompt = buildPrompt(input);
  const text = await callGemini(prompt);
  const parsed = parseSummaryJson(text);
  if (parsed) return parsed;

  const retryText = await callGemini(
    `${prompt}\n\nОтговорът трябва да е JSON с дълго title_bg (мин. 50 символа) — пълен превод на subject реда.`,
  );
  const retryParsed = parseSummaryJson(retryText);
  if (retryParsed) return retryParsed;

  throw new Error(`Invalid Gemini JSON: ${text.slice(0, 200)}`);
}

export function placeholderSummaryBg(): CommitSummaryBg {
  return {
    title_bg: "Обновление на приложението",
    summary_bg: "Описанието се генерира автоматично…",
  };
}
