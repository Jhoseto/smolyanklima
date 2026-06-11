import {
  normalizeProtocolEmailForApi,
  normalizeProtocolPhoneForApi,
  normalizeWorkItemIdForApi,
} from "@/lib/protocol-contact-validation";

/** Нормализира тяло за POST/PUT — избягва 400/404 при sync от кеш. */
export function sanitizeAcceptanceProtocolBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const paidRaw = body.paid_amount;
  let paid: number | null = null;
  if (typeof paidRaw === "number" && Number.isFinite(paidRaw) && paidRaw >= 0) {
    paid = paidRaw;
  } else if (typeof paidRaw === "string" && paidRaw.trim()) {
    const n = parseFloat(paidRaw);
    if (Number.isFinite(n) && n >= 0) paid = n;
  }

  return {
    ...body,
    work_item_id: normalizeWorkItemIdForApi(body.work_item_id as string | null | undefined),
    client_email: normalizeProtocolEmailForApi(body.client_email as string | null | undefined),
    client_phone: normalizeProtocolPhoneForApi(body.client_phone as string | null | undefined),
    paid_amount: paid,
  };
}

/** Четим текст от JSON грешка в опашката. */
export function parseOfflineApiError(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  try {
    const j = JSON.parse(t) as { error?: string; message?: string };
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
  } catch {
    /* не е JSON */
  }
  if (t.includes("Cannot coerce the result to a single JSON object")) {
    return "Протоколът не съществува на сървъра — ще опитаме да го създадем отново.";
  }
  return t.length > 300 ? `${t.slice(0, 299)}…` : t;
}
