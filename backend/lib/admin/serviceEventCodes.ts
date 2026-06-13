export const PAID_SERVICE_EVENT_CODES = [
  "service_installation",
  "service_maintenance",
  "service_on_site",
  "service_in_shop",
] as const;

export type PaidServiceEventCode = (typeof PAID_SERVICE_EVENT_CODES)[number];

export const PAID_SERVICE_EVENT_LABELS: Record<PaidServiceEventCode, string> = {
  service_installation: "Монтаж",
  service_maintenance: "Профилактика",
  service_on_site: "Сервиз на терен",
  service_in_shop: "Сервиз в склад",
};

export function isPaidServiceEventCode(code: string | null | undefined): code is PaidServiceEventCode {
  return Boolean(code && (PAID_SERVICE_EVENT_CODES as readonly string[]).includes(code));
}

export type SalesPanelTabId = "products" | PaidServiceEventCode;

export const SALES_PANEL_TABS: Array<{ id: SalesPanelTabId; label: string; eventCode: string }> = [
  { id: "products", label: "Климатици", eventCode: "sale" },
  /** Монтаж без продажба на климатик — монтажи от продажби са в таб „Климатици“. */
  { id: "service_installation", label: "Само монтаж", eventCode: "service_installation" },
  { id: "service_maintenance", label: "Профилактика", eventCode: "service_maintenance" },
  { id: "service_on_site", label: "Сервиз на терен", eventCode: "service_on_site" },
  { id: "service_in_shop", label: "Сервиз в склад", eventCode: "service_in_shop" },
];

export function salesPanelEventCode(tab: SalesPanelTabId): string {
  return SALES_PANEL_TABS.find((t) => t.id === tab)?.eventCode ?? "sale";
}
