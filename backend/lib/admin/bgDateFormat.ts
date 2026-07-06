/**
 * Deterministic Bulgarian calendar labels for SSR + client hydration.
 * Avoid Intl/toLocaleDateString — Node (Alpine/UTC) and browsers can differ in production.
 */

export const BG_MONTHS_LONG = [
  "Януари",
  "Февруари",
  "Март",
  "Април",
  "Май",
  "Юни",
  "Юли",
  "Август",
  "Септември",
  "Октомври",
  "Ноември",
  "Декември",
] as const;

export const BG_WEEKDAYS_LONG = [
  "Неделя",
  "Понеделник",
  "Вторник",
  "Сряда",
  "Четвъртък",
  "Петък",
  "Събота",
] as const;

export const BG_WEEKDAYS_SHORT = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

function parseYmd(key: string): { y: number; m: number; d: number } {
  const [y, mo, d] = key.slice(0, 10).split("-").map(Number);
  return { y, m: mo - 1, d };
}

function weekdayIndex(y: number, m: number, d: number): number {
  return new Date(y, m, d).getDay();
}

/** e.g. „Юли 2026“ */
export function formatBgMonthYear(year: number, monthIndex: number): string {
  return `${BG_MONTHS_LONG[monthIndex]} ${year}`;
}

/** e.g. „понеделник, 6 юли“ (matches prior toLocaleDateString weekday/day/month) */
export function formatBgWeekdayDayMonth(dateKey: string): string {
  const { y, m, d } = parseYmd(dateKey);
  const wd = BG_WEEKDAYS_LONG[weekdayIndex(y, m, d)];
  return `${wd}, ${d} ${BG_MONTHS_LONG[m]}`;
}

/** e.g. „пн, 6 юли 2026“ */
export function formatBgWeekdayShortDayMonthYear(dateKey: string): string {
  const { y, m, d } = parseYmd(dateKey);
  const wd = BG_WEEKDAYS_SHORT[weekdayIndex(y, m, d)];
  return `${wd}, ${d} ${BG_MONTHS_LONG[m]} ${y}`;
}

/** e.g. „06.07.2026“ for due dates in confirm copy */
export function formatBgNumericDate(isoOrYmd: string): string {
  const { y, m, d } = parseYmd(isoOrYmd);
  return `${String(d).padStart(2, "0")}.${String(m + 1).padStart(2, "0")}.${y}`;
}
