/** Типове услуга от публични формуляри (contact, catalog inquiry). */
export const PUBLIC_INQUIRY_SERVICE_TYPES = [
  "consultation",
  "installation",
  "maintenance",
  "repair",
  "sale",
] as const;

export type PublicInquiryServiceType = (typeof PUBLIC_INQUIRY_SERVICE_TYPES)[number];

export function inquiryServiceTypeLabel(value: string | null | undefined): string {
  switch (value) {
    case "consultation":
      return "Консултация";
    case "sale":
      return "Продажба";
    case "installation":
      return "Монтаж";
    case "maintenance":
      return "Профилактика";
    case "repair":
      return "Ремонт";
    default:
      return value?.trim() ? value : "—";
  }
}
