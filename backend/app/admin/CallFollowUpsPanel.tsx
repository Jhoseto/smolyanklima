"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardPanel, type DashboardPanelItem } from "./DashboardPanel";
import {
  ConsultationCompleteConfirmModal,
  type ConsultationCompletePreview,
} from "./ConsultationCompleteConfirmModal";
import { FOLLOW_UP_CALLS_CHANGED, notifyFollowUpCallsChanged } from "@/lib/admin/follow-up-calls-events";
import {
  INQUIRIES_CHANGED_STORAGE_KEY,
  INQUIRIES_COUNT_CHANGED,
} from "@/lib/admin/inquiries-count-events";
import { countWaitingFollowUps } from "@/lib/admin/call-follow-up-items";

function panelItemToPreview(item: DashboardPanelItem): ConsultationCompletePreview {
  return {
    title: item.title,
    customerName: item.consultationCustomerName,
    customerPhone: item.consultationCustomerPhone,
    dueDate: item.consultationDueDate,
  };
}

export function CallFollowUpsPanel({
  initialItems,
  readOnly,
}: {
  initialItems: DashboardPanelItem[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [confirmItem, setConfirmItem] = useState<DashboardPanelItem | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/dashboard/call-follow-ups", { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setItems((json as { items?: DashboardPanelItem[] }).items ?? []);
  }, []);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const onChanged = () => {
      void refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === INQUIRIES_CHANGED_STORAGE_KEY) void refresh();
    };
    window.addEventListener(FOLLOW_UP_CALLS_CHANGED, onChanged);
    window.addEventListener(INQUIRIES_COUNT_CHANGED, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(FOLLOW_UP_CALLS_CHANGED, onChanged);
      window.removeEventListener(INQUIRIES_COUNT_CHANGED, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  async function confirmComplete() {
    if (!confirmItem?.consultationWorkItemId) return;
    const workItemId = confirmItem.consultationWorkItemId;
    setCompletingId(workItemId);
    try {
      const res = await fetch(`/api/admin/work-items/${workItemId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((json as { error?: string }).error || "Грешка при маркиране като завършена");
        return;
      }
      setConfirmItem(null);
      await refresh();
      notifyFollowUpCallsChanged();
    } finally {
      setCompletingId(null);
    }
  }

  const waitingCount = countWaitingFollowUps(items);

  return (
    <>
      <DashboardPanel
        title="Контакти за обаждане"
        description="CRM контакти и консултации за обаждане до днес. Чакащите са най-отгоре."
        href="/admin/contacts"
        empty="Няма планирани обаждания за днес."
        badge={waitingCount}
        tone={waitingCount > 0 ? "info" : "neutral"}
        readOnly={readOnly}
        items={items}
        onRequestCompleteConsultation={(item) => setConfirmItem(item)}
        completingConsultationId={completingId}
        onOpenInquiry={(inquiryId) => router.push(`/admin/inquiries?id=${encodeURIComponent(inquiryId)}`)}
      />

      {confirmItem && (
        <ConsultationCompleteConfirmModal
          preview={panelItemToPreview(confirmItem)}
          savingBusy={completingId !== null}
          onCancel={() => !completingId && setConfirmItem(null)}
          onConfirm={() => void confirmComplete()}
        />
      )}
    </>
  );
}
