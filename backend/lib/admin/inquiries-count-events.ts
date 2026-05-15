import { notifyFollowUpCallsChanged } from "@/lib/admin/follow-up-calls-events";

export const INQUIRIES_COUNT_CHANGED = "sk:inquiries-count-changed";
/** localStorage ключ — storage event между табове (без допълнителни заявки). */
export const INQUIRIES_CHANGED_STORAGE_KEY = "sk:inquiries-changed-at";

export function notifyInquiriesCountChanged(count?: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INQUIRIES_CHANGED_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(INQUIRIES_COUNT_CHANGED, { detail: { count } }),
  );
}

/** Badge + CRM панел „Контакти за обаждане“ след промяна на запитване. */
export function notifyInquiriesChanged(count?: number) {
  notifyInquiriesCountChanged(count);
  notifyFollowUpCallsChanged();
}
