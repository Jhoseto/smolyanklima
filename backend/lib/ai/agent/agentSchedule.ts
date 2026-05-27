/** Europe/Sofia scheduling helpers for agent scheduled reports. */

const TZ = "Europe/Sofia";

export type ReportFrequency = "daily" | "weekly" | "monthly";

export type ScheduleInput = {
  frequency: ReportFrequency;
  hourLocal: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
};

function sofiaParts(d: Date): { year: number; month: number; day: number; hour: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

function sofiaLocalToUtc(year: number, month: number, day: number, hour: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const probe = sofiaParts(guess);
  const offsetHours = probe.hour - hour;
  return new Date(Date.UTC(year, month - 1, day, hour - offsetHours, 0, 0));
}

export function computeNextRunAt(input: ScheduleInput, from = new Date()): Date {
  const { frequency, hourLocal } = input;

  for (let offset = 0; offset <= 400; offset += 1) {
    const probe = new Date(from.getTime() + offset * 24 * 60 * 60 * 1000);
    const p = sofiaParts(probe);

    if (frequency === "weekly") {
      const targetDow = input.dayOfWeek ?? 1;
      if (p.weekday !== targetDow) continue;
    }
    if (frequency === "monthly") {
      const targetDom = input.dayOfMonth ?? 1;
      if (p.day !== targetDom) continue;
    }

    const candidate = sofiaLocalToUtc(p.year, p.month, p.day, hourLocal);
    if (candidate.getTime() > from.getTime()) return candidate;
  }

  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

export function formatScheduleLabel(input: ScheduleInput & { hourLocal: number }): string {
  const hour = `${String(input.hourLocal).padStart(2, "0")}:00`;
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  if (input.frequency === "daily") return `Всеки ден в ${hour}`;
  if (input.frequency === "weekly") return `Всяка ${days[input.dayOfWeek ?? 1]} в ${hour}`;
  return `Всяко ${input.dayOfMonth ?? 1}-о число в ${hour}`;
}
