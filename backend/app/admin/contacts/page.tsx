"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Input, Select, Textarea, Button, Table, Th, Td } from "../ui";
import { ChevronDown, ChevronUp, UserPlus, Users, Activity, FileText, Phone, Mail, MapPin, X, Truck, Plus, Trash2, Save, Pencil, Package } from "lucide-react";
import { ProductQuickViewButton } from "../ProductQuickView";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { assertNoContactPrimaryPhoneDuplicate } from "@/lib/admin/contactPhoneConflictClient";
import { inquiryServiceTypeLabel } from "@/lib/inquiry/serviceTypeLabels";
import { ContactsNewModal, type NewContactForm } from "./ContactsNewModal";
import { ContactsListColumn } from "./ContactsListColumn";

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

type ContactLinkedProductRow = {
  id: string;
  kind: "product" | "accessory";
  name: string;
  slug: string | null;
  price: number | null;
  purchase_price: number | null;
  stock_status: string | null;
  purchased_at: string | null;
};

function fmtEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${Number(n).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

import { canonicalPhoneDigits, phoneDigitsOnly } from "@/lib/admin/phoneSearchPattern";

function normalizeEmail(input: string | null | undefined): string {
  return String(input ?? "").trim().toLowerCase();
}

function highlightMatch(text: string, query: string): ReactNode {
  const raw = text || "—";
  const q = query.trim();
  if (!q || raw === "—") return raw;
  const lower = raw.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx >= 0) {
    return (
      <>
        {raw.slice(0, idx)}
        <mark className="bg-yellow-200/90 text-slate-900 rounded px-0.5 not-italic">{raw.slice(idx, idx + q.length)}</mark>
        {raw.slice(idx + q.length)}
      </>
    );
  }

  const qDigits = phoneDigitsOnly(q);
  if (qDigits.length >= 3) {
    const rawDigits = phoneDigitsOnly(raw);
    const qCanon = canonicalPhoneDigits(q);
    const rawCanon = canonicalPhoneDigits(raw);
    const phoneMatch =
      (qCanon.length >= 3 && rawCanon.includes(qCanon)) ||
      (qDigits.length >= 3 && rawDigits.includes(qDigits));
    if (phoneMatch) {
      return <mark className="bg-yellow-200/90 text-slate-900 rounded px-0.5 not-italic">{raw}</mark>;
    }
  }

  return raw;
}

function emptyNewContactForm(kind: ContactKind): NewContactForm {
  return {
    fullName: "",
    phone: "",
    additionalPhones: [],
    email: "",
    address: "",
    notes: "",
    contactKind: kind,
    customerStatus: "new",
    nextFollowUpAt: "",
  };
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
  const [linkedProducts, setLinkedProducts] = useState<ContactLinkedProductRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newForm, setNewForm] = useState<NewContactForm>(() => emptyNewContactForm(initialKind));
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [showLinkedProducts, setShowLinkedProducts] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [contactsTotal, setContactsTotal] = useState(0);
  const CONTACTS_FETCH_LIMIT = 5000;

  const debouncedQ = useDebounce(q, 200);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    sp.set("kind", contactsTab);
    sp.set("perPage", String(CONTACTS_FETCH_LIMIT));
    sp.set("page", "1");
    return sp.toString();
  }, [debouncedQ, contactsTab]);

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
      if (selected && rows.some((r) => r.id === selected)) {
        // keep current selection
      } else if (rows[0]?.id) {
        setSelected(rows[0].id);
      } else {
        setSelected("");
        setDetail(null);
      }
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
      setLinkedProducts((json.data?.linkedProducts ?? []) as ContactLinkedProductRow[]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    setNewForm((f) => ({ ...f, contactKind: contactsTab }));
  }, [contactsTab]);

  useEffect(() => {
    setSelected("");
    setQ("");
    setMobileView("list");
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
    const currentPhone = canonicalPhoneDigits(detail.phone);
    const currentEmail = normalizeEmail(detail.email);
    return items
      .filter((c) => c.id !== detail.id)
      .map((c) => {
        const samePhone = !!currentPhone && canonicalPhoneDigits(c.phone) === currentPhone;
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
      setNewForm(emptyNewContactForm(contactsTab));
      setShowNewContactModal(false);
      await loadList();
      if (id) {
        setSelected(id);
        setMobileView("detail");
      }
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

  async function deleteSelectedContact() {
    if (!selected || !detail) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contacts/${selected}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при изтриване");
      setConfirmDelete(false);
      setEditingProfile(false);
      setSelected("");
      setDetail(null);
      setHistory([]);
      setLinkedProducts([]);
      setDetailPhones([]);
      setMobileView("list");
      await loadList();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setDeleting(false);
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className={`flex rounded-xl border ${theme.accentBorderSoft} p-0.5 bg-white w-full sm:w-auto sm:min-w-[300px] shadow-sm`}>
          <button
            type="button"
            onClick={() => setContactsTab("client")}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${
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
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${
              contactsTab === "supplier"
                ? "bg-brand-orange-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-brand-orange-50 hover:text-brand-orange-700"
            }`}
          >
            <Truck className="w-3.5 h-3.5" /> Доставчици
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowNewContactModal(true)}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-colors shrink-0 ${
            contactsTab === "client"
              ? "bg-brand-blue-500 hover:bg-brand-blue-600 active:bg-brand-blue-700"
              : "bg-brand-orange-500 hover:bg-brand-orange-600 active:bg-brand-orange-700"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Нов {theme.titleSingular}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr] gap-4 items-start">
        <ContactsListColumn
          kind={contactsTab}
          theme={theme}
          q={q}
          debouncedQ={debouncedQ}
          loading={loading}
          items={items}
          selected={selected}
          contactsTotal={contactsTotal}
          mobileHidden={mobileView === "detail"}
          highlight={highlightMatch}
          onQueryChange={setQ}
          onSelect={(id) => {
            setSelected(id);
            setMobileView("detail");
          }}
          onNewContact={() => setShowNewContactModal(true)}
        />

        {/* Right column: detail — on mobile hidden when in list view */}
        <div className={`space-y-2 ${mobileView === "list" ? "hidden lg:block" : "block"}`}>
          {!detail ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center text-slate-500 border-dashed">
              <TabIcon className={`w-12 h-12 mb-4 ${theme.avatarText} opacity-50`} />
              <p className="text-lg font-medium text-slate-600">Избери {theme.titleSingular} от списъка вляво</p>
              <p className="text-sm mt-1">или търси по име / телефон — резултатите се обновяват на живо</p>
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
                  {/* Десктоп: бутони за редакция и изтриване в header. */}
                  {!editingProfile && (
                    <div className="hidden lg:flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingProfile(true)}
                        className="inline-flex items-center gap-1.5"
                        title="Редактирай профила"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Редактирай
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1.5"
                        title="Изтрий контакта"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Изтрий
                      </Button>
                    </div>
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
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center active:bg-red-100 transition-colors"
                          title="Изтрий контакта"
                        >
                          <Trash2 className="w-4 h-4" />
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
                        placeholder="напр. 0888 58 58 16"
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
                title="Обвързани продукти"
                subtitle={
                  linkedProducts.length
                    ? `${linkedProducts.length} артикул${linkedProducts.length === 1 ? "" : "а"} · цени в EUR`
                    : "Няма свързани артикули"
                }
                icon={<Package className="w-4 h-4" />}
                open={showLinkedProducts}
                onToggle={() => setShowLinkedProducts((v) => !v)}
                accent={detailKind}
              >
                {linkedProducts.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    {detailKind === "supplier"
                      ? "Няма продукти или аксесоари с този доставчик."
                      : "Няма продажби или операции с каталожен продукт за този клиент."}
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <Table>
                        <thead>
                          <tr>
                            <Th>Име</Th>
                            <Th>Тип</Th>
                            <Th>Продажна</Th>
                            <Th>Закупна</Th>
                            <Th>Наличност</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkedProducts.map((p) => (
                            <tr key={`${p.kind}:${p.id}`} className="hover:bg-slate-50 transition-colors">
                              <Td className="font-medium text-slate-900">
                                {p.kind === "product" ? (
                                  <ProductQuickViewButton productId={p.id} productName={p.name} />
                                ) : (
                                  p.name
                                )}
                              </Td>
                              <Td>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                  {p.kind === "product" ? "Климатик" : "Аксесоар"}
                                </span>
                              </Td>
                              <Td className="font-semibold tabular-nums">{fmtEuro(p.price)}</Td>
                              <Td className="font-semibold tabular-nums text-slate-700">{fmtEuro(p.purchase_price)}</Td>
                              <Td className="text-xs text-slate-600">{p.stock_status ?? "—"}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {linkedProducts.map((p) => (
                        <div key={`${p.kind}:${p.id}`} className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="font-semibold text-slate-900 text-sm leading-snug mb-1">
                            {p.kind === "product" ? (
                              <ProductQuickViewButton productId={p.id} productName={p.name} />
                            ) : (
                              p.name
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-slate-500">{p.kind === "product" ? "Климатик" : "Аксесоар"}</span>
                            <span className="font-black text-slate-900 tabular-nums">{fmtEuro(p.price)}</span>
                          </div>
                          {p.purchase_price != null && (
                            <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                              Закупна: {fmtEuro(p.purchase_price)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CollapsiblePanel>

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
                          <Td className="font-semibold tabular-nums">
                            {r.total_amount != null ? fmtEuro(r.total_amount) : "—"}
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
                          <span className="font-black text-slate-900 text-sm shrink-0 tabular-nums">{fmtEuro(r.total_amount)}</span>
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
                overflowVisible
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
                
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-200 overflow-visible">
                  <div className={`relative flex-1 w-full ${mergeResults.length > 0 ? "z-50" : ""}`}>
                    <Input
                      value={mergeQuery}
                      onChange={(e) => {
                        setMergeQuery(e.target.value);
                        setMergeSourceId("");
                      }}
                      placeholder="Търси дублиран контакт..."
                    />
                    {mergeResults.length > 0 && (
                      <div className="absolute left-0 right-0 bottom-[calc(100%+4px)] z-50 border border-slate-200 rounded-xl bg-white shadow-lg max-h-48 overflow-y-auto p-1">
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

      <ContactsNewModal
        open={showNewContactModal}
        kind={contactsTab}
        theme={theme}
        form={newForm}
        creating={creating}
        onChange={setNewForm}
        onClose={() => {
          setShowNewContactModal(false);
          setNewForm(emptyNewContactForm(contactsTab));
        }}
        onSubmit={() => void createContact()}
      />

      {confirmMerge && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 p-0 md:p-4 backdrop-blur-md"
          onClick={() => setConfirmMerge(false)}
        >
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl border border-white/70 bg-white p-5 md:p-6 shadow-[0_30px_90px_rgba(15,23,42,0.35)] pb-safe md:pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pb-2 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="text-lg md:text-xl font-black text-slate-950">Сливане на дубликат</div>
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

      {confirmDelete && detail && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 p-0 md:p-4 backdrop-blur-md"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl border border-white/70 bg-white p-5 md:p-6 shadow-[0_30px_90px_rgba(15,23,42,0.35)] pb-safe md:pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pb-2 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="text-lg md:text-xl font-black text-slate-950">Изтриване на контакт</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">
              Сигурни ли сте, че искате да изтриете <strong className="text-slate-800">{detail.full_name}</strong>?
              Действието е необратимо. Свързаните операции остават в историята, но вече няма да са обвързани с този контакт.
              {detailKind === "supplier" && " Продуктите и аксесоарите с този доставчик ще останат без доставчик."}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Отказ</Button>
              <Button variant="danger" onClick={() => void deleteSelectedContact()} disabled={deleting}>
                {deleting ? "Изтриване..." : "Изтрий окончателно"}
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
  overflowVisible = false,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accent?: ContactKind;
  /** Позволява autocomplete/dropdown извън картата (без clip). */
  overflowVisible?: boolean;
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
    <Card className={`${accentBar} ${overflowVisible && open ? "overflow-visible relative z-20" : "overflow-hidden"}`}>
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
      {open && <div className={`p-2.5 bg-white ${overflowVisible ? "overflow-visible" : ""}`}>{children}</div>}
    </Card>
  );
}
