"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpRow, HelpCard, Card, Input, Select, Textarea, Button, Table, Th, Td } from "../ui";
import { ChevronDown, ChevronUp, Search, UserPlus, Users, Activity, FileText, Phone, Mail, MapPin, Sparkles, X, CheckCircle2 } from "lucide-react";
import { ProductQuickViewButton } from "../ProductQuickView";

type ContactRow = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  customer_status?: "new" | "active" | "vip" | "lost" | null;
  next_follow_up_at?: string | null;
  last_contacted_at?: string | null;
  updated_at: string;
};

type ContactHistoryRow = {
  id: string;
  source?: "work_item" | "inquiry";
  event_code?: string | null;
  type: string;
  status: "planned" | "in_progress" | "done" | "cancelled" | "new" | "spam";
  title: string;
  due_date?: string | null;
  total_amount?: number | null;
  created_at: string;
  products?: { id?: string; name?: string; slug?: string } | null;
  service_type?: string | null;
  message?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
};

type AiSummaryDraft = {
  summary?: string;
  nextAction?: string;
};

function statusBadgeClass(status: ContactHistoryRow["status"]): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-sky-100 border-sky-200 text-sky-800`;
  if (status === "planned") return `${base} bg-amber-100 border-amber-200 text-amber-800`;
  if (status === "new") return `${base} bg-violet-100 border-violet-200 text-violet-800`;
  if (status === "spam") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-slate-100 border-slate-200 text-slate-600`;
}

function statusLabel(status: ContactHistoryRow["status"]): string {
  if (status === "planned") return "Чака";
  if (status === "in_progress") return "В процес";
  if (status === "done") return "Изпълнена";
  if (status === "new") return "Ново";
  if (status === "spam") return "Спам";
  if (status === "cancelled") return "Отказана";
  return status;
}

function customerStatusLabel(status: ContactRow["customer_status"]): string {
  if (status === "vip") return "VIP клиент";
  if (status === "active") return "Активен клиент";
  if (status === "lost") return "Загубен клиент";
  return "Нов клиент";
}

function normalizePhone(input: string | null | undefined): string {
  return String(input ?? "").replace(/[^\d+]/g, "").trim();
}

function normalizeEmail(input: string | null | undefined): string {
  return String(input ?? "").trim().toLowerCase();
}

export default function AdminContactsPage() {
  const [items, setItems] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<ContactRow | null>(null);
  const [history, setHistory] = useState<ContactHistoryRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    customerStatus: "new" as "new" | "active" | "vip" | "lost",
    nextFollowUpAt: "",
  });
  const [crmForm, setCrmForm] = useState({
    customerStatus: "new" as "new" | "active" | "vip" | "lost",
    nextFollowUpAt: "",
    lastContactedAt: "",
    notes: "",
  });
  const [savingCrm, setSavingCrm] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSummaryDraft, setAiSummaryDraft] = useState<AiSummaryDraft | null>(null);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeResults, setMergeResults] = useState<ContactRow[]>([]);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [merging, setMerging] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    sp.set("perPage", "200");
    return sp.toString();
  }, [q]);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contacts?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      const rows = (json.data ?? []) as ContactRow[];
      setItems(rows);
      if (!selected && rows[0]?.id) setSelected(rows[0].id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setDetail((json.data?.contact ?? null) as ContactRow | null);
      setHistory((json.data?.history ?? []) as ContactHistoryRow[]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!detail) return;
    setCrmForm({
      customerStatus: detail.customer_status ?? "new",
      nextFollowUpAt: String(detail.next_follow_up_at ?? "").slice(0, 10),
      lastContactedAt: String(detail.last_contacted_at ?? "").slice(0, 10),
      notes: detail.notes ?? "",
    });
  }, [detail]);

  useEffect(() => {
    if (!selected) return;
    const q = mergeQuery.trim();
    if (q.length < 2) {
      setMergeResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/contacts?q=${encodeURIComponent(q)}&perPage=20`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok) return;
        const rows = ((json.data ?? []) as ContactRow[]).filter((r) => r.id !== selected);
        setMergeResults(rows);
      } catch {
        // non-blocking
      }
    }, 170);
    return () => clearTimeout(t);
  }, [mergeQuery, selected]);

  const duplicateSuggestions = useMemo(() => {
    if (!detail) return [];
    const currentPhone = normalizePhone(detail.phone);
    const currentEmail = normalizeEmail(detail.email);
    return items
      .filter((c) => c.id !== detail.id)
      .map((c) => {
        const samePhone = !!currentPhone && normalizePhone(c.phone) === currentPhone;
        const sameEmail = !!currentEmail && normalizeEmail(c.email) === currentEmail;
        const score = (samePhone ? 2 : 0) + (sameEmail ? 1 : 0);
        return { row: c, samePhone, sameEmail, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.row.full_name.localeCompare(b.row.full_name))
      .slice(0, 6);
  }, [detail, items]);

  async function createContact() {
    if (!newForm.fullName.trim() || !newForm.phone.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newForm.fullName.trim(),
          phone: newForm.phone.trim(),
          email: newForm.email.trim() || null,
          address: newForm.address.trim() || null,
          notes: newForm.notes.trim() || null,
        customerStatus: newForm.customerStatus,
        nextFollowUpAt: newForm.nextFollowUpAt || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при създаване");
      const id = (json as any).data?.id as string;
      setNewForm({ fullName: "", phone: "", email: "", address: "", notes: "", customerStatus: "new", nextFollowUpAt: "" });
      await loadList();
      if (id) setSelected(id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setCreating(false);
    }
  }

  async function saveCrmFields(markContacted = false) {
    if (!detail) return;
    setSavingCrm(true);
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/admin/contacts/${detail.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerStatus: crmForm.customerStatus,
          nextFollowUpAt: crmForm.nextFollowUpAt || null,
          lastContactedAt: markContacted ? today : crmForm.lastContactedAt || null,
          notes: crmForm.notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при запис");
      await loadDetail(detail.id);
      await loadList();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSavingCrm(false);
    }
  }

  async function generateContactSummary() {
    if (!detail) return;
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "contact_summary",
          input: {
            contactName: detail.full_name,
            phone: detail.phone,
            email: detail.email ?? null,
            notes: crmForm.notes || detail.notes || null,
            history: history.slice(0, 20),
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "AI заявката не успя");
      const draft = ((json as any).data ?? {}) as AiSummaryDraft;
      if (!draft.summary && !draft.nextAction) return;
      setAiSummaryDraft(draft);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setAiBusy(false);
    }
  }

  function appendAiSummaryToNotes() {
    if (!aiSummaryDraft) return;
    const summary = [
      aiSummaryDraft.summary && `Резюме: ${aiSummaryDraft.summary}`,
      aiSummaryDraft.nextAction && `Следващо действие: ${aiSummaryDraft.nextAction}`,
    ]
      .filter(Boolean)
      .join("\n");
    setCrmForm((f) => ({ ...f, notes: [f.notes.trim(), summary].filter(Boolean).join("\n\n") }));
    setAiSummaryDraft(null);
  }

  async function mergeContactIntoSelected() {
    if (!selected || !mergeSourceId) return;
    if (!confirmMerge) {
      setConfirmMerge(true);
      return;
    }
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/contacts/merge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: selected, sourceId: mergeSourceId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при сливане");
      setMergeSourceId("");
      setMergeQuery("");
      setMergeResults([]);
      setConfirmMerge(false);
      await loadList();
      await loadDetail(selected);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2">
        {mobileView === "detail" && detail ? (
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className="lg:hidden flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-800 active:text-sky-900 transition-colors"
          >
            <ChevronDown className="w-4 h-4 rotate-90" /> Назад към списъка
          </button>
        ) : (
          <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">Контакти</h1>
        )}
      </div>

      <HelpCard className="hidden md:block">
        <HelpRow items={["Ляво: търсене + нов контакт", "Дясно: детайли + история + сливане", "Статуси и суми са в таблицата по дати"]} />
      </HelpCard>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 items-start">
        {/* Left column: list — on mobile hidden when in detail view */}
        <div className={`space-y-2 ${mobileView === "detail" ? "hidden lg:block" : "block"}`}>
          <CollapsiblePanel
            title="Търсене"
            subtitle="Филтър по име, телефон или имейл."
            icon={<Search className="w-4 h-4" />}
            open={showSearch}
            onToggle={() => setShowSearch((v) => !v)}
          >
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="напр. Иван / 0888..." />
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Нов контакт"
            subtitle="Полета със * са задължителни."
            icon={<UserPlus className="w-4 h-4" />}
            open={showCreate}
            onToggle={() => setShowCreate((v) => !v)}
          >
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Име и фамилия *</span>
                <Input value={newForm.fullName} onChange={(e) => setNewForm((f) => ({ ...f, fullName: e.target.value }))} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Телефон *</span>
                <Input value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Имейл</span>
                <Input value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Адрес</span>
                <Input value={newForm.address} onChange={(e) => setNewForm((f) => ({ ...f, address: e.target.value }))} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Статус клиент</span>
                <Select value={newForm.customerStatus} onChange={(e) => setNewForm((f) => ({ ...f, customerStatus: e.target.value as typeof newForm.customerStatus }))}>
                  <option value="new">Нов</option>
                  <option value="active">Активен</option>
                  <option value="vip">VIP</option>
                  <option value="lost">Загубен</option>
                </Select>
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Следващо обаждане</span>
                <Input type="date" value={newForm.nextFollowUpAt} onChange={(e) => setNewForm((f) => ({ ...f, nextFollowUpAt: e.target.value }))} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Бележка</span>
                <Textarea value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
              </label>
              <Button 
                variant="primary" 
                className="w-full mt-2" 
                onClick={() => void createContact()} 
                disabled={creating || !newForm.fullName.trim() || !newForm.phone.trim()}
              >
                {creating ? "Създаване..." : "Създай контакт"}
              </Button>
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Списък контакти"
            subtitle={loading ? "Зареждане..." : `Общо контакти: ${items.length}`}
            icon={<Users className="w-4 h-4" />}
            open={showList}
            onToggle={() => setShowList((v) => !v)}
          >
            <div className="max-h-[38vh] lg:max-h-[55vh] overflow-y-auto space-y-1 pr-0.5">
              {loading ? <div className="text-sm text-slate-500 p-2 text-center">Зареждане...</div> : null}
              {items.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border transition-colors ${
                    selected === c.id
                      ? "bg-sky-50 border-sky-200"
                      : "bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => { setSelected(c.id); setMobileView("detail"); }}
                    className="w-full text-left p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 text-xs leading-tight truncate">{c.full_name}</div>
                      {c.customer_status === "vip" && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">VIP</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{c.phone}</div>
                    {c.next_follow_up_at && (
                      <div className="text-[10px] text-sky-600 font-semibold mt-0.5">→ {new Date(c.next_follow_up_at).toLocaleDateString("bg-BG")}</div>
                    )}
                  </button>
                  <div className="flex border-t border-slate-100 lg:hidden">
                    <a
                      href={`tel:${c.phone}`}
                      className="flex-1 text-center py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 active:bg-sky-100 transition-colors rounded-b-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3.5 h-3.5 inline mr-1" />Обади се
                    </a>
                  </div>
                </div>
              ))}
              {!loading && items.length === 0 ? <div className="text-sm text-slate-500 p-4 text-center">Няма намерени контакти.</div> : null}
            </div>
          </CollapsiblePanel>
        </div>

        {/* Right column: detail — on mobile hidden when in list view */}
        <div className={`space-y-2 ${mobileView === "list" ? "hidden lg:block" : "block"}`}>
          {!detail ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center text-slate-500 border-dashed">
              <Users className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">Избери контакт от списъка</p>
              <p className="text-sm mt-1">за да видиш детайли и история</p>
            </Card>
          ) : (
            <>
              <Card className="p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4 md:mb-6">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-lg md:text-xl font-bold shrink-0">
                    {detail.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">{detail.full_name}</h2>
                    <p className="text-xs md:text-sm text-slate-500">
                      {customerStatusLabel(detail.customer_status)} · {new Date(detail.updated_at).toLocaleDateString("bg-BG")}
                    </p>
                  </div>
                  {/* Mobile quick action buttons */}
                  <div className="flex items-center gap-2 lg:hidden shrink-0">
                    <a href={`tel:${detail.phone}`} className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center active:bg-sky-200 transition-colors">
                      <Phone className="w-5 h-5" />
                    </a>
                    {detail.email && (
                      <a href={`mailto:${detail.email}`} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center active:bg-slate-200 transition-colors">
                        <Mail className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Телефон</div>
                      <a href={`tel:${detail.phone}`} className="text-sm font-medium text-sky-700 mt-0.5 block hover:underline">{detail.phone || "—"}</a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Имейл</div>
                      <div className="text-sm font-medium text-slate-900 mt-0.5 truncate">{detail.email || "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 md:col-span-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Адрес</div>
                      <div className="text-sm font-medium text-slate-900 mt-0.5">{detail.address || "—"}</div>
                    </div>
                  </div>
                  {detail.notes && (
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 md:col-span-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Бележки</div>
                        <div className="text-sm font-medium text-slate-900 mt-0.5 whitespace-pre-wrap">{detail.notes}</div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">CRM следващо действие</div>
                    <div className="text-xs text-slate-500">Използва се за списъка „Контакти за обаждане“ на таблото.</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void saveCrmFields(true)} disabled={savingCrm}>
                    Маркирай контакт днес
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void generateContactSummary()} disabled={aiBusy}>
                    {aiBusy ? "AI..." : "AI резюме"}
                  </Button>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setCrmForm((f) => ({ ...f, nextFollowUpAt: tomorrow.toISOString().slice(0, 10) }));
                    }}
                  >
                    Планирай утре
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCrmForm((f) => ({ ...f, notes: [f.notes.trim(), `[${new Date().toLocaleString("bg-BG")}] Бърза бележка:`].filter(Boolean).join("\n\n") }))}
                  >
                    + Бърза бележка
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Статус</span>
                    <Select value={crmForm.customerStatus} onChange={(e) => setCrmForm((f) => ({ ...f, customerStatus: e.target.value as typeof crmForm.customerStatus }))}>
                      <option value="new">Нов</option>
                      <option value="active">Активен</option>
                      <option value="vip">VIP</option>
                      <option value="lost">Загубен</option>
                    </Select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Следващо обаждане</span>
                    <Input type="date" value={crmForm.nextFollowUpAt} onChange={(e) => setCrmForm((f) => ({ ...f, nextFollowUpAt: e.target.value }))} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Последен контакт</span>
                    <Input type="date" value={crmForm.lastContactedAt} onChange={(e) => setCrmForm((f) => ({ ...f, lastContactedAt: e.target.value }))} />
                  </label>
                  <div className="flex items-end">
                    <Button variant="primary" className="w-full" onClick={() => void saveCrmFields()} disabled={savingCrm}>
                      {savingCrm ? "Запис..." : "Запази CRM"}
                    </Button>
                  </div>
                  <label className="grid gap-1.5 md:col-span-4">
                    <span className="text-xs font-bold text-slate-600">CRM бележка</span>
                    <Textarea value={crmForm.notes} onChange={(e) => setCrmForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                  </label>
                </div>
              </Card>

              <CollapsiblePanel
                title="История на контакта"
                subtitle={history.length ? `Записи: ${history.length}` : "Няма записи"}
                icon={<Activity className="w-4 h-4" />}
                open={showHistory}
                onToggle={() => setShowHistory((v) => !v)}
              >
                {/* Desktop table */}
                <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Тип</Th>
                        <Th>Събитие</Th>
                        <Th>Статус</Th>
                        <Th>Продукт</Th>
                        <Th>Сума</Th>
                        <Th>Дата</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <Td>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.source === "inquiry" ? "bg-purple-50 text-purple-700" : "bg-sky-50 text-sky-700"}`}>
                              {r.source === "inquiry" ? "Запитване" : "Операция"}
                            </span>
                          </Td>
                          <Td className="font-medium text-slate-900">
                            {r.source === "inquiry" ? `Запитване${r.service_type ? ` - ${r.service_type}` : ""}` : r.title}
                          </Td>
                          <Td><span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span></Td>
                          <Td>
                            {r.products?.name ? <ProductQuickViewButton productId={r.products.id} productName={r.products.name} /> : "—"}
                          </Td>
                          <Td className="font-semibold">
                            {r.total_amount != null ? `€${Number(r.total_amount).toLocaleString()}` : "—"}
                          </Td>
                          <Td className="text-xs">{new Date(r.due_date || r.created_at).toLocaleString()}</Td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr><Td colSpan={6} className="text-center py-8 text-slate-500">Няма събития за този контакт.</Td></tr>
                      )}
                    </tbody>
                  </Table>
                </div>
                {/* Mobile card list */}
                <div className="md:hidden space-y-2">
                  {history.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-sm">Няма събития за този контакт.</div>
                  )}
                  {history.map((r) => (
                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="font-semibold text-slate-900 text-sm leading-snug">
                          {r.source === "inquiry" ? `Запитване${r.service_type ? ` - ${r.service_type}` : ""}` : r.title}
                        </div>
                        {r.total_amount != null && (
                          <span className="font-black text-slate-900 text-sm shrink-0">€{Number(r.total_amount).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${r.source === "inquiry" ? "bg-purple-50 text-purple-700" : "bg-sky-50 text-sky-700"}`}>
                          {r.source === "inquiry" ? "Запитване" : "Операция"}
                        </span>
                        <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                        {r.products?.name && <ProductQuickViewButton productId={r.products.id} productName={r.products.name} />}
                        <span className="text-[10px] text-slate-400 ml-auto">{new Date(r.due_date || r.created_at).toLocaleDateString("bg-BG")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Сливане на дубликат"
                subtitle="Основният контакт остава, а данните от дубликата се прехвърлят."
                icon={<Users className="w-4 h-4" />}
                open={showMerge}
                onToggle={() => setShowMerge((v) => !v)}
              >
                {duplicateSuggestions.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Авто предложения (съвпадение по телефон/имейл):</div>
                    <div className="flex flex-wrap gap-2">
                      {duplicateSuggestions.map((s) => (
                        <button
                          key={s.row.id}
                          type="button"
                          onClick={() => {
                            setMergeSourceId(s.row.id);
                            setMergeQuery(`${s.row.full_name} (${s.row.phone})`);
                            setMergeResults([]);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 rounded-full text-sm font-medium text-slate-700 transition-colors"
                          title={`${s.samePhone ? "Съвпадение телефон " : ""}${s.sameEmail ? "Съвпадение имейл" : ""}`.trim()}
                        >
                          {s.row.full_name}
                          {s.samePhone && <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold">телефон</span>}
                          {s.sameEmail && <span className="px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">имейл</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="relative flex-1 w-full">
                    <Input
                      value={mergeQuery}
                      onChange={(e) => {
                        setMergeQuery(e.target.value);
                        setMergeSourceId("");
                      }}
                      placeholder="Търси дублиран контакт..."
                    />
                    {mergeResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 border border-slate-200 rounded-xl bg-white shadow-lg max-h-36 overflow-y-auto p-1">
                        {mergeResults.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setMergeSourceId(r.id);
                              setMergeQuery(`${r.full_name} (${r.phone})`);
                              setMergeResults([]);
                            }}
                            className="block w-full text-left p-2 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            <div className="text-sm font-bold text-slate-900">{r.full_name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{r.phone}{r.email ? ` / ${r.email}` : ""}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="hidden sm:block text-slate-400">→</div>
                    <Button type="button" variant="secondary" disabled className="truncate max-w-[200px]">
                      {detail.full_name}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void mergeContactIntoSelected()}
                      disabled={merging || !mergeSourceId}
                      className="shrink-0"
                    >
                      {merging ? "Сливане..." : "Слей дубликата"}
                    </Button>
                  </div>
                </div>
              </CollapsiblePanel>
            </>
          )}
        </div>
      </div>

      {aiSummaryDraft && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 md:p-4 backdrop-blur-md"
          onClick={() => setAiSummaryDraft(null)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_-8px_60px_rgba(15,23,42,0.35)] md:shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f8fafc_100%)] px-6 py-5">
              <button
                type="button"
                onClick={() => setAiSummaryDraft(null)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-label="Затвори AI резюме"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 pr-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/25">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Gemini CRM анализ</div>
                  <div className="mt-1 text-2xl font-black leading-tight text-slate-950">AI резюме за клиента</div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              {aiSummaryDraft.summary && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Резюме</div>
                  <div className="text-sm font-medium leading-6 text-slate-900">{aiSummaryDraft.summary}</div>
                </div>
              )}

              {aiSummaryDraft.nextAction && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sky-700">Следващо действие</div>
                  <div className="text-sm font-semibold leading-6 text-slate-900">{aiSummaryDraft.nextAction}</div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setAiSummaryDraft(null)} className="justify-center">
                Затвори
              </Button>
              <Button onClick={appendAiSummaryToNotes} className="justify-center gap-2 shadow-lg shadow-sky-600/20">
                <CheckCircle2 className="h-4 w-4" />
                Добави към CRM бележката
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmMerge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onClick={() => setConfirmMerge(false)}
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-black text-slate-950">Сливане на дубликат</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">
              Дублираният контакт ще бъде премахнат, а историята и данните му ще се прехвърлят към основния контакт.
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmMerge(false)} disabled={merging}>Отказ</Button>
              <Button variant="primary" onClick={() => void mergeContactIntoSelected()} disabled={merging}>
                {merging ? "Сливане..." : "Слей дубликата"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsiblePanel({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 transition-colors ${open ? "border-b border-slate-100" : ""}`}
      >
        <div className="flex items-center gap-2">
          {icon && <div className="text-slate-400 [&_svg]:w-3.5 [&_svg]:h-3.5">{icon}</div>}
          <div className="text-left min-w-0">
            <div className="text-xs font-bold text-slate-900 leading-tight">{title}</div>
            {subtitle && <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{subtitle}</div>}
          </div>
        </div>
        <div className="text-slate-400 shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && <div className="p-2.5 bg-white">{children}</div>}
    </Card>
  );
}
