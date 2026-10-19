/** Работно време на обекта — Europe/Sofia. Събота и неделя: почивни. */

export const BUSINESS_HOURS_TZ = 'Europe/Sofia';

/** Минути от полнощ: отворено ли е в този ден (0=Нед, 6=Съб). */
export const BUSINESS_HOURS_SCHEDULE: Record<number, { open: number; close: number } | null> = {
  0: null,
  1: { open: 9 * 60, close: 18 * 60 },
  2: { open: 9 * 60, close: 18 * 60 },
  3: { open: 9 * 60, close: 18 * 60 },
  4: { open: 9 * 60, close: 18 * 60 },
  5: { open: 9 * 60, close: 18 * 60 },
  6: null,
};

export const BUSINESS_HOURS_WEEKDAYS_LINE = 'Понеделник – Петък: 09:00 – 18:00';

export const BUSINESS_HOURS_WEEKEND_LINE = 'Събота и неделя: почивен ден';

export const BUSINESS_HOURS_SHORT =
  'Пн–Пт 09:00–18:00; събота и неделя — почивни дни';

/** За AI асистент и подсказки. */
export const BUSINESS_HOURS_AI_LINE =
  'Пн–Пт 09:00–18:00; събота и неделя — почивни дни';

/** За handoff съобщения (markdown bullets). */
export const BUSINESS_HOURS_HANDOFF_MARKDOWN =
  `• ${BUSINESS_HOURS_WEEKDAYS_LINE}\n• ${BUSINESS_HOURS_WEEKEND_LINE}`;

export const BUSINESS_HOURS_JSON_LD = [
  {
    '@type': 'OpeningHoursSpecification' as const,
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const,
    opens: '09:00',
    closes: '18:00',
  },
];
