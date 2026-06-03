"use client";

import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import {
  isEmailFieldLabel,
  isPhoneFieldLabel,
  toMailtoHref,
  toTelHref,
} from "@/lib/admin/telLink";

type AdminPhoneLinkProps = {
  phone: string | null | undefined;
  className?: string;
  showIcon?: boolean;
  stopPropagation?: boolean;
  children?: ReactNode;
};

/** Кликваем телефон — отваря набиране на устройството (`tel:`). */
export function AdminPhoneLink({
  phone,
  className = "",
  showIcon = true,
  stopPropagation = false,
  children,
}: AdminPhoneLinkProps) {
  const dialSource = String(phone ?? "").trim();
  const display = children ?? dialSource;
  if (!display) return <span className={className}>—</span>;

  const href = toTelHref(dialSource || (typeof display === "string" ? display : ""));
  if (!href) {
    return <span className={className}>{display}</span>;
  }

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 font-semibold text-brand-blue-600 underline-offset-2 hover:underline active:opacity-80 ${className}`}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {showIcon ? <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      <span>{display}</span>
    </a>
  );
}

/** Стойност в поле с етикет — автоматично tel:/mailto: при „Телефон“ / „Имейл“. */
export function AdminFieldValue({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const v = value.trim();
  if (!v || v === "—") {
    return <span className={className}>—</span>;
  }
  if (isPhoneFieldLabel(label)) {
    return <AdminPhoneLink phone={v} className={className} showIcon={false} />;
  }
  const mailto = isEmailFieldLabel(label) ? toMailtoHref(v) : null;
  if (mailto) {
    return (
      <a
        href={mailto}
        className={`font-semibold text-brand-blue-600 underline-offset-2 hover:underline active:opacity-80 ${className}`}
      >
        {v}
      </a>
    );
  }
  return <span className={className}>{value}</span>;
}

/** Ред „име · телефон“ с кликваем номер (списъци, карти, meta). */
export function AdminContactMetaLine({
  name,
  phone,
  className = "",
  phoneStopPropagation = false,
}: {
  name?: string | null;
  phone?: string | null;
  className?: string;
  phoneStopPropagation?: boolean;
}) {
  const n = name?.trim();
  const p = phone?.trim();
  if (!n && !p) return null;

  return (
    <span className={className}>
      {n ? <span>{n}</span> : null}
      {n && p ? <span className="text-slate-400"> · </span> : null}
      {p ? (
        <AdminPhoneLink
          phone={p}
          showIcon={false}
          stopPropagation={phoneStopPropagation}
          className="text-inherit font-medium"
        />
      ) : null}
    </span>
  );
}

/** Ред при избор на контакт — име (избор) + отделен кликваем телефон (извън бутона). */
export function AdminContactSuggestRow({
  name,
  phone,
  email,
  onSelect,
  className = "",
}: {
  name: string;
  phone?: string | null;
  email?: string | null;
  onSelect: () => void;
  className?: string;
}) {
  const p = phone?.trim();
  const e = email?.trim();
  const mailto = e ? toMailtoHref(e) : null;

  return (
    <div className={`rounded-lg p-2 transition-colors hover:bg-slate-50 ${className}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="text-sm font-bold text-slate-900">{name}</div>
        </button>
        {p ? (
          <AdminPhoneLink phone={p} className="shrink-0 self-center text-xs" showIcon stopPropagation />
        ) : null}
      </div>
      {(p || e) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {p ? <AdminPhoneLink phone={p} showIcon={false} className="text-xs font-normal text-slate-500" /> : null}
          {p && e ? <span>/</span> : null}
          {e && mailto ? (
            <a href={mailto} className="font-medium text-brand-blue-600 hover:underline" onClick={(ev) => ev.stopPropagation()}>
              {e}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Info box с етикет + стойност (модали, детайли). */
export function AdminLabeledBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">
        <AdminFieldValue label={label} value={value} />
      </div>
    </div>
  );
}
