/** Ключове за пунктове в админ менюто — само brand orange/blue + slate (без „дъга“). */
export type AdminNavIconKey =
  | "dashboard"
  | "products"
  | "sales"
  | "orders"
  | "contacts"
  | "chat"
  | "inquiries"
  | "articles"
  | "ai-agent"
  | "documents"
  | "ratings"
  | "activity"
  | "tasks"
  | "staff"
  | "settings";

type NavIconStyle = { box: string; icon: string };

/** Приглушени фонове + икона в същото семейство — различими, но в рамките на бранда. */
export const ADMIN_NAV_ICON_STYLES: Record<AdminNavIconKey, NavIconStyle> = {
  dashboard: { box: "bg-slate-100", icon: "text-slate-600" },
  products: { box: "bg-brand-orange-50", icon: "text-brand-orange-600" },
  sales: { box: "bg-brand-orange-100", icon: "text-brand-orange-700" },
  orders: { box: "bg-brand-blue-50", icon: "text-brand-blue-700" },
  contacts: { box: "bg-brand-blue-100", icon: "text-brand-blue-600" },
  chat: { box: "bg-brand-blue-50", icon: "text-brand-blue-500" },
  inquiries: { box: "bg-brand-orange-50", icon: "text-brand-orange-500" },
  articles: { box: "bg-slate-100", icon: "text-slate-500" },
  "ai-agent": { box: "bg-slate-200", icon: "text-slate-600" },
  documents: { box: "bg-slate-100", icon: "text-slate-600" },
  ratings: { box: "bg-brand-orange-50", icon: "text-brand-orange-500" },
  activity: { box: "bg-brand-blue-50", icon: "text-brand-blue-600" },
  tasks: { box: "bg-brand-blue-100", icon: "text-brand-blue-700" },
  staff: { box: "bg-brand-blue-100", icon: "text-brand-blue-700" },
  settings: { box: "bg-slate-100", icon: "text-slate-500" },
};

export function adminNavIconClass(
  key: AdminNavIconKey,
  size: "sidebar" | "drawer" = "sidebar",
): string {
  const s = ADMIN_NAV_ICON_STYLES[key];
  const dim = size === "drawer" ? "w-8 h-8 rounded-xl" : "w-6 h-6 rounded-md";
  return `inline-flex items-center justify-center shrink-0 ${dim} ${s.box} ${s.icon}`;
}
