"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HelpRow,
  InfoDot,
  SectionTitle,
  HelpCard,
  Card,
  Input,
  Select,
  Button,
  Table,
  Th,
  Td,
  Textarea,
  HoverTip,
  AdminPhoneLink,
  AdminLabeledBox,
} from "../ui";
import { RefreshCw, MessageSquare, PlayCircle, CheckCircle, ShieldAlert, StickyNote, Sparkles, X, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { assertNoContactPrimaryPhoneDuplicate } from "@/lib/admin/contactPhoneConflictClient";
import { notifyInquiriesChanged } from "@/lib/admin/inquiries-count-events";
import { InquiryProductCards } from "./InquiryProductCards";
import { inquiryServiceTypeLabel } from "@/lib/inquiry/serviceTypeLabels";

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap border ${colorClass}`}>
      {label}
    </span>
  );
}

function statusLabel(status: string) {
  if (status === "new") return { label: "Ново", colorClass: "bg-orange-100 border-orange-200 text-orange-800" };
  if (status === "in_progress") return { label: "В работа", colorClass: "bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700" };
  if (status === "done") return { label: "Приключено", colorClass: "bg-green-100 border-green-200 text-green-800" };
  if (status === "spam") return { label: "Спам", colorClass: "bg-red-100 border-red-200 text-red-800" };
  return { label: status || "—", colorClass: "bg-slate-100 border-slate-200 text-slate-600" };
}

const INQUIRY_TIPS = {
  details: "Пълен преглед на запитването",
  notes: "Вътрешни бележки — клиентът не ги вижда",
  inProgress: "Маркирай като „В работа“",
  contact: "Създай CRM контакт с планирано обаждане",
  inspection: "Създай събитие за оглед в календара",
  ai: "Генерирай AI чернова за отговор",
  done: "Приключи — запитването е обработено",
  spam: "Маркирай като спам",
  refresh: "Презареди списъка",
  prevPage: "Предишна страница",
  nextPage: "Следваща страница",
  close: "Затвори",
  saveNotes: "Запази вътрешните бележки",
  saveAi: "Запиши AI черновата в бележките",
} as const;

function priorityLabel(priority: string) {
  if (priority === "high") return { label: "Висок", colorClass: "bg-red-100 border-red-200 text-red-800" };
  if (priority === "medium") return { label: "Среден", colorClass: "bg-amber-100 border-amber-200 text-amber-800" };
  if (priority === "low") return { label: "Нисък", colorClass: "bg-slate-100 border-slate-200 text-slate-700" };
  return { label: priority || "—", colorClass: "bg-slate-100 border-slate-200 text-slate-600" };
}

function sourceLabel(source: string): { label: string; colorClass: string } {
  const map: Record<string, { label: string; colorClass: string }> = {
    contact:    { label: "📝 Форма",        colorClass: "bg-slate-100 border-slate-200 text-slate-600" },
    product:    { label: "🛒 Продукт",      colorClass: "bg-blue-50 border-blue-200 text-blue-700" },
    wizard:     { label: "📋 Анкета",       colorClass: "bg-violet-50 border-violet-200 text-violet-700" },
    quick_view: { label: "👁 Бърз преглед", colorClass: "bg-amber-50 border-amber-200 text-amber-700" },
    ai:         { label: "🤖 AI чат",       colorClass: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  };
  return map[source] ?? { label: source || "—", colorClass: "bg-slate-100 border-slate-200 text-slate-600" };
}

type InquiryProduct = {
  id: string;
  inquiry_id: string;
  product_id: string | null;
  product_slug: string | null;
  product_name: string;
  created_at: string;
  image_url?: string | null;
  price?: number | null;
  price_with_mount?: number | null;
  brand_name?: string | null;
};

type Inquiry = {
  id: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  message?: string | null;
  product_id?: string | null;
  service_type?: string | null;
  include_installation?: boolean | null;
  status: string;
  priority: string;
  assigned_to?: string | null;
  admin_notes?: string | null;
  created_at: string;
  products?: InquiryProduct[];
};

type AiReplyDraft = {
  inquiryId: string;
  customerName: string;
  currentAdminNotes?: string | null;
  reply: string;
  internalNote: string;
  priority: string;
};

export function InquiriesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromUrlRef = useRef<string | null>(null);
  const [items, setItems] = useState<Inquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [q, setQ] = useState("");
  const [notesForId, setNotesForId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [aiReplyDraft, setAiReplyDraft] = useState<AiReplyDraft | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  useAdminBackHandler(Boolean(selectedInquiry) && !notesForId && !aiReplyDraft, () => setSelectedInquiry(null), "inquiry-detail");
  useAdminBackHandler(Boolean(notesForId), () => setNotesForId(null), notesForId ? `inquiry-notes-${notesForId}` : undefined);
  useAdminBackHandler(Boolean(aiReplyDraft), () => setAiReplyDraft(null), "inquiry-ai-draft");
  const selectedDisplayProducts = useMemo(
    () => productsForInquiryDisplay(selectedInquiry),
    [selectedInquiry],
  );
  const [inqPage, setInqPage] = useState(1);
  const [inqTotal, setInqTotal] = useState(0);
  const INQ_PER_PAGE = 50;

  const debouncedQ = useDebounce(q, 350);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (source) sp.set("source", source);
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    sp.set("page", String(inqPage));
    sp.set("perPage", String(INQ_PER_PAGE));
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [status, source, debouncedQ, inqPage]);

  useEffect(() => { setInqPage(1); }, [status, source, debouncedQ]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries${queryString}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setInqTotal(json.meta?.total ?? (json.data?.length ?? 0));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { void load(); }, [load]);

  const closeInquiryDetail = useCallback(() => {
    setSelectedInquiry(null);
    if (searchParams.get("id")) router.replace("/admin/inquiries");
  }, [router, searchParams]);

  const openInquiryDetail = useCallback(async (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    router.replace(`/admin/inquiries?id=${inquiry.id}`);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, { credentials: "include" });
      const json = await res.json();
      if (res.ok && json.data) setSelectedInquiry(json.data as Inquiry);
    } catch {
      /* запазваме данните от списъка */
    }
  }, [router]);

  useEffect(() => {
    const id = searchParams.get("id")?.trim();
    if (!id) {
      openedFromUrlRef.current = null;
      return;
    }
    if (openedFromUrlRef.current === id && selectedInquiry?.id === id) return;

    const fromList = items.find((row) => row.id === id);
    if (fromList) {
      openedFromUrlRef.current = id;
      void openInquiryDetail(fromList);
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/admin/inquiries/${id}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Грешка");
        openedFromUrlRef.current = id;
        setSelectedInquiry(json.data as Inquiry);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Грешка при зареждане на запитването");
      }
    })();
  }, [searchParams, items, selectedInquiry?.id, openInquiryDetail]);

  useEffect(() => {
    let events: EventSource | null = null;

    function connect() {
      if (typeof document !== "undefined" && document.hidden) return;
      events?.close();
      events = new EventSource("/api/admin/inquiries/stream");
      wireEvents(events);
    }

    function wireEvents(es: EventSource) {
      function parseNewCount(data: string): number | undefined {
        try {
          const payload = JSON.parse(data) as { newCount?: number };
          return typeof payload.newCount === "number" ? payload.newCount : undefined;
        } catch {
          return undefined;
        }
      }

      es.addEventListener("ready", (ev) => {
        setLiveConnected(true);
        notifyInquiriesChanged(parseNewCount((ev as MessageEvent).data));
      });
      es.addEventListener("changed", (ev) => {
        setLiveConnected(true);
        setLastLiveUpdate(new Date().toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        const newCount = parseNewCount((ev as MessageEvent).data);
        notifyInquiriesChanged(newCount);
        void load({ silent: true });
      });
      es.onerror = () => setLiveConnected(false);
    }

    connect();

    const onVisibility = () => {
      if (document.hidden) {
        events?.close();
        events = null;
        setLiveConnected(false);
      } else {
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      events?.close();
      setLiveConnected(false);
    };
  }, [load]);

  async function quickUpdate(id: string, patch: { status?: string; priority?: string; adminNotes?: string | null }) {
    setError(null);
    const body: Record<string, unknown> = {};
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.priority !== undefined) body.priority = patch.priority;
    if (patch.adminNotes !== undefined) body.adminNotes = patch.adminNotes;
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Грешка"); return; }
    setItems(prev => prev.map(it => it.id === id ? {
      ...it,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.adminNotes !== undefined ? { admin_notes: patch.adminNotes } : {}),
    } : it));
    setSelectedInquiry(prev => prev?.id === id ? {
      ...prev,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.adminNotes !== undefined ? { admin_notes: patch.adminNotes } : {}),
    } : prev);
    if (patch.status !== undefined) notifyInquiriesChanged();
  }

  async function createContactFromInquiry(inquiry: Inquiry) {
    setActionBusy(`contact:${inquiry.id}`);
    setError(null);
    try {
      const phone = String(inquiry.customer_phone ?? "").trim();
      if (phone.length >= 3) {
        await assertNoContactPrimaryPhoneDuplicate(phone);
      }
      const res = await fetch("/api/admin/contacts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: inquiry.customer_name,
          phone,
          email: inquiry.customer_email ?? null,
          notes: inquiry.message ? `От заявка: ${inquiry.message}` : null,
          customerStatus: "new", nextFollowUpAt: new Date().toISOString().slice(0, 10),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as Record<string, string>).error || "Грешка при създаване на контакт");
      await quickUpdate(inquiry.id, { adminNotes: appendNote(inquiry.admin_notes, "Създаден контакт от заявката.") });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally { setActionBusy(null); }
  }

  async function createInspectionFromInquiry(inquiry: Inquiry) {
    setActionBusy(`work:${inquiry.id}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/work-items", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "service", eventCode: "service_on_site",
          title: `Оглед: ${inquiry.customer_name}`,
          dueDate: new Date().toISOString().slice(0, 10),
          status: "planned", priority: inquiry.priority === "high" ? "high" : "medium",
          inquiryId: inquiry.id, productId: inquiry.product_id ?? null,
          customerName: inquiry.customer_name, customerPhone: inquiry.customer_phone,
          notes: [inquiry.service_type ? `Услуга: ${inquiryServiceTypeLabel(inquiry.service_type)}` : "", inquiry.message ?? ""].filter(Boolean).join("\n\n") || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as Record<string, string>).error || "Грешка при създаване на събитие");
      await quickUpdate(inquiry.id, {
        status: "in_progress",
        adminNotes: appendNote(inquiry.admin_notes, "Създадено събитие за оглед/услуга."),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally { setActionBusy(null); }
  }

  async function generateAiReply(inquiry: Inquiry) {
    setActionBusy(`ai:${inquiry.id}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "inquiry_reply",
          input: {
            customerName: inquiry.customer_name, customerPhone: inquiry.customer_phone,
            customerEmail: inquiry.customer_email ?? null,
            serviceType: inquiry.service_type ?? null, message: inquiry.message ?? null,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as Record<string, string>).error || "AI заявката не успя");
      const draft = (json as { data?: Record<string, unknown> }).data ?? {};
      const reply = String(draft.reply ?? "").trim();
      const note = String(draft.internalNote ?? "").trim();
      const priority = draft.priority === "high" || draft.priority === "low" ? String(draft.priority) : "medium";
      if (!reply && !note) return;
      setAiReplyDraft({ inquiryId: inquiry.id, customerName: inquiry.customer_name, currentAdminNotes: inquiry.admin_notes, reply, internalNote: note, priority });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally { setActionBusy(null); }
  }

  async function saveAiReplyDraft() {
    if (!aiReplyDraft) return;
    const text = [
      aiReplyDraft.reply && `Чернова отговор:\n${aiReplyDraft.reply}`,
      aiReplyDraft.internalNote && `Вътрешна бележка:\n${aiReplyDraft.internalNote}`,
    ].filter(Boolean).join("\n\n");
    if (!text) return;
    await quickUpdate(aiReplyDraft.inquiryId, {
      priority: aiReplyDraft.priority,
      adminNotes: appendNote(aiReplyDraft.currentAdminNotes, text),
    });
    setAiReplyDraft(null);
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SectionTitle title="Запитвания" hint="Входящи заявки от клиенти с бърза промяна на статус и приоритет." />
        <HoverTip tip={INQUIRY_TIPS.refresh}>
          <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm" aria-label={INQUIRY_TIPS.refresh}>
            <RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Обнови</span>
          </Button>
        </HoverTip>
      </div>

      <HelpCard className="hidden md:block">
        <HelpRow items={["Филтрирай по статус и текст", "Използвай 'В работа' и 'Приключи' за бърз workflow", "Бележки са вътрешни и не се виждат от клиента"]} />
      </HelpCard>

      {/* Live indicator */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${liveConnected ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" : "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.14)]"}`} />
          <span className="text-xs font-bold text-slate-900">{liveConnected ? "Live активен" : "Възстановяване..."}</span>
        </div>
        <div className="text-xs font-medium text-slate-500 truncate">
          {lastLiveUpdate ? `Обновено: ${lastLiveUpdate}` : "Автоматично обновяване"}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={status} onChange={e => setStatus(e.target.value)} className="sm:w-44">
            <option value="">Всички статуси</option>
            <option value="new">Ново</option>
            <option value="in_progress">В работа</option>
            <option value="done">Приключено</option>
            <option value="spam">Спам</option>
          </Select>
          <Select value={source} onChange={e => setSource(e.target.value)} className="sm:w-44">
            <option value="">Всички източници</option>
            <option value="contact">📝 Форма</option>
            <option value="product">🛒 Продукт</option>
            <option value="wizard">📋 Анкета</option>
            <option value="quick_view">👁 Бърз преглед</option>
            <option value="ai">🤖 AI чат</option>
          </Select>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси по клиент, телефон, текст..." className="flex-1" />
        </div>
      </Card>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-slate-500 font-medium">Зареждане...</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Клиент</Th><Th>Контакт</Th><Th>Монтаж</Th><Th>Климатици</Th><Th>Статус</Th>
                  <Th>Приоритет</Th><Th>Източник</Th><Th>Създадено</Th><Th>Действия</Th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => {
                  const s = statusLabel(i.status);
                  const p = priorityLabel(i.priority);
                  return (
                    <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                      <Td className="font-bold text-slate-900">
                        <button type="button" onClick={() => void openInquiryDetail(i)} title={INQUIRY_TIPS.details} className="rounded text-left font-bold text-slate-900 underline-offset-4 transition-colors hover:text-brand-blue-700 hover:underline">{i.customer_name}</button>
                      </Td>
                      <Td>
                        <AdminPhoneLink phone={i.customer_phone} className="font-medium text-slate-700" showIcon={false} />
                        {i.customer_email && <div className="text-xs text-slate-500 mt-0.5">{i.customer_email}</div>}
                      </Td>
                      <Td className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {mountPreferenceLabel(i.include_installation, i.message)}
                      </Td>
                      <Td className="max-w-[220px]">
                        <InquiryProductsSummary inquiry={i} />
                      </Td>
                      <Td><Badge label={s.label} colorClass={s.colorClass} /></Td>
                      <Td><Badge label={p.label} colorClass={p.colorClass} /></Td>
                      <Td><Badge label={sourceLabel(i.source).label} colorClass={sourceLabel(i.source).colorClass} /></Td>
                      <Td className="text-xs text-slate-500 font-medium">{new Date(i.created_at).toLocaleString()}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <HoverTip tip={INQUIRY_TIPS.details}>
                            <Button variant="secondary" size="sm" onClick={() => void openInquiryDetail(i)} aria-label={INQUIRY_TIPS.details} className="gap-1.5 !py-1 !px-2.5 !text-xs border-brand-blue-200 bg-brand-blue-50 text-brand-blue-700">Детайли</Button>
                          </HoverTip>
                          <HoverTip tip={INQUIRY_TIPS.notes}>
                            <Button variant="secondary" size="sm" onClick={() => setNotesForId(i.id)} aria-label={INQUIRY_TIPS.notes} className={`gap-1 !py-1 !px-2.5 !text-xs ${i.admin_notes ? "border-brand-blue-300 bg-brand-blue-50 text-brand-blue-700" : ""}`}>
                              <StickyNote className="w-3.5 h-3.5" />{i.admin_notes ? " ●" : ""}
                            </Button>
                          </HoverTip>
                          <HoverTip tip={INQUIRY_TIPS.inProgress}>
                            <Button variant="secondary" size="sm" onClick={() => quickUpdate(i.id, { status: "in_progress" })} aria-label={INQUIRY_TIPS.inProgress} className="!py-1 !px-2.5 !text-xs"><PlayCircle className="w-3.5 h-3.5 text-brand-blue-500" /></Button>
                          </HoverTip>
                          <HoverTip tip={INQUIRY_TIPS.contact}>
                            <Button variant="secondary" size="sm" disabled={actionBusy === `contact:${i.id}`} onClick={() => void createContactFromInquiry(i)} aria-label={INQUIRY_TIPS.contact} className="!py-1 !px-2.5 !text-xs">Контакт</Button>
                          </HoverTip>
                          <HoverTip tip={INQUIRY_TIPS.inspection}>
                            <Button variant="secondary" size="sm" disabled={actionBusy === `work:${i.id}`} onClick={() => void createInspectionFromInquiry(i)} aria-label={INQUIRY_TIPS.inspection} className="!py-1 !px-2.5 !text-xs">Оглед</Button>
                          </HoverTip>
                          <HoverTip tip={INQUIRY_TIPS.ai}>
                            <Button variant="secondary" size="sm" disabled={actionBusy === `ai:${i.id}`} onClick={() => void generateAiReply(i)} aria-label={INQUIRY_TIPS.ai} className="!py-1 !px-2.5 !text-xs">AI</Button>
                          </HoverTip>
                          <HoverTip tip={INQUIRY_TIPS.done}>
                            <Button variant="secondary" size="sm" onClick={() => quickUpdate(i.id, { status: "done" })} aria-label={INQUIRY_TIPS.done} className="!py-1 !px-2.5 !text-xs"><CheckCircle className="w-3.5 h-3.5 text-green-500" /></Button>
                          </HoverTip>
                          <HoverTip tip={INQUIRY_TIPS.spam}>
                            <Button variant="danger" size="sm" onClick={() => quickUpdate(i.id, { status: "spam" })} aria-label={INQUIRY_TIPS.spam} className="!py-1 !px-2 !text-xs"><ShieldAlert className="w-3.5 h-3.5" /></Button>
                          </HoverTip>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><Td colSpan={9} className="text-center py-8 text-slate-500">Няма намерени запитвания.</Td></tr>}
              </tbody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {items.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени запитвания.</div>}
            {items.map(i => {
              const s = statusLabel(i.status);
              const p = priorityLabel(i.priority);
              return (
                <div key={i.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button type="button" className="w-full text-left p-4 active:bg-slate-50 transition-colors" onClick={() => void openInquiryDetail(i)}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{i.customer_name}</div>
                        <AdminPhoneLink
                          phone={i.customer_phone}
                          className="text-xs font-medium mt-0.5 block"
                          showIcon={false}
                          stopPropagation
                        />
                      </div>
                      <div className="text-right shrink-0">
                        <Badge label={s.label} colorClass={s.colorClass} />
                        <div className="mt-1.5"><Badge label={p.label} colorClass={p.colorClass} /></div>
                      </div>
                    </div>
                    {i.message && <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 mb-2">{i.message}</div>}
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">
                      Монтаж: {mountPreferenceLabel(i.include_installation, i.message)}
                    </p>
                    <div className="mb-2">
                      <InquiryProductsSummary inquiry={i} compact />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${sourceLabel(i.source).colorClass}`}>{sourceLabel(i.source).label}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(i.created_at).toLocaleDateString("bg-BG")}</span>
                    </div>
                  </button>
                  <div className="flex border-t border-slate-100 divide-x divide-slate-100">
                    <button type="button" title={INQUIRY_TIPS.inProgress} onClick={() => quickUpdate(i.id, { status: "in_progress" })} className="flex-1 py-3 flex items-center justify-center gap-1 text-xs font-semibold text-brand-blue-700 hover:bg-brand-blue-50 active:bg-brand-blue-100 transition-colors">
                      <PlayCircle className="w-4 h-4" /> В работа
                    </button>
                    <button type="button" title={INQUIRY_TIPS.done} onClick={() => quickUpdate(i.id, { status: "done" })} className="flex-1 py-3 flex items-center justify-center gap-1 text-xs font-semibold text-green-700 hover:bg-green-50 active:bg-green-100 transition-colors">
                      <CheckCircle className="w-4 h-4" /> Приключи
                    </button>
                    <button type="button" title={INQUIRY_TIPS.details} onClick={() => void openInquiryDetail(i)} className="flex-1 py-3 flex items-center justify-center gap-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors">
                      Детайли
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {inqTotal > INQ_PER_PAGE && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">{(inqPage - 1) * INQ_PER_PAGE + 1}–{Math.min(inqPage * INQ_PER_PAGE, inqTotal)} от {inqTotal}</span>
              <div className="flex gap-1">
                <HoverTip tip={INQUIRY_TIPS.prevPage}>
                  <button type="button" aria-label={INQUIRY_TIPS.prevPage} onClick={() => setInqPage(p => Math.max(1, p - 1))} disabled={inqPage === 1} className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"><ChevronLeft className="w-3.5 h-3.5" /></button>
                </HoverTip>
                <HoverTip tip={INQUIRY_TIPS.nextPage}>
                  <button type="button" aria-label={INQUIRY_TIPS.nextPage} onClick={() => setInqPage(p => p + 1)} disabled={inqPage * INQ_PER_PAGE >= inqTotal} className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"><ChevronRight className="w-3.5 h-3.5" /></button>
                </HoverTip>
              </div>
            </div>
          )}
        </>
      )}

      {notesForId && (
        <InquiryNotesModal
          inquiryId={notesForId}
          initialNotes={items.find(x => x.id === notesForId)?.admin_notes ?? ""}
          onClose={() => setNotesForId(null)}
          onSave={async adminNotes => { await quickUpdate(notesForId, { adminNotes }); setNotesForId(null); }}
        />
      )}

      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 md:p-4 backdrop-blur-md" onClick={closeInquiryDetail}>
          <div className="w-full max-w-4xl max-h-[96vh] md:max-h-[calc(100vh-2rem)] overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_-8px_60px_rgba(15,23,42,0.35)] md:shadow-[0_30px_90px_rgba(15,23,42,0.35)]" onClick={e => e.stopPropagation()}>
            <div className="relative border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f8fafc_100%)] px-6 py-5">
              <HoverTip tip={INQUIRY_TIPS.close}>
                <button type="button" aria-label={INQUIRY_TIPS.close} onClick={closeInquiryDetail} className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm hover:bg-white hover:text-slate-900"><X className="h-4 w-4" /></button>
              </HoverTip>
              <div className="flex items-center gap-3 pr-10">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${selectedInquiry.source === "wizard" ? "bg-violet-600 shadow-violet-600/25" : "bg-brand-blue-500 shadow-brand-blue-500/25"}`}>
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <div className={`text-xs font-bold uppercase tracking-[0.24em] ${selectedInquiry.source === "wizard" ? "text-violet-700" : "text-brand-blue-700"}`}>
                    {selectedInquiry.source === "wizard" ? "Анкетно запитване" : "Клиентско запитване"}
                  </div>
                  <div className="mt-1 text-2xl font-black leading-tight text-slate-950">{selectedInquiry.customer_name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-slate-500">
                    <AdminPhoneLink phone={selectedInquiry.customer_phone} showIcon={false} className="text-sm text-slate-600" />
                    <span aria-hidden>·</span>
                    <span>{new Date(selectedInquiry.created_at).toLocaleString("bg-BG")}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid max-h-[calc(100vh-11rem)] gap-4 overflow-y-auto p-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                {selectedDisplayProducts.length > 0 && (
                  <div className="rounded-2xl border border-brand-blue-100 bg-brand-blue-50/40 p-4 shadow-sm">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-blue-700">Продукти в запитването</div>
                    <InquiryProductCards products={selectedDisplayProducts} />
                  </div>
                )}
                <div className={`rounded-2xl border p-4 shadow-sm ${selectedInquiry.source === "wizard" ? "border-violet-200 bg-violet-50/40" : "border-slate-200 bg-white"}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{selectedInquiry.source === "wizard" ? "Анкетни отговори" : "Съобщение"}</div>
                    {selectedInquiry.source === "wizard" && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-50 border-violet-200 text-violet-700">📋 Анкета</span>}
                  </div>
                  <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900 font-mono">
                    {inquiryMessageForDisplay(selectedInquiry.message, selectedDisplayProducts)}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <InfoBox label="Телефон" value={selectedInquiry.customer_phone} />
                  <InfoBox label="Имейл" value={selectedInquiry.customer_email || "—"} />
                  <InfoBox label="Тип заявка" value={inquiryServiceTypeLabel(selectedInquiry.service_type)} />
                  <InfoBox
                    label="Монтаж"
                    value={mountPreferenceLabel(selectedInquiry.include_installation, selectedInquiry.message)}
                  />
                  <InfoBox label="Източник" value={sourceLabel(selectedInquiry.source).label} />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Вътрешни бележки</div>
                  <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">{selectedInquiry.admin_notes || "Още няма вътрешни бележки."}</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Състояние</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge label={statusLabel(selectedInquiry.status).label} colorClass={statusLabel(selectedInquiry.status).colorClass} />
                    <Badge label={priorityLabel(selectedInquiry.priority).label} colorClass={priorityLabel(selectedInquiry.priority).colorClass} />
                  </div>
                </div>
                {/* Primary actions first — always visible without scroll on mobile */}
                <HoverTip tip={INQUIRY_TIPS.done} className="w-full">
                  <Button variant="primary" className="w-full justify-center gap-2" aria-label={INQUIRY_TIPS.done} onClick={() => void quickUpdate(selectedInquiry.id, { status: "done" })}><CheckCircle className="h-4 w-4" /> Приключи</Button>
                </HoverTip>
                <HoverTip tip={INQUIRY_TIPS.ai} className="w-full">
                  <Button variant="secondary" className="w-full justify-center gap-2" aria-label={INQUIRY_TIPS.ai} disabled={actionBusy === `ai:${selectedInquiry.id}`} onClick={() => void generateAiReply(selectedInquiry)}><Sparkles className="h-4 w-4 text-brand-blue-500" /> AI чернова</Button>
                </HoverTip>
                <HoverTip tip={INQUIRY_TIPS.notes} className="w-full">
                  <Button variant="secondary" className="w-full justify-center gap-2" aria-label={INQUIRY_TIPS.notes} onClick={() => setNotesForId(selectedInquiry.id)}><StickyNote className="h-4 w-4" /> Бележки</Button>
                </HoverTip>
                <HoverTip tip={INQUIRY_TIPS.inProgress} className="w-full">
                  <Button variant="secondary" className="w-full justify-center gap-2" aria-label={INQUIRY_TIPS.inProgress} onClick={() => void quickUpdate(selectedInquiry.id, { status: "in_progress" })}><PlayCircle className="h-4 w-4 text-brand-blue-500" /> Маркирай в работа</Button>
                </HoverTip>
                <HoverTip tip={INQUIRY_TIPS.contact} className="w-full">
                  <Button variant="secondary" className="w-full justify-center" aria-label={INQUIRY_TIPS.contact} disabled={actionBusy === `contact:${selectedInquiry.id}`} onClick={() => void createContactFromInquiry(selectedInquiry)}>Създай контакт</Button>
                </HoverTip>
                <HoverTip tip={INQUIRY_TIPS.inspection} className="w-full">
                  <Button variant="secondary" className="w-full justify-center" aria-label={INQUIRY_TIPS.inspection} disabled={actionBusy === `work:${selectedInquiry.id}`} onClick={() => void createInspectionFromInquiry(selectedInquiry)}>Създай оглед</Button>
                </HoverTip>
                <HoverTip tip={INQUIRY_TIPS.spam} className="w-full">
                  <Button variant="danger" className="w-full justify-center gap-2" aria-label={INQUIRY_TIPS.spam} onClick={() => void quickUpdate(selectedInquiry.id, { status: "spam" })}><ShieldAlert className="h-4 w-4" /> Спам</Button>
                </HoverTip>
              </div>
            </div>
          </div>
        </div>
      )}

      {aiReplyDraft && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-slate-950/55 p-0 md:p-4 backdrop-blur-md" onClick={() => setAiReplyDraft(null)}>
          <div className="w-full max-w-2xl max-h-[92dvh] overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] flex flex-col pb-safe md:pb-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="relative border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f8fafc_100%)] px-4 py-4 md:px-6 md:py-5 shrink-0">
              <HoverTip tip={INQUIRY_TIPS.close}>
                <button type="button" aria-label={INQUIRY_TIPS.close} onClick={() => setAiReplyDraft(null)} className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm hover:bg-white hover:text-slate-900"><X className="h-4 w-4" /></button>
              </HoverTip>
              <div className="flex items-center gap-3 pr-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue-500 text-white shadow-lg shadow-brand-blue-500/25"><Sparkles className="h-5 w-5" /></div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue-700">Gemini отговор</div>
                  <div className="mt-1 text-lg md:text-2xl font-black leading-tight text-slate-950">AI чернова</div>
                  <div className="mt-1 text-sm font-medium text-slate-500">{aiReplyDraft.customerName}</div>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-4 md:p-6 overflow-y-auto flex-1 min-h-0">
              {aiReplyDraft.reply && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Чернова отговор</div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Не се изпраща автоматично</span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900">{aiReplyDraft.reply}</div>
                </div>
              )}
              {aiReplyDraft.internalNote && (
                <div className="rounded-2xl border border-brand-blue-100 bg-brand-blue-50/70 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-blue-700">Вътрешна бележка</div>
                  <div className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">{aiReplyDraft.internalNote}</div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Предложен приоритет</span>
                <Badge label={priorityLabel(aiReplyDraft.priority).label} colorClass={priorityLabel(aiReplyDraft.priority).colorClass} />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setAiReplyDraft(null)} className="justify-center">Затвори</Button>
              <HoverTip tip={INQUIRY_TIPS.saveAi}>
                <Button onClick={() => void saveAiReplyDraft()} aria-label={INQUIRY_TIPS.saveAi} className="justify-center gap-2 shadow-lg shadow-brand-blue-500/20"><CheckCircle2 className="h-4 w-4" />Запиши в бележките</Button>
              </HoverTip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function appendNote(existing: string | null | undefined, line: string) {
  const stamp = new Date().toLocaleString("bg-BG");
  return [existing?.trim(), `[${stamp}] ${line}`].filter(Boolean).join("\n");
}

function mountPreferenceLabel(
  includeInstallation: boolean | null | undefined,
  message?: string | null,
): string {
  if (includeInstallation === true) return "С монтаж";
  if (includeInstallation === false) return "Само уред";
  const m = message ?? "";
  if (m.includes("Монтаж: с монтаж")) return "С монтаж";
  if (m.includes("Монтаж: само уред")) return "Само уред";
  return "—";
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return <AdminLabeledBox label={label} value={value} />;
}


function inquiryProductsFromMessage(message?: string | null): string[] {
  if (!message?.trim()) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of message.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(/^запитване\s*за\s*:\s*(.+)$/iu);
    if (!match) continue;
    const name = match[1].trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function InquiryProductsSummary({ inquiry, compact = false }: { inquiry: Inquiry; compact?: boolean }) {
  const products = productsForInquiryDisplay(inquiry);
  if (!products.length) return <span className="text-xs text-slate-400">—</span>;
  return (
    <ul className={compact ? "space-y-0.5" : "space-y-1"}>
      {products.map((p) => (
        <li
          key={p.id}
          className={`font-medium text-slate-800 ${compact ? "text-[11px] leading-snug line-clamp-2" : "text-xs line-clamp-2"}`}
          title={p.product_name}
        >
          {p.product_name}
        </li>
      ))}
    </ul>
  );
}

function productsForInquiryDisplay(inquiry: Inquiry | null): InquiryProduct[] {
  if (!inquiry) return [];
  if (inquiry.products?.length) return inquiry.products;

  const names = inquiryProductsFromMessage(inquiry.message);
  if (!names.length && inquiry.product_id) {
    const fallbackName =
      inquiry.message?.replace(/^запитване\s*за\s*:\s*/iu, "").trim() || "Климатик";
    return [
      {
        id: `ui-${inquiry.id}-0`,
        inquiry_id: inquiry.id,
        product_id: inquiry.product_id,
        product_slug: null,
        product_name: fallbackName.split("\n")[0]?.trim() || "Климатик",
        created_at: inquiry.created_at,
      },
    ];
  }

  return names.map((product_name, index) => ({
    id: `ui-${inquiry.id}-${index}`,
    inquiry_id: inquiry.id,
    product_id: index === 0 && inquiry.product_id ? inquiry.product_id : null,
    product_slug: null,
    product_name,
    created_at: inquiry.created_at,
  }));
}

function inquiryMessageForDisplay(
  message: string | null | undefined,
  products?: InquiryProduct[],
): string {
  const hasProducts = (products?.length ?? 0) > 0;
  if (!message?.trim()) return hasProducts ? "—" : "Няма допълнително съобщение.";
  if (!hasProducts) return message.trim();
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^запитване\s*за\s*:/iu.test(line));
  return lines.join("\n").trim() || "—";
}

function InquiryNotesModal({ inquiryId, initialNotes, onClose, onSave }: {
  inquiryId: string; initialNotes: string;
  onClose: () => void; onSave: (notes: string | null) => Promise<void>;
}) {
  const [text, setText] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center z-[70] p-0 md:p-2" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl md:rounded-xl shadow-xl border border-slate-200 p-4 pb-safe md:pb-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pb-2 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="font-bold text-sm text-slate-900 mb-0.5 inline-flex items-center gap-1.5">
          Вътрешни бележки (CRM)
          <InfoDot text="Тези бележки са само за вътрешна работа и не се изпращат към клиента." />
        </div>
        <p className="text-[10px] text-slate-500 mb-2 font-mono">ID: {inquiryId}</p>
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Бележки само за екипа…" className="mb-2" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" title="Затвори без запис" onClick={onClose} disabled={saving}>Отказ</Button>
          <Button variant="primary" title={INQUIRY_TIPS.saveNotes} disabled={saving} onClick={async () => {
            setSaving(true);
            try { await onSave(text.trim() || null); } finally { setSaving(false); }
          }}>{saving ? "Запис…" : "Запази"}</Button>
        </div>
      </div>
    </div>
  );
}
