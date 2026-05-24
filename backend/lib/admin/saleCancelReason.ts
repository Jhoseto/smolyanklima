export const SALE_CANCEL_REASONS = ["client_declined", "staff_error"] as const;

export type SaleCancelReason = (typeof SALE_CANCEL_REASONS)[number];

export const SALE_CANCEL_REASON_LABELS: Record<SaleCancelReason, string> = {
  client_declined: "Клиентът се отказва",
  staff_error: "Лична грешка",
};

export function isSaleCancelReason(value: unknown): value is SaleCancelReason {
  return typeof value === "string" && (SALE_CANCEL_REASONS as readonly string[]).includes(value);
}

export function saleCancelReasonLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  if (isSaleCancelReason(value)) return SALE_CANCEL_REASON_LABELS[value];
  return value;
}
