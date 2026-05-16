export type PublicInquiryPayload = {
  source: "contact" | "product" | "wizard" | "quick_view" | "ai";
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  message?: string;
  productSlug?: string;
  productName?: string;
  serviceType?: "sale" | "installation" | "maintenance" | "repair";
  /** true = с монтаж, false = само уред */
  includeInstallation?: boolean;
  /** Honeypot — трябва да е празно. */
  website?: string;
};

export async function postPublicInquiry(
  payload: PublicInquiryPayload,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const res = await fetch("/api/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: payload.source,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      message: payload.message,
      productSlug: payload.productSlug,
      productName: payload.productName,
      serviceType: payload.serviceType,
      includeInstallation: payload.includeInstallation,
      website: payload.website ?? "",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: typeof json.error === "string" ? json.error : "Грешка при изпращане", status: res.status };
  }
  return { ok: true };
}
