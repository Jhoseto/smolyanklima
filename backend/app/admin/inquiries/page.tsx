"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HelpRow, InfoDot, SectionTitle, HelpCard, Card, Input, Select, Button, Table, Th, Td, Textarea } from "../ui";
import { RefreshCw, MessageSquare, PlayCircle, CheckCircle, ShieldAlert, StickyNote, Sparkles, X, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminInquiriesPage() {
  return <AdminInquiriesClient />;
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap border ${colorClass}`}>
      {label}
    </span>
  );
}

function statusLabel(status: string) {
  if (status === "new") return { label: "Ново", colorClass: "bg-orange-100 border-orange-200 text-orange-800" };
  if (status === "in_progress") return { label: "В работа", colorClass: "bg-sky-100 border-sky-200 text-sky-800" };
  if (status === "done") return { label: "Приключено", colorClass: "bg-green-100 border-green-200 text-green-800" };
  if (status === "spam") return { label: "Спам", colorClass: "bg-red-100 border-red-200 text-red-800" };
  return { label: status || "—", colorClass: "bg-slate-100 border-slate-200 text-slate-600" };
}

function priorityLabel(priority: string) {
  if (priority === "high") return { label: "Висок", colorClass: "bg-red-100 border-red-200 text-red-800" };
  if (priority === "medium") return { label: "Среден", colorClass: "bg-amber-100 border-amber-200 text-amber-800" };
  if (priority === "low") return { label: "Нисък", colorClass: "bg-slate-100 border-slate-200 text-slate-700" };
  return { label: priority || "—", colorClass: "bg-slate-100 border-slate-200 text-slate-600" };
}

type Inquiry = {
  id: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  message?: string | null;
  product_id?: string | null;
  service_type?: string | null;
  status: string;
  priority: string;
  assigned_to?: string | null;
  admin_notes?: string | null;
  created_at: string;
};

type AiReplyDraft = {
  inquiryId: string;
  customerName: string;
  currentAdminNotes?: string | null;
  reply: string;
  internalNote: string;
  priority: string;
};

function AdminInquiriesClient() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [notesForId, setNotesForId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [aiReplyDraft, setAiReplyDraft] = useState<AiReplyDraft | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [status, q]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries${queryString}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const events = new EventSource("/api/admin/inquiries/stream");

    events.addEventListener("ready", () => {
      setLiveConnected(true);
    });

    events.addEventListener("changed", () => {
      setLiveConnected(true);
      setLastLiveUpdate(new Date().toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      void load({ silent: true });
    });

    events.onerror = () => {
      setLiveConnected(false);
    };

    return () => {
      events.close();
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
    if (!res.ok) {
      setError(json.error || "Грешка");
      return;
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
              ...(patch.adminNotes !== undefined ? { admin_notes: patch.adminNotes } : {}),
            }
          : it,
      ),
    );
    setSelectedInquiry((prev) =>
      prev?.id === id
        ? {
            ...prev,
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
            ...(patch.adminNotes !== undefined ? { admin_notes: patch.adminNotes } : {}),
          }
        : prev,
    );
  }

  async function createContactFromInquiry(inquiry: Inquiry) {
    setActionBusy(`contact:${inquiry.id}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: inquiry.customer_name,
          phone: inquiry.customer_phone,
          email: inquiry.customer_email ?? null,
          notes: inquiry.message ? `От заявка: ${inquiry.message}` : null,
          customerStatus: "new",
          nextFollowUpAt: new Date().toISOString().slice(0, 10),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при създаване на контакт");
      await quickUpdate(inquiry.id, { adminNotes: appendNote(inquiry.admin_notes, "Създаден контакт от заявката.") });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setActionBusy(null);
    }
  }

  async function createInspectionFromInquiry(inquiry: Inquiry) {
    setActionBusy(`work:${inquiry.id}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/work-items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "service",
          eventCode: "service_inspection",
          title: `Оглед: ${inquiry.customer_name}`,
          dueDate: new Date().toISOString().slice(0, 10),
          status: "planned",
          priority: inquiry.priority === "high" ? "high" : "medium",
          inquiryId: inquiry.id,
          productId: inquiry.product_id ?? null,
          customerName: inquiry.customer_name,
          customerPhone: inquiry.customer_phone,
          notes: [inquiry.service_type ? `Услуга: ${inquiry.service_type}` : "", inquiry.message ?? ""].filter(Boolean).join("\n\n") || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при създаване на задача");
      await quickUpdate(inquiry.id, {
        status: "in_progress",
        adminNotes: appendNote(inquiry.admin_notes, "Създадена задача за оглед/услуга."),
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setActionBusy(null);
    }
  }

  async function generateAiReply(inquiry: Inquiry) {
    setActionBusy(`ai:${inquiry.id}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "inquiry_reply",
          input: {
            customerName: inquiry.customer_name,
            customerPhone: inquiry.customer_phone,
            customerEmail: inquiry.customer_email ?? null,
            serviceType: inquiry.service_type ?? null,
            message: inquiry.message ?? null,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "AI заявката не успя");
      const draft = (json as any).data ?? {};
      const reply = String(draft.reply ?? "").trim();
      const note = String(draft.internalNote ?? "").trim();
      const priority = draft.priority === "high" || draft.priority === "low" ? draft.priority : "medium";
      if (!reply && !note) return;
      setAiReplyDraft({
        inquiryId: inquiry.id,
        customerName: inquiry.customer_name,
        currentAdminNotes: inquiry.admin_notes,
        reply,
        internalNote: note,
        priority,
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setActionBusy(null);
    }
  }

  async function saveAiReplyDraft() {
    if (!aiReplyDraft) return;
    const text = [
      aiReplyDraft.reply && `Чернова отговор:\n${aiReplyDraft.reply}`,
      aiReplyDraft.internalNote && `Вътрешна бележка:\n${aiReplyDraft.internalNote}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!text) return;
    await quickUpdate(aiReplyDraft.inquiryId, {
      priority: aiReplyDraft.priority,
      adminNotes: appendNote(aiReplyDraft.currentAdminNotes, text),
    });
    setAiReplyDraft(null);
  }

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Запитвания" hint="Входящи заявки от клиенти с бърза промяна на статус и приоритет." />
        </h1>
        <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm">
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Обнови</span>
        </Button>
      </div>

      <HelpCard className="hidden md:block">
        <HelpRow items={["Филтрирай по статус и текст", "Използвай 'В работа' и 'Приключи' за бърз workflow", "Бележки са вътрешни и не се виждат от клиента"]} />
      </HelpCard>

      {/* Live status indicator */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${liveConnected ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" : "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.14)]"}`} />
          <span className="text-xs font-bold text-slate-900">
            {liveConnected ? "Live активен" : "Възстановяване..."}
          </span>
        </div>
        <div className="text-xs font-medium text-slate-500 truncate">
          {lastLiveUpdate ? `Обновено: ${lastLiveUpdate}` : "Автоматично обновяване"}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="">Всички статуси</option>
            <option value="new">Ново</option>
            <option value="in_progress">В работа</option>
            <option value="done">Приключено</option>
            <option value="spam">Спам</option>
          </Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси по клиент, телефон, текст..." className="flex-1" />
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500 font-medium">Зареждане...</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Клиент</Th>
                  <Th>Контакт</Th>
                  <Th>Статус</Th>
                  <Th>Приоритет</Th>
                  <Th>Източник</Th>
                  <Th>Създадено</Th>
                  <Th>Действия</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const s = statusLabel(i.status);
                  const p = priorityLabel(i.priority);
                  return (
                    <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                      <Td className="font-bold text-slate-900">
                        <button type="button" onClick={() => setSelectedInquiry(i)} className="rounded text-left font-bold text-slate-900 underline-offset-4 transition-colors hover:text-sky-700 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-200">
                          {i.customer_name}
                        </button>
                      </Td>
                      <Td>
                        <div className="font-medium text-slate-700">{i.customer_phone}</div>
                        {i.customer_email && <div className="text-xs text-slate-500 mt-0.5">{i.customer_email}</div>}
                      </Td>
                      <Td><Badge label={s.label} colorClass={s.colorClass} /></Td>
                      <Td><Badge label={p.label} colorClass={p.colorClass} /></Td>
                      <Td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">{i.source}</span></Td>
                      <Td className="text-xs text-slate-500 font-medium">{new Date(i.created_at).toLocaleString()}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <Button variant="secondary" size="sm" onClick={() => setSelectedInquiry(i)} className="gap-1.5 !py-1 !px-2.5 !text-xs border-sky-200 bg-sky-50 text-sky-700">Детайли</Button>
                          <Button variant="secondary" size="sm" onClick={() => setNotesForId(i.id)} className={`gap-1 !py-1 !px-2.5 !text-xs ${i.admin_notes ? "border-sky-300 bg-sky-50 text-sky-700" : ""}`}>
                            <StickyNote className="w-3.5 h-3.5" />{i.admin_notes ? " ●" : ""}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => quickUpdate(i.id, { status: "in_progress" })} className="!py-1 !px-2.5 !text-xs">
                            <PlayCircle className="w-3.5 h-3.5 text-sky-500" />
                          </Button>
                          <Button variant="secondary" size="sm" disabled={actionBusy === `contact:${i.id}`} onClick={() => void createContactFromInquiry(i)} className="!py-1 !px-2.5 !text-xs">Контакт</Button>
                          <Button variant="secondary" size="sm" disabled={actionBusy === `work:${i.id}`} onClick={() => void createInspectionFromInquiry(i)} className="!py-1 !px-2.5 !text-xs">Оглед</Button>
                          <Button variant="secondary" size="sm" disabled={actionBusy === `ai:${i.id}`} onClick={() => void generateAiReply(i)} className="!py-1 !px-2.5 !text-xs">AI</Button>
                          <Button variant="secondary" size="sm" onClick={() => quickUpdate(i.id, { status: "done" })} className="!py-1 !px-2.5 !text-xs">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => quickUpdate(i.id, { status: "spam" })} className="!py-1 !px-2 !text-xs">
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><Td colSpan={7} className="text-center py-8 text-slate-500">Няма намерени запитвания.</Td></tr>
                )}
              </tbody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {items.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени запитвания.</div>
            )}
            {items.map((i) => {
              const s = statusLabel(i.status);
              const p = priorityLabel(i.priority);
              return (
                <div key={i.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left p-4 active:bg-slate-50 transition-colors"
                    onClick={() => setSelectedInquiry(i)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{i.customer_name}</div>
                        <a
                          href={`tel:${i.customer_phone}`}
                          className="text-xs text-sky-600 font-medium mt-0.5 block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {i.customer_phone}
                        </a>
                        {i.customer_email && (
                          <div className="text-xs text-slate-400 mt-0.5 truncate">{i.customer_email}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <Badge label={s.label} colorClass={s.colorClass} />
                        <div className="mt-1.5">
                          <Badge label={p.label} colorClass={p.colorClass} />
                        </div>
                      </div>
                    </div>
                    {i.message && (
                      <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 mb-2">
                        {i.message}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">{i.source}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(i.created_at).toLocaleDateString("bg-BG")}</span>
                    </div>
                  </button>
                  {/* Quick action row */}
                  <div className="flex border-t border-slate-100 divide-x divide-slate-100">
                    <button
                      type="button"
                      onClick={() => quickUpdate(i.id, { status: "in_progress" })}
                      className="flex-1 py-3 flex items-center justify-center gap-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 active:bg-sky-100 transition-colors"
                    >
                      <PlayCircle className="w-4 h-4" /> В работа
                    </button>
                    <button
                      type="button"
                      onClick={() => quickUpdate(i.id, { status: "done" })}
                      className="flex-1 py-3 flex items-center justify-center gap-1 text-xs font-semibold text-green-700 hover:bg-green-50 active:bg-green-100 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" /> Приключи
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedInquiry(i)}
                      className="flex-1 py-3 flex items-center justify-center gap-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      Детайли
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {notesForId && (
        <InquiryNotesModal
          inquiryId={notesForId}
          initialNotes={items.find((x) => x.id === notesForId)?.admin_notes ?? ""}
          onClose={() => setNotesForId(null)}
          onSave={async (adminNotes) => {
            await quickUpdate(notesForId, { adminNotes });
            setNotesForId(null);
          }}
        />
      )}

      {selectedInquiry && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 md:p-4 backdrop-blur-md"
          onClick={() => setSelectedInquiry(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[96vh] md:max-h-[calc(100vh-2rem)] overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_-8px_60px_rgba(15,23,42,0.35)] md:shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f8fafc_100%)] px-6 py-5">
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-label="Затвори детайли"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 pr-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/25">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Клиентско запитване</div>
                  <div className="mt-1 text-2xl font-black leading-tight text-slate-950">{selectedInquiry.customer_name}</div>
                  <div className="mt-1 text-sm font-medium text-slate-500">
                    {selectedInquiry.customer_phone} · {new Date(selectedInquiry.created_at).toLocaleString("bg-BG")}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid max-h-[calc(100vh-11rem)] gap-4 overflow-y-auto p-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Съобщение</div>
                  <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900">
                    {selectedInquiry.message || "Няма допълнително съобщение."}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <InfoBox label="Телефон" value={selectedInquiry.customer_phone} />
                  <InfoBox label="Имейл" value={selectedInquiry.customer_email || "—"} />
                  <InfoBox label="Тип заявка" value={serviceTypeLabel(selectedInquiry.service_type)} />
                  <InfoBox label="Източник" value={selectedInquiry.source} />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Вътрешни бележки</div>
                  <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">
                    {selectedInquiry.admin_notes || "Още няма вътрешни бележки."}
                  </div>
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
                <Button variant="secondary" className="w-full justify-center gap-2" onClick={() => setNotesForId(selectedInquiry.id)}>
                  <StickyNote className="h-4 w-4" /> Бележки
                </Button>
                <Button variant="secondary" className="w-full justify-center gap-2" onClick={() => void quickUpdate(selectedInquiry.id, { status: "in_progress" })}>
                  <PlayCircle className="h-4 w-4 text-sky-500" /> Маркирай в работа
                </Button>
                <Button variant="secondary" className="w-full justify-center" disabled={actionBusy === `contact:${selectedInquiry.id}`} onClick={() => void createContactFromInquiry(selectedInquiry)}>
                  Създай контакт
                </Button>
                <Button variant="secondary" className="w-full justify-center" disabled={actionBusy === `work:${selectedInquiry.id}`} onClick={() => void createInspectionFromInquiry(selectedInquiry)}>
                  Създай оглед
                </Button>
                <Button variant="secondary" className="w-full justify-center gap-2" disabled={actionBusy === `ai:${selectedInquiry.id}`} onClick={() => void generateAiReply(selectedInquiry)}>
                  <Sparkles className="h-4 w-4 text-sky-500" /> AI чернова
                </Button>
                <Button variant="primary" className="w-full justify-center gap-2" onClick={() => void quickUpdate(selectedInquiry.id, { status: "done" })}>
                  <CheckCircle className="h-4 w-4" /> Приключи
                </Button>
                <Button variant="danger" className="w-full justify-center gap-2" onClick={() => void quickUpdate(selectedInquiry.id, { status: "spam" })}>
                  <ShieldAlert className="h-4 w-4" /> Спам
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {aiReplyDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onClick={() => setAiReplyDraft(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f8fafc_100%)] px-6 py-5">
              <button
                type="button"
                onClick={() => setAiReplyDraft(null)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-label="Затвори AI чернова"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 pr-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/25">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Gemini отговор</div>
                  <div className="mt-1 text-2xl font-black leading-tight text-slate-950">AI чернова за запитване</div>
                  <div className="mt-1 text-sm font-medium text-slate-500">{aiReplyDraft.customerName}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              {aiReplyDraft.reply && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Чернова отговор към клиента</div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Не се изпраща автоматично
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900">{aiReplyDraft.reply}</div>
                </div>
              )}

              {aiReplyDraft.internalNote && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sky-700">Вътрешна бележка</div>
                  <div className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">{aiReplyDraft.internalNote}</div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Предложен приоритет</span>
                <Badge label={priorityLabel(aiReplyDraft.priority).label} colorClass={priorityLabel(aiReplyDraft.priority).colorClass} />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setAiReplyDraft(null)} className="justify-center">
                Затвори
              </Button>
              <Button onClick={() => void saveAiReplyDraft()} className="justify-center gap-2 shadow-lg shadow-sky-600/20">
                <CheckCircle2 className="h-4 w-4" />
                Запиши в бележките
              </Button>
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

function serviceTypeLabel(value: string | null | undefined) {
  if (value === "sale") return "Продажба";
  if (value === "installation") return "Монтаж";
  if (value === "maintenance") return "Профилактика";
  if (value === "repair") return "Ремонт";
  return "—";
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function InquiryNotesModal({
  inquiryId,
  initialNotes,
  onClose,
  onSave,
}: {
  inquiryId: string;
  initialNotes: string;
  onClose: () => void;
  onSave: (notes: string | null) => Promise<void>;
}) {
  const [text, setText] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[calc(100vh-1rem)] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-bold text-sm text-slate-900 mb-0.5 inline-flex items-center gap-1.5">
          Вътрешни бележки (CRM)
          <InfoDot text="Тези бележки са само за вътрешна работа и не се изпращат към клиента." />
        </div>
        <p className="text-[10px] text-slate-500 mb-2 font-mono">ID: {inquiryId}</p>
        
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Бележки само за екипа…"
          className="mb-2"
        />
        
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отказ
          </Button>
          <Button
            variant="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(text.trim() || null);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Запис…" : "Запази"}
          </Button>
        </div>
      </div>
    </div>
  );
}
