import type { ApplicationChangelogRow } from "./types";

const GENERIC_TITLES = new Set([
  "Обновление на приложението",
  "Подобрена навигация на сайта",
  "Подобрен чат в админ панела",
  "Подобрени сервизни документи",
  "Подобрения в каталога",
  "Подобрения при поръчки към доставчици",
  "Подобрено качване на снимки",
  "Подобрена навигация в админ панела",
  "Подобрения в потребителските настройки",
  "Подобрения на публичния сайт",
  "Обновен продуктов каталог",
  "Подобрени форми в системата",
  "Подобрения в графика и историята",
]);

/** Minimum title length for a commit with a detailed subject translation. */
const MIN_DETAILED_TITLE_LEN = 50;

export function isGenericSummary(row: Pick<ApplicationChangelogRow, "title_bg" | "sync_error">): boolean {
  const title = row.title_bg?.trim() ?? "";
  if (GENERIC_TITLES.has(title)) return true;
  if (title.length > 0 && title.length < MIN_DETAILED_TITLE_LEN) return true;
  if (row.sync_error?.startsWith("Gemini ") || row.sync_error?.startsWith("Invalid Gemini")) return true;
  return false;
}

export function needsAiResummary(row: ApplicationChangelogRow): boolean {
  if (row.sync_status === "failed" || row.sync_status === "pending") return true;
  return isGenericSummary(row);
}
