export const FOLLOW_UP_CALLS_CHANGED = "sk:follow-up-calls-changed";

export function notifyFollowUpCallsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FOLLOW_UP_CALLS_CHANGED));
}
