"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Textarea } from "./ui";
import { UserPlus, X, Loader2, ChevronDown } from "lucide-react";
import { assertNoContactPrimaryPhoneDuplicate } from "@/lib/admin/contactPhoneConflictClient";

export type ContactPersonPatch = {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  contactId?: string;
};

type CrmContact = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  address?: string | null;
};

type Props = {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  contactId: string;
  onPatch: (patch: ContactPersonPatch) => void;
  readOnly?: boolean;
  instanceId: string;
  /** По-голямо поле с рамка — календар / бързо събитие */
  variant?: "standard" | "planner";
};

export function ContactPersonPicker({
  customerName,
  customerPhone,
  customerAddress,
  contactId,
  onPatch,
  readOnly = false,
  instanceId,
  variant = "standard",
}: Props) {
  const planner = variant === "planner";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CrmContact[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newErr, setNewErr] = useState<string | null>(null);
  const [newBusy, setNewBusy] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const applyingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const fetchContacts = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ perPage: "20", page: "1" });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/contacts?${params}`, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { data?: CrmContact[]; error?: string };
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      setSuggestions(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncDropdownPos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 240);
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    setDropdownPos({ top: r.bottom + 6, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open || readOnly) {
      setDropdownPos(null);
      return;
    }
    syncDropdownPos();
  }, [open, readOnly, syncDropdownPos]);

  useEffect(() => {
    if (!open || readOnly) return;
    const ro = typeof ResizeObserver !== "undefined" && wrapRef.current
      ? new ResizeObserver(() => syncDropdownPos())
      : null;
    if (wrapRef.current && ro) ro.observe(wrapRef.current);
    window.addEventListener("scroll", syncDropdownPos, true);
    window.addEventListener("resize", syncDropdownPos);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", syncDropdownPos, true);
      window.removeEventListener("resize", syncDropdownPos);
    };
  }, [open, readOnly, syncDropdownPos]);

  useEffect(() => {
    if (!open || readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchContacts(customerName);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [customerName, open, readOnly, fetchContacts]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function applyContact(c: CrmContact) {
    applyingRef.current = true;
    onPatch({
      contactId: c.id,
      customerName: (c.full_name ?? "").trim(),
      customerPhone: (c.phone ?? "").trim(),
      customerAddress: (c.address ?? "").trim(),
    });
    queueMicrotask(() => {
      applyingRef.current = false;
    });
    setOpen(false);
  }

  function onNameChange(v: string) {
    if (applyingRef.current) {
      onPatch({ customerName: v });
      return;
    }
    onPatch({ customerName: v, contactId: "" });
  }

  function openPicker() {
    setOpen(true);
    queueMicrotask(() => syncDropdownPos());
    void fetchContacts(customerName);
  }

  function openNewModal() {
    setNewErr(null);
    setNewFullName(customerName.trim() || "");
    setNewPhone(customerPhone.trim() || "");
    setNewEmail("");
    setNewAddress(customerAddress.trim() || "");
    setNewNotes("");
    setModalOpen(true);
    setOpen(false);
  }

  async function submitNewContact() {
    setNewErr(null);
    const fn = newFullName.trim();
    const ph = newPhone.trim();
    if (fn.length < 2) {
      setNewErr("Въведете име (минимум 2 знака).");
      return;
    }
    if (ph.length < 3) {
      setNewErr("Въведете телефон (минимум 3 знака).");
      return;
    }
    setNewBusy(true);
    try {
      await assertNoContactPrimaryPhoneDuplicate(ph);

      const res = await fetch("/api/admin/contacts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fn,
          phone: ph,
          email: newEmail.trim() || null,
          address: newAddress.trim() || null,
          notes: newNotes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: CrmContact; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Грешка при запис");
      const row = json.data;
      if (!row?.id) throw new Error("Невалиден отговор от сървъра");
      applyContact({
        id: row.id,
        full_name: row.full_name ?? fn,
        phone: row.phone ?? ph,
        address: row.address ?? (newAddress.trim() || null),
      });
      setModalOpen(false);
    } catch (e) {
      setNewErr(e instanceof Error ? e.message : "Грешка");
    } finally {
      setNewBusy(false);
    }
  }

  if (readOnly) {
    return (
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-slate-600">Контактно лице</span>
        <Input value={customerName} readOnly disabled className="bg-slate-50" />
      </label>
    );
  }

  const inputId = `contact-name-${instanceId}`;
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  const dropdown =
    open && portalTarget && dropdownPos
      ? createPortal(
          <div
            id={`${inputId}-listbox`}
            ref={panelRef}
            role="listbox"
            aria-label="Контакти"
            className="fixed z-[9990] max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Контакти</span>
              <button
                type="button"
                className="text-[11px] font-semibold text-brand-blue-700 hover:underline"
                onClick={openNewModal}
              >
                + Нов контакт
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500">
                Няма намерени контакти. Ползвайте „+ Нов контакт“ или търсете по име / телефон.
              </div>
            ) : (
              <ul className="py-1">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-brand-blue-50 border-b border-slate-50 last:border-0"
                      onClick={() => applyContact(c)}
                    >
                      <div className="font-semibold text-slate-900 truncate">{c.full_name ?? "—"}</div>
                      <div className="text-slate-500 truncate mt-0.5">
                        {[c.phone, c.email].filter(Boolean).join(" · ")}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          portalTarget,
        )
      : null;

  return (
    <>
      <label
        className={
          planner
            ? "grid gap-2 rounded-xl border-2 border-brand-blue-500 bg-gradient-to-b from-brand-blue-50 to-white p-3 shadow-md ring-2 ring-brand-blue-200/60"
            : "grid gap-1.5"
        }
        htmlFor={inputId}
      >
        <span
          className={
            planner
              ? "flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wide text-brand-blue-900"
              : "flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600"
          }
        >
          <span className="flex flex-wrap items-center gap-2">
            {planner ? "Контакт от CRM" : "Контактно лице"}
            {contactId ? (
              <span className="inline-flex items-center justify-center leading-none min-h-[20px] rounded-full bg-brand-blue-100 text-brand-blue-700 border border-brand-blue-200 px-2 py-0.5 text-[10px] font-bold normal-case">
                избран
              </span>
            ) : planner ? (
              <span className="inline-flex items-center justify-center leading-none min-h-[20px] rounded-full bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-[10px] font-bold normal-case">
                задължително
              </span>
            ) : null}
          </span>
          {planner && (
            <span className="max-w-[min(100%,18rem)] text-[10px] font-semibold normal-case leading-tight text-brand-blue-700/90">
              ▼ списък · + нов · пишете за търсене
            </span>
          )}
        </span>
        <div
          ref={wrapRef}
          className={
            planner
              ? "relative flex gap-0 overflow-hidden rounded-lg border border-brand-blue-200 bg-white shadow-inner"
              : "relative flex gap-0"
          }
        >
          <Input
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${inputId}-listbox`}
            autoComplete="off"
            value={customerName}
            onChange={(e) => onNameChange(e.target.value)}
            onPointerDown={() => {
              openPicker();
            }}
            onFocus={() => {
              openPicker();
            }}
            placeholder={planner ? "Започнете да пишете име или телефон…" : "Търсене по име или телефон…"}
            className={
              planner
                ? "min-h-11 flex-1 min-w-0 border-0 py-2.5 pl-3 pr-[4.5rem] text-sm font-medium shadow-none focus:ring-0"
                : "min-w-0 flex-1 pr-[4.25rem]"
            }
          />
          <button
            type="button"
            className={
              planner
                ? "absolute right-[2.35rem] top-1/2 z-[2] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-brand-blue-200 bg-brand-blue-100 text-brand-blue-700 hover:bg-brand-blue-200"
                : "absolute right-[2.25rem] top-1/2 z-[2] -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }
            title="Списък контакти"
            aria-label="Отвори списък с контакти от CRM"
            aria-expanded={open}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (open) setOpen(false);
              else openPicker();
            }}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            className={
              planner
                ? "absolute right-1 top-1/2 z-[2] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "absolute right-1.5 top-1/2 z-[2] -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }
            title="Нов контакт"
            aria-label="Нов CRM контакт"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openNewModal();
            }}
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </label>

      {dropdown}

      {modalOpen && portalTarget
        ? createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => !newBusy && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Нов CRM контакт</h3>
              <button
                type="button"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                onClick={() => !newBusy && setModalOpen(false)}
                aria-label="Затвори"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[min(70vh,520px)] overflow-y-auto">
              {newErr && (
                <div className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {newErr}
                </div>
              )}
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Име и фамилия *</span>
                <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Телефон *</span>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Имейл</span>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Адрес</span>
                <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Бележки</span>
                <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} className="min-h-[3rem]" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 bg-slate-50">
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} disabled={newBusy}>
                Отказ
              </Button>
              <Button variant="primary" type="button" onClick={() => void submitNewContact()} disabled={newBusy}>
                {newBusy ? "Запис…" : "Създай и избери"}
              </Button>
            </div>
          </div>
        </div>,
        portalTarget,
      )
        : null}
    </>
  );
}
