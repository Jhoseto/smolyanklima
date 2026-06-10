export type ContactHistorySource = "work_item" | "inquiry" | undefined;

export type ContactHistoryTypeInput = {
  source?: ContactHistorySource;
  event_code?: string | null;
  type?: string | null;
  title?: string | null;
};

/** Етикет за колона „Тип“ в историята на контакт. */
export function contactHistoryTypeLabel(row: ContactHistoryTypeInput): string {
  if (row.source === "inquiry") return "Запитване";

  const code = (row.event_code ?? "").trim();
  if (code === "sale") return "Продажба";
  if (code === "supplier_order") return "Поръчка";
  if (code === "reservation") return "Резервация";
  if (code === "service_installation") return "Монтаж";
  if (code === "service_maintenance") return "Профилактика";
  if (code === "service_on_site") return "Сервиз на терен";
  if (code === "service_in_shop") return "Сервиз в склад";
  if (code === "consultation") return "Консултация";
  if (code === "item_added") return "Добавяне";
  if (code === "item_removed") return "Премахване";

  const title = (row.title ?? "").trim();
  const fromTitle = title.match(/^([^:]+):/)?.[1]?.trim();
  if (fromTitle) return fromTitle;

  if (row.type === "service") return "Сервиз";
  if (row.type === "sale") return "Продажба";
  return "Операция";
}

export function contactHistoryTypeBadgeClass(row: ContactHistoryTypeInput): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap border";
  if (row.source === "inquiry") return `${base} bg-purple-50 text-purple-700 border-purple-200`;

  const code = (row.event_code ?? "").trim();
  if (code === "sale") return `${base} bg-emerald-50 text-emerald-800 border-emerald-200`;
  if (code === "supplier_order") return `${base} bg-violet-50 text-violet-800 border-violet-200`;
  if (code === "reservation") return `${base} bg-sky-50 text-sky-900 border-sky-200`;
  if (code === "service_installation") return `${base} bg-brand-blue-50 text-brand-blue-800 border-brand-blue-200`;
  if (code === "service_maintenance") return `${base} bg-cyan-50 text-cyan-800 border-cyan-200`;
  if (code === "service_on_site" || code === "service_in_shop") {
    return `${base} bg-amber-50 text-amber-900 border-amber-200`;
  }
  if (code === "consultation") return `${base} bg-slate-50 text-slate-700 border-slate-200`;
  return `${base} bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200`;
}

/** Заглавие без повторение на типа („Монтаж: …“ → „…“). */
export function contactHistoryEventTitle(row: ContactHistoryTypeInput & { title: string }): string {
  const typeLabel = contactHistoryTypeLabel(row);
  const title = row.title.trim();
  if (!title) return "—";

  const prefixes = [typeLabel, "Поръчка от доставчик", "Резервация"];
  for (const prefix of prefixes) {
    const withColon = `${prefix}:`;
    if (title.startsWith(withColon)) return title.slice(withColon.length).trim() || title;
  }
  return title;
}
