"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HelpRow, HelpCard, Card, Input, Select, Textarea, Button, Table, Th, Td } from "../ui";
import { ChevronDown, ChevronUp, Search, UserPlus, Users, Activity, FileText, Phone, Mail, MapPin, X, ChevronLeft, ChevronRight, Truck, Plus, Trash2, Save, Pencil } from "lucide-react";
import { ProductQuickViewButton } from "../ProductQuickView";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { assertNoContactPrimaryPhoneDuplicate } from "@/lib/admin/contactPhoneConflictClient";
import { inquiryServiceTypeLabel } from "@/lib/inquiry/serviceTypeLabels";

type ContactKind = "client" | "supplier";

/**
 * Визуални теми за двата таба — клиенти (brand-blue / #00B4D8) и
 * доставчици (brand-orange / #FF4D00). Цветовете съответстват точно
 * на брандинга на публичния сайт (виж frontend/index.css).
 * Държим всички класове изрично, за да може Tailwind JIT да ги генерира.
 */
const TAB_THEME: Record<
  ContactKind,
  {
    title: string;
    titleSingular: string;
    titleSingularCapital: string;
    accentText: string;
    accentBg: string;
    accentBgSoft: string;
    accentBorder: string;
    accentBorderSoft: string;
    accentRing: string;
    pageBg: string;
    selectedBg: string;
    selectedBorder: string;
    selectedBorderHover: string;
    avatarBg: string;
    avatarText: string;
    tabActiveText: string;
    tabActiveShadow: string;
    helpText: string;
    bannerBg: string;
    bannerBorder: string;
    pillBg: string;
    pillText: string;
    icon: typeof Users;
  }
> = {
  client: {
    title: "Клиенти",
    titleSingular: "клиент",
    titleSingularCapital: "Клиент",
    accentText: "text-brand-blue-700",
    accentBg: "bg-brand-blue-500",
    accentBgSoft: "bg-brand-blue-50",
    accentBorder: "border-brand-blue-300",
    accentBorderSoft: "border-brand-blue-200",
    accentRing: "focus:ring-brand-blue-300",
    pageBg: "bg-brand-blue-50/40",
    selectedBg: "bg-brand-blue-50",
    selectedBorder: "border-brand-blue-200",
    selectedBorderHover: "hover:border-brand-blue-300",
    avatarBg: "bg-brand-blue-100",
    avatarText: "text-brand-blue-600",
    tabActiveText: "text-brand-blue-700",
    tabActiveShadow: "shadow-sm",
    helpText: "Списък с физически лица и компании, които купуват или ползват услугите ни.",
    bannerBg: "bg-brand-blue-50",
    bannerBorder: "border-brand-blue-200",
    pillBg: "bg-brand-blue-100",
    pillText: "text-brand-blue-700",
    icon: Users,
  },
  supplier: {
    title: "Доставчици",
    titleSingular: "доставчик",
    titleSingularCapital: "Доставчик",
    accentText: "text-brand-orange-700",
    accentBg: "bg-brand-orange-500",
    accentBgSoft: "bg-brand-orange-50",
    accentBorder: "border-brand-orange-300",
    accentBorderSoft: "border-brand-orange-200",
    accentRing: "focus:ring-brand-orange-300",
    pageBg: "bg-brand-orange-50/40",
    selectedBg: "bg-brand-orange-50",
    selectedBorder: "border-brand-orange-200",
    selectedBorderHover: "hover:border-brand-orange-300",
    avatarBg: "bg-brand-orange-100",
    avatarText: "text-brand-orange-600",
    tabActiveText: "text-brand-orange-700",
    tabActiveShadow: "shadow-sm",
    helpText: "Фирми и лица, от които купувате стока (климатици, аксесоари, услуги).",
    bannerBg: "bg-brand-orange-50",
    bannerBorder: "border-brand-orange-200",
    pillBg: "bg-brand-orange-100",
    pillText: "text-brand-orange-700",
    icon: Truck,
  },
};

type ContactRow = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  contact_kind?: "client" | "supplier" | null;
  customer_status?: "new" | "active" | "vip" | "lost" | null;
  next_follow_up_at?: string | null;
  last_contacted_at?: string | null;
  updated_at: string;
};

/**
 * Допълнителен телефон, върнат от GET /api/admin/contacts/[id].
 * Основният телефон се пази в `contacts.phone`, а тук виждаме всичките
 * (вкл. основния), за да можем да правим списък с „call“ бутони.
 */
type ContactPhone = {
  id: string;
  phone: string;
  label: string | null;
  is_primary: boolean;
  sort_order: number;
};

/** Локален draft за нов / редактиран „допълнителен“ телефон (без id). */
type PhoneDraft = {
  phone: string;
  label: string;
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

function statusBadgeClass(status: ContactHistoryRow["status"]): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700`;
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
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Зареждане...</div>}>
      <AdminContactsPageInner />
    </Suspense>
  );
}

function AdminContactsPageInner() {
  const searchParams = useSearchParams();
  const initialKind: ContactKind = searchParams?.get("kind") === "supplier" ? "supplier" : "client";
  const [contactsTab, setContactsTab] = useState<ContactKind>(initialKind);
  const theme = TAB_THEME[contactsTab];
  const TabIcon = theme.icon;
  const [items, setItems] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<ContactRow | null>(null);
  const [detailPhones, setDetailPhones] = useState<ContactPhone[]>([]);
  /**
   * Локален буфер за редакция на допълнителните телефони на текущия контакт.
   * Когато потребителят натисне „Запази телефони“ — изпращаме pull patch.
   */
  const [phonesDraft, setPhonesDraft] = useState<PhoneDraft[]>([]);
  const [history, setHistory] = useState<ContactHistoryRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    fullName: "",
    phone: "",
    additionalPhones: [] as PhoneDraft[],
    email: "",
    address: "",
    notes: "",
    contactKind: "client" as "client" | "supplier",
    customerStatus: "new" as "new" | "active" | "vip" | "lost",
    nextFollowUpAt: "",
  });
  // Редакция на основния профил (име, основен телефон, имейл, адрес, бележки).
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeResults, setMergeResults] = useState<ContactRow[]>([]);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [merging, setMerging] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  // Търсенето е отворено по подразбиране — то е основната точка на интеракция.
  const [showSearch, setShowSearch] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showList, setShowList] = useState(false);
  // Autocomplete dropdown под полето за търсене.
  const [acOpen, setAcOpen] = useState(false);
  const [acItems, setAcItems] = useState<ContactRow[]>([]);
  const [acLoading, setAcLoading] = useState(false);
  const [acIndex, setAcIndex] = useState(-1);
  const [showMerge, setShowMerge] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsTotal, setContactsTotal] = useState(0);
  const CONTACTS_PER_PAGE = 50;

  const debouncedQ = useDebounce(q, 350);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    sp.set("kind", contactsTab);
    sp.set("perPage", String(CONTACTS_PER_PAGE));
    sp.set("page", String(contactsPage));
    return sp.toString();
  }, [debouncedQ, contactsPage, contactsTab]);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contacts?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      const rows = (json.data ?? []) as ContactRow[];
      setItems(rows);
      setContactsTotal(json.meta?.total ?? rows.length);
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
      const phones = (json.data?.phones ?? []) as ContactPhone[];
      setDetailPhones(phones);
      // Локалният draft съдържа само ДОПЪЛНИТЕЛНИТЕ (без is_primary).
      setPhonesDraft(
        phones
          .filter((p) => !p.is_primary)
          .map((p) => ({ phone: p.phone, label: p.label ?? "" })),
      );
      setHistory((json.data?.history ?? []) as ContactHistoryRow[]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  // Reset to page 1 when search or tab changes
  useEffect(() => {
    setContactsPage(1);
  }, [debouncedQ, contactsTab]);

  /**
   * Autocomplete: при изписване на 2+ символа дърпаме топ 8 съвпадения
   * от текущия таб (клиенти / доставчици) по име, телефон или имейл и ги
   * показваме като dropdown под полето. При избор → отваряме детайла.
   *
   * ВАЖНО: ползваме същия /api/admin/contacts endpoint, само че с по-малък
   * perPage. Не дублираме API — поведението на бекенда е същото.
   */
  useEffect(() => {
    const term = debouncedQ.trim();
    if (term.length < 2) {
      setAcItems([]);
      setAcLoading(false);
      setAcIndex(-1);
      return;
    }
    setAcLoading(true);
    setAcIndex(-1);
    let cancelled = false;
    void (async () => {
      try {
        const sp = new URLSearchParams();
        sp.set("q", term);
        sp.set("kind", contactsTab);
        sp.set("perPage", "8");
        sp.set("page", "1");
        const res = await fetch(`/api/admin/contacts?${sp.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) setAcItems((json.data ?? []) as ContactRow[]);
      } catch {
        // не блокираме UI при мрежов проблем — main list-ът има собствено зареждане
      } finally {
        if (!cancelled) setAcLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, contactsTab]);

  function selectAutocompleteItem(c: ContactRow) {
    setSelected(c.id);
    setMobileView("detail");
    setAcOpen(false);
    setAcIndex(-1);
    setQ("");
  }

  useEffect(() => {
    setNewForm((f) => ({ ...f, contactKind: contactsTab }));
  }, [contactsTab]);

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
    setEditForm({
      fullName: detail.full_name ?? "",
      phone: detail.phone ?? "",
      email: detail.email ?? "",
      address: detail.address ?? "",
      notes: detail.notes ?? "",
    });
  }, [detail]);

  // При смяна на избран контакт затваряме edit mode-а — иначе непотвърдените
  // промени щяха да изтекат към другия профил.
  useEffect(() => {
    setEditingProfile(false);
  }, [selected]);

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
      await assertNoContactPrimaryPhoneDuplicate(newForm.phone.trim());

      // Изхвърляме празните допълнителни телефони и нормализираме labels.
      const extras = newForm.additionalPhones
        .map((p) => ({ phone: p.phone.trim(), label: p.label.trim() }))
        .filter((p) => p.phone.length >= 3)
        .map((p) => ({ phone: p.phone, label: p.label || null, isPrimary: false }));

      const res = await fetch("/api/admin/contacts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newForm.fullName.trim(),
          phone: newForm.phone.trim(),
          additionalPhones: extras,
          email: newForm.email.trim() || null,
          address: newForm.address.trim() || null,
          notes: newForm.notes.trim() || null,
          contactKind: contactsTab,
          customerStatus: contactsTab === "client" ? newForm.customerStatus : "new",
          nextFollowUpAt: null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при създаване");
      const id = (json as any).data?.id as string;
      setNewForm({
        fullName: "",
        phone: "",
        additionalPhones: [],
        email: "",
        address: "",
        notes: "",
        contactKind: contactsTab,
        customerStatus: "new",
        nextFollowUpAt: "",
      });
      await loadList();
      if (id) setSelected(id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setCreating(false);
    }
  }

  /**
   * Запазва редактираните основни полета на контакта (име / основен телефон /
   * имейл / адрес / бележки) И допълнителните телефони в една заявка.
   * Бекендът прави пълен replace на contact_phones, когато подадем
   * `additionalPhones` — затова пращаме целия draft наведнъж.
   */
  async function saveProfile() {
    if (!detail) return;
    const fullName = editForm.fullName.trim();
    const phone = editForm.phone.trim();
    if (fullName.length < 2 || phone.length < 3) {
      setError("Името трябва да е поне 2 символа, а телефонът поне 3.");
      return;
    }
    setSavingProfile(true);
    setError(null);
    try {
      await assertNoContactPrimaryPhoneDuplicate(phone, detail.id);

      const extras = phonesDraft
        .map((p) => ({ phone: p.phone.trim(), label: p.label.trim() }))
        .filter((p) => p.phone.length >= 3)
        .map((p) => ({ phone: p.phone, label: p.label || null, isPrimary: false }));

      const res = await fetch(`/api/admin/contacts/${detail.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          additionalPhones: extras,
          email: editForm.email.trim() || null,
          address: editForm.address.trim() || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при запис на профила");
      setEditingProfile(false);
      await loadDetail(detail.id);
      await loadList();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSavingProfile(false);
    }
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

  const detailKind: ContactKind = detail?.contact_kind === "supplier" ? "supplier" : "client";
  const detailTheme = TAB_THEME[detailKind];
  const detailCallBtnClass = detailKind === "client"
    ? "bg-brand-blue-100 text-brand-blue-700 active:bg-brand-blue-200"
    : "bg-brand-orange-100 text-brand-orange-700 active:bg-brand-orange-200";

  return (
    <div className={`w-full space-y-3 -mx-3 px-3 py-2 rounded-2xl transition-colors duration-200 ${theme.pageBg}`}>
      <div className="flex items-center justify-between gap-2">
        {mobileView === "detail" && detail ? (
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className={`lg:hidden flex items-center gap-1.5 text-sm font-semibold ${theme.accentText} hover:opacity-80 active:opacity-70 transition-opacity`}
          >
            <ChevronDown className="w-4 h-4 rotate-90" /> Назад към списъка
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${theme.avatarBg} ${theme.avatarText} flex items-center justify-center shadow-sm`}>
              <TabIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">{theme.title}</h1>
              <div className={`text-[11px] font-semibold ${theme.accentText} uppercase tracking-wider`}>Контакти · {contactsTab === "client" ? "клиентска база" : "база с доставчици"}</div>
            </div>
          </div>
        )}
      </div>

      <HelpCard className={`hidden md:block ${theme.bannerBg} ${theme.bannerBorder} border`}>
        <HelpRow items={[theme.helpText, "Ляво: търсене + създаване", "Дясно: профил, история и сливане на дубликати"]} />
      </HelpCard>

      <div className={`flex rounded-xl border ${theme.accentBorderSoft} p-0.5 bg-white w-full max-w-md shadow-sm`}>
        <button
          type="button"
          onClick={() => setContactsTab("client")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
            contactsTab === "client"
              ? "bg-brand-blue-500 text-white shadow-sm"
              : "text-slate-500 hover:bg-brand-blue-50 hover:text-brand-blue-700"
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Клиенти
        </button>
        <button
          type="button"
          onClick={() => setContactsTab("supplier")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
            contactsTab === "supplier"
              ? "bg-brand-orange-500 text-white shadow-sm"
              : "text-slate-500 hover:bg-brand-orange-50 hover:text-brand-orange-700"
          }`}
        >
          <Truck className="w-3.5 h-3.5" /> Доставчици
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 items-start">
        {/* Left column: list — on mobile hidden when in detail view */}
        <div className={`space-y-2 ${mobileView === "detail" ? "hidden lg:block" : "block"}`}>
          <CollapsiblePanel
            title={`Търсене в ${theme.title.toLowerCase()}`}
            subtitle="Авто-предложения по име, телефон или имейл."
            icon={<Search className="w-4 h-4" />}
            open={showSearch}
            onToggle={() => setShowSearch((v) => !v)}
            accent={contactsTab}
          >
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setAcOpen(true);
                  }}
                  onFocus={() => setAcOpen(true)}
                  // Лек delay при blur — иначе click на suggestion се губи (mousedown blur-ва преди click).
                  onBlur={() => setTimeout(() => setAcOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (!acOpen || acItems.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setAcIndex((i) => Math.min(acItems.length - 1, i + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setAcIndex((i) => Math.max(-1, i - 1));
                    } else if (e.key === "Enter" && acIndex >= 0) {
                      e.preventDefault();
                      selectAutocompleteItem(acItems[acIndex]);
                    } else if (e.key === "Escape") {
                      setAcOpen(false);
                    }
                  }}
                  className="pl-9 pr-9"
                  placeholder={contactsTab === "client" ? "Търси по име, телефон или имейл..." : "Търси доставчик по име, телефон или имейл..."}
                />
                {q && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQ("");
                      setAcOpen(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title="Изчисти търсенето"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {acOpen && q.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-80 overflow-y-auto">
                  {acLoading && (
                    <div className="px-3 py-3 text-xs text-slate-500 text-center">Търсене...</div>
                  )}
                  {!acLoading && acItems.length === 0 && (
                    <div className="px-3 py-4 text-xs text-slate-500 text-center">
                      Няма {contactsTab === "client" ? "клиент" : "доставчик"} съответстващ на „{q.trim()}".
                    </div>
                  )}
                  {!acLoading &&
                    acItems.map((c, idx) => {
                      const active = idx === acIndex;
                      const itemAccent =
                        contactsTab === "client"
                          ? "hover:bg-brand-blue-50"
                          : "hover:bg-brand-orange-50";
                      const activeBg =
                        contactsTab === "client" ? "bg-brand-blue-50" : "bg-brand-orange-50";
                      const matchTerm = q.trim().toLowerCase();
                      const phoneMatch = c.phone?.toLowerCase().includes(matchTerm);
                      const emailMatch = c.email?.toLowerCase().includes(matchTerm);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setAcIndex(idx)}
                          onClick={() => selectAutocompleteItem(c)}
                          className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-0 transition-colors ${
                            active ? activeBg : itemAccent
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-sm text-slate-900 truncate flex-1">
                              {c.full_name}
                            </div>
                            {c.customer_status === "vip" && contactsTab === "client" && (
                              <span className="text-[9px] font-bold bg-yellow-200 text-amber-900 px-1.5 py-0.5 rounded-full shrink-0">
                                VIP
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            <span className={phoneMatch ? "font-bold text-slate-700" : ""}>
                              {c.phone || "—"}
                            </span>
                            {c.email && (
                              <>
                                {" · "}
                                <span className={emailMatch ? "font-bold text-slate-700" : ""}>
                                  {c.email}
                                </span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  {!acLoading && acItems.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] text-slate-400 text-center border-t border-slate-100 bg-slate-50">
                      ↑ ↓ за навигация, Enter за избор, Esc за затваряне
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            title={`Нов ${theme.titleSingular}`}
            subtitle="Полета със * са задължителни."
            icon={<UserPlus className="w-4 h-4" />}
            open={showCreate}
            onToggle={() => setShowCreate((v) => !v)}
            accent={contactsTab}
          >
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">{contactsTab === "client" ? "Име и фамилия *" : "Име на фирма / лице *"}</span>
                <Input
                  value={newForm.fullName}
                  onChange={(e) => setNewForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder={contactsTab === "client" ? "напр. Иван Петров" : "напр. Daikin Bulgaria ЕООД"}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Основен телефон *</span>
                <Input
                  value={newForm.phone}
                  onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="напр. 0888 123 456"
                />
              </label>

              {/* Допълнителни телефони — добавят се по желание (офис/сервиз/клон). */}
              {newForm.additionalPhones.length > 0 && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Допълнителни телефони
                  </div>
                  {newForm.additionalPhones.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                      <Input
                        value={p.phone}
                        onChange={(e) =>
                          setNewForm((f) => ({
                            ...f,
                            additionalPhones: f.additionalPhones.map((it, i) =>
                              i === idx ? { ...it, phone: e.target.value } : it,
                            ),
                          }))
                        }
                        placeholder="Телефон"
                        className="text-xs"
                      />
                      <Input
                        value={p.label}
                        onChange={(e) =>
                          setNewForm((f) => ({
                            ...f,
                            additionalPhones: f.additionalPhones.map((it, i) =>
                              i === idx ? { ...it, label: e.target.value } : it,
                            ),
                          }))
                        }
                        placeholder="Етикет (Офис / Сервиз)"
                        className="text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setNewForm((f) => ({
                            ...f,
                            additionalPhones: f.additionalPhones.filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Премахни телефона"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  setNewForm((f) => ({
                    ...f,
                    additionalPhones: [...f.additionalPhones, { phone: "", label: "" }],
                  }))
                }
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-xs font-semibold transition-colors ${
                  contactsTab === "client"
                    ? "border-brand-blue-300 text-brand-blue-700 hover:bg-brand-blue-50"
                    : "border-brand-orange-300 text-brand-orange-700 hover:bg-brand-orange-50"
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Добави още телефон
              </button>

              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Имейл</span>
                <Input value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Адрес</span>
                <Input value={newForm.address} onChange={(e) => setNewForm((f) => ({ ...f, address: e.target.value }))} />
              </label>
              {contactsTab === "client" && (
                <label className="block">
                  <span className="block text-xs font-bold text-slate-600 mb-1">Статус клиент</span>
                  <Select value={newForm.customerStatus} onChange={(e) => setNewForm((f) => ({ ...f, customerStatus: e.target.value as typeof newForm.customerStatus }))}>
                    <option value="new">Нов</option>
                    <option value="active">Активен</option>
                    <option value="vip">VIP</option>
                    <option value="lost">Загубен</option>
                  </Select>
                </label>
              )}
              <label className="block">
                <span className="block text-xs font-bold text-slate-600 mb-1">Бележка</span>
                <Textarea value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
              </label>
              <button
                type="button"
                onClick={() => void createContact()}
                disabled={creating || !newForm.fullName.trim() || !newForm.phone.trim()}
                className={`w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${contactsTab === "client" ? "bg-brand-blue-500 hover:bg-brand-blue-600 active:bg-brand-blue-700" : "bg-brand-orange-500 hover:bg-brand-orange-600 active:bg-brand-orange-700"}`}
              >
                <UserPlus className="w-4 h-4" />
                {creating ? "Създаване..." : `Създай ${theme.titleSingular}`}
              </button>
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            title={`Списък ${theme.title.toLowerCase()}`}
            subtitle={loading ? "Зареждане..." : `Общо: ${contactsTotal}`}
            icon={<TabIcon className="w-4 h-4" />}
            open={showList}
            onToggle={() => setShowList((v) => !v)}
            accent={contactsTab}
          >
            <div className="max-h-[38vh] lg:max-h-[55vh] overflow-y-auto space-y-1 pr-0.5">
              {loading ? <div className="text-sm text-slate-500 p-2 text-center">Зареждане...</div> : null}
              {items.map((c) => {
                const isSelected = selected === c.id;
                const itemSelectedClass =
                  contactsTab === "client"
                    ? "bg-brand-blue-50 border-brand-blue-300 ring-1 ring-brand-blue-200"
                    : "bg-brand-orange-50 border-brand-orange-300 ring-1 ring-brand-orange-200";
                const itemHoverClass =
                  contactsTab === "client"
                    ? "bg-white border-slate-200 hover:border-brand-blue-300 hover:bg-brand-blue-50/50"
                    : "bg-white border-slate-200 hover:border-brand-orange-300 hover:bg-brand-orange-50/50";
                const phoneBtnClass =
                  contactsTab === "client"
                    ? "text-brand-blue-700 hover:bg-brand-blue-50 active:bg-brand-blue-100"
                    : "text-brand-orange-700 hover:bg-brand-orange-50 active:bg-brand-orange-100";
                return (
                  <div
                    key={c.id}
                    className={`rounded-lg border transition-colors ${isSelected ? itemSelectedClass : itemHoverClass}`}
                  >
                    <button
                      type="button"
                      onClick={() => { setSelected(c.id); setMobileView("detail"); }}
                      className="w-full text-left p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-slate-900 text-xs leading-tight truncate">{c.full_name}</div>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.contact_kind === "supplier" && contactsTab === "client" && (
                            <span className="text-[9px] font-bold bg-brand-orange-100 text-brand-orange-700 px-1.5 py-0.5 rounded-full">Дост.</span>
                          )}
                          {c.contact_kind === "client" && contactsTab === "supplier" && (
                            <span className="text-[9px] font-bold bg-brand-blue-100 text-brand-blue-700 px-1.5 py-0.5 rounded-full">Клиент</span>
                          )}
                          {c.customer_status === "vip" && contactsTab === "client" && (
                            <span className="text-[9px] font-bold bg-yellow-200 text-amber-900 px-1.5 py-0.5 rounded-full">VIP</span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{c.phone}</div>
                      {c.next_follow_up_at && (
                        <div className={`text-[10px] font-semibold mt-0.5 ${theme.accentText}`}>→ {new Date(c.next_follow_up_at).toLocaleDateString("bg-BG")}</div>
                      )}
                    </button>
                    <div className="flex border-t border-slate-100 lg:hidden">
                      <a
                        href={`tel:${c.phone}`}
                        className={`flex-1 text-center py-2 text-xs font-semibold transition-colors rounded-b-lg ${phoneBtnClass}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-3.5 h-3.5 inline mr-1" />Обади се
                      </a>
                    </div>
                  </div>
                );
              })}
              {!loading && items.length === 0 ? <div className="text-sm text-slate-500 p-4 text-center">Няма намерени {theme.title.toLowerCase()}.</div> : null}
            </div>
            {/* Pagination */}
            {contactsTotal > CONTACTS_PER_PAGE && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  {(contactsPage - 1) * CONTACTS_PER_PAGE + 1}–{Math.min(contactsPage * CONTACTS_PER_PAGE, contactsTotal)} от {contactsTotal}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setContactsPage(p => Math.max(1, p - 1))}
                    disabled={contactsPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setContactsPage(p => p + 1)}
                    disabled={contactsPage * CONTACTS_PER_PAGE >= contactsTotal}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </CollapsiblePanel>
        </div>

        {/* Right column: detail — on mobile hidden when in list view */}
        <div className={`space-y-2 ${mobileView === "list" ? "hidden lg:block" : "block"}`}>
          {!detail ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center text-slate-500 border-dashed">
              <TabIcon className={`w-12 h-12 mb-4 ${theme.avatarText} opacity-50`} />
              <p className="text-lg font-medium text-slate-600">Избери {theme.titleSingular} от списъка</p>
              <p className="text-sm mt-1">за да видиш детайли и история</p>
            </Card>
          ) : (
            <>
              <Card className={`p-4 md:p-6 border-l-4 ${detailKind === "client" ? "border-l-brand-blue-500" : "border-l-brand-orange-500"}`}>
                <div className="flex items-center gap-3 mb-4 md:mb-6">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${detailTheme.avatarBg} ${detailTheme.avatarText} flex items-center justify-center text-lg md:text-xl font-bold shrink-0`}>
                    {detail.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-tight flex items-center gap-2 flex-wrap">
                      {detail.full_name}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${detailTheme.pillBg} ${detailTheme.pillText}`}>
                        {detailTheme.titleSingularCapital}
                      </span>
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500">
                      {detailKind === "client" ? customerStatusLabel(detail.customer_status) : "Доставчик"} · {new Date(detail.updated_at).toLocaleDateString("bg-BG")}
                    </p>
                  </div>
                  {/* Десктоп: бутон „Редактирай" в самия header. */}
                  {!editingProfile && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingProfile(true)}
                      className="hidden lg:inline-flex items-center gap-1.5 shrink-0"
                      title="Редактирай профила"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Редактирай
                    </Button>
                  )}
                  {/* Mobile quick action buttons (call / email / edit) */}
                  <div className="flex items-center gap-2 lg:hidden shrink-0">
                    {!editingProfile && (
                      <>
                        <a href={`tel:${detail.phone}`} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${detailCallBtnClass}`}>
                          <Phone className="w-5 h-5" />
                        </a>
                        {detail.email && (
                          <a href={`mailto:${detail.email}`} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center active:bg-slate-200 transition-colors">
                            <Mail className="w-5 h-5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingProfile(true)}
                          className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center active:bg-slate-200 transition-colors"
                          title="Редактирай профила"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editingProfile ? (
                  // ── Edit mode: всички основни полета са редактируеми ────────
                  <div className="space-y-3">
                    <label className="block">
                      <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                        {detailKind === "client" ? "Име и фамилия" : "Име на фирма / лице"} *
                      </span>
                      <Input
                        value={editForm.fullName}
                        onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                        placeholder={detailKind === "client" ? "напр. Иван Петров" : "напр. БУЛКЛИМА ЕООД"}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                        Основен телефон *
                      </span>
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="напр. 0888 123 456"
                      />
                    </label>

                    {/* Допълнителни телефони — inline в режим на редакция. */}
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> Допълнителни телефони
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Офис, сервиз, клонове и т.н. Записват се заедно с профила.
                          </div>
                        </div>
                      </div>
                      {phonesDraft.length === 0 && (
                        <div className="text-[11px] text-slate-500 px-2 py-2 bg-white rounded-lg border border-dashed border-slate-200 text-center">
                          Няма допълнителни телефони.
                        </div>
                      )}
                      {phonesDraft.map((p, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                          <Input
                            value={p.phone}
                            onChange={(e) =>
                              setPhonesDraft((arr) =>
                                arr.map((it, i) => (i === idx ? { ...it, phone: e.target.value } : it)),
                              )
                            }
                            placeholder="Телефон"
                            className="text-xs"
                          />
                          <Input
                            value={p.label}
                            onChange={(e) =>
                              setPhonesDraft((arr) =>
                                arr.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)),
                              )
                            }
                            placeholder="Етикет (Офис / Сервиз)"
                            className="text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setPhonesDraft((arr) => arr.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Премахни телефона"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPhonesDraft((arr) => [...arr, { phone: "", label: "" }])}
                        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-xs font-semibold transition-colors ${
                          detailKind === "client"
                            ? "border-brand-blue-300 text-brand-blue-700 hover:bg-brand-blue-50"
                            : "border-brand-orange-300 text-brand-orange-700 hover:bg-brand-orange-50"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" /> Добави още телефон
                      </button>
                    </div>

                    <label className="block">
                      <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Имейл</span>
                      <Input
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="office@example.com"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Адрес</span>
                      <Input
                        value={editForm.address}
                        onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                        placeholder={detailKind === "client" ? "напр. Смолян, ул. Беломорска 5" : "напр. София, бул. Брюксел 14"}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Бележки</span>
                      <Textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={4}
                        placeholder="Свободна форма за допълнителна информация (марки, работно време, лица за контакт и т.н.)"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void saveProfile()}
                        disabled={
                          savingProfile ||
                          editForm.fullName.trim().length < 2 ||
                          editForm.phone.trim().length < 3
                        }
                        className="inline-flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingProfile ? "Запис..." : "Запази промените"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          // Възстановяваме формата от детайла — отказваме промените.
                          setEditForm({
                            fullName: detail.full_name ?? "",
                            phone: detail.phone ?? "",
                            email: detail.email ?? "",
                            address: detail.address ?? "",
                            notes: detail.notes ?? "",
                          });
                          // Възстановяваме и draft-а на телефоните.
                          setPhonesDraft(
                            detailPhones
                              .filter((p) => !p.is_primary)
                              .map((p) => ({ phone: p.phone, label: p.label ?? "" })),
                          );
                          setEditingProfile(false);
                        }}
                        disabled={savingProfile}
                        className="inline-flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        Откажи
                      </Button>
                      <span className="text-[11px] text-slate-400 ml-auto">
                        Полета със * са задължителни.
                      </span>
                    </div>
                  </div>
                ) : (
                  // ── View mode: read-only карти ───────────────────────────────
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Основен телефон — винаги първи. */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Основен телефон</div>
                        <a href={`tel:${detail.phone}`} className={`text-sm font-medium ${detailTheme.accentText} mt-0.5 block hover:underline`}>{detail.phone || "—"}</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Имейл</div>
                        <div className="text-sm font-medium text-slate-900 mt-0.5 truncate">{detail.email || "—"}</div>
                      </div>
                    </div>

                    {/* Допълнителни телефони — read-only списък. Редакцията е по-долу. */}
                    {detailPhones.filter((p) => !p.is_primary).length > 0 && (
                      <div className="md:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> Допълнителни телефони
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {detailPhones
                            .filter((p) => !p.is_primary)
                            .map((p) => (
                              <a
                                key={p.id}
                                href={`tel:${p.phone}`}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors ${detailTheme.accentText}`}
                              >
                                <Phone className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold truncate">{p.phone}</div>
                                  {p.label && (
                                    <div className="text-[10px] text-slate-500 truncate">{p.label}</div>
                                  )}
                                </div>
                              </a>
                            ))}
                        </div>
                      </div>
                    )}

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
                )}
              </Card>

              <CollapsiblePanel
                title={`История на ${detailTheme.titleSingular === "доставчик" ? "доставчика" : "клиента"}`}
                subtitle={history.length ? `Записи: ${history.length}` : "Няма записи"}
                icon={<Activity className="w-4 h-4" />}
                open={showHistory}
                onToggle={() => setShowHistory((v) => !v)}
                accent={detailKind}
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.source === "inquiry" ? "bg-purple-50 text-purple-700" : "bg-brand-blue-50 text-brand-blue-700"}`}>
                              {r.source === "inquiry" ? "Запитване" : "Операция"}
                            </span>
                          </Td>
                          <Td className="font-medium text-slate-900">
                            {r.source === "inquiry" ? `Запитване${r.service_type ? ` — ${inquiryServiceTypeLabel(r.service_type)}` : ""}` : r.title}
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
                          {r.source === "inquiry" ? `Запитване${r.service_type ? ` — ${inquiryServiceTypeLabel(r.service_type)}` : ""}` : r.title}
                        </div>
                        {r.total_amount != null && (
                          <span className="font-black text-slate-900 text-sm shrink-0">€{Number(r.total_amount).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${r.source === "inquiry" ? "bg-purple-50 text-purple-700" : "bg-brand-blue-50 text-brand-blue-700"}`}>
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
                subtitle="Основният запис остава, а данните от дубликата се прехвърлят."
                icon={<Users className="w-4 h-4" />}
                open={showMerge}
                onToggle={() => setShowMerge((v) => !v)}
                accent={detailKind}
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
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-brand-blue-300 hover:bg-brand-blue-50 rounded-full text-sm font-medium text-slate-700 transition-colors"
                          title={`${s.samePhone ? "Съвпадение телефон " : ""}${s.sameEmail ? "Съвпадение имейл" : ""}`.trim()}
                        >
                          {s.row.full_name}
                          {s.samePhone && <span className="px-1.5 py-0.5 rounded-full bg-brand-blue-100 text-brand-blue-700 text-[10px] font-bold">телефон</span>}
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
  accent,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accent?: ContactKind;
}) {
  const accentBar = accent === "supplier"
    ? "border-l-4 border-l-brand-orange-400"
    : accent === "client"
      ? "border-l-4 border-l-brand-blue-400"
      : "";
  const iconColor = accent === "supplier"
    ? "text-brand-orange-600"
    : accent === "client"
      ? "text-brand-blue-600"
      : "text-slate-400";
  const headerHover = accent === "supplier"
    ? "hover:bg-brand-orange-50/60"
    : accent === "client"
      ? "hover:bg-brand-blue-50/60"
      : "hover:bg-slate-50";
  return (
    <Card className={`overflow-hidden ${accentBar}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-2.5 bg-white transition-colors ${headerHover} ${open ? "border-b border-slate-100" : ""}`}
      >
        <div className="flex items-center gap-2">
          {icon && <div className={`${iconColor} [&_svg]:w-3.5 [&_svg]:h-3.5`}>{icon}</div>}
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
