/** Кажи на оперативния календар да презареди събитията (след нова поръчка и др.). */
export function notifyAdminCalendarReload(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sk-admin-calendar-reload"));
}
