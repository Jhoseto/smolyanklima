"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { FLEET_MODAL_BACKDROP, FLEET_MODAL_PANEL } from "./fleetModalStyles";
import {
  AdminModalDragHandle,
  Button,
  Input,
  Select,
  Textarea,
  useAdminBackHandler,
} from "../ui";
import { fleetComplianceKindLabel, type FleetComplianceKind } from "@/lib/admin/fleetTypes";

export type FleetComplianceFormValues = {
  kind: FleetComplianceKind;
  validFrom: string;
  expiresOn: string;
  provider: string;
  referenceNumber: string;
  costEur: string;
  notes: string;
};

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
}

const DEFAULT_COMPLIANCE_KINDS: FleetComplianceKind[] = [
  "vignette",
  "civil_liability",
  "technical_inspection",
  "kasko",
];

const emptyForm = (kind: FleetComplianceKind = "vignette"): FleetComplianceFormValues => ({
  kind,
  validFrom: todayIso(),
  expiresOn: addDaysIso(365),
  provider: "",
  referenceNumber: "",
  costEur: "",
  notes: "",
});

export function FleetComplianceFormModal({
  open,
  onClose,
  onSaved,
  vehicleId,
  initial,
  allowedKinds,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  vehicleId: string;
  initial?: Partial<FleetComplianceFormValues>;
  allowedKinds?: FleetComplianceKind[];
}) {
  const kinds = allowedKinds ?? DEFAULT_COMPLIANCE_KINDS;
  const [form, setForm] = useState<FleetComplianceFormValues>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useAdminBackHandler(open, onClose, "fleet-compliance-form");

  useEffect(() => {
    if (!open) return;
    const kind = (initial?.kind ?? allowedKinds?.[0] ?? DEFAULT_COMPLIANCE_KINDS[0]) as FleetComplianceKind;
    setForm({
      ...emptyForm(kind),
      kind,
      provider: initial?.provider ?? "",
      referenceNumber: initial?.referenceNumber ?? "",
      validFrom: initial?.validFrom ?? todayIso(),
      expiresOn: initial?.expiresOn ?? addDaysIso(365),
      costEur: initial?.costEur ?? "",
      notes: initial?.notes ?? "",
    });
    setError(null);
  }, [open, initial?.kind, initial?.provider, initial?.referenceNumber, initial?.validFrom, initial?.expiresOn, initial?.costEur, initial?.notes]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/fleet/vehicles/${vehicleId}/compliance`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: form.kind,
          validFrom: form.validFrom || null,
          expiresOn: form.expiresOn,
          provider: form.provider.trim() || null,
          referenceNumber: form.referenceNumber.trim() || null,
          costEur: form.costEur.trim() ? Number(form.costEur) : null,
          notes: form.notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при запис");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={FLEET_MODAL_BACKDROP} data-admin-overlay="true">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className={`${FLEET_MODAL_PANEL} max-w-md`}>
        <AdminModalDragHandle />
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 md:px-6">
          <h2 className="text-base font-bold text-slate-900">Подновяване — {fleetComplianceKindLabel(form.kind)}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 md:px-6 space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Тип</span>
            <Select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as FleetComplianceKind }))}
              className="mt-1"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>{fleetComplianceKindLabel(k)}</option>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">От дата</span>
              <Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Изтича на *</span>
              <Input type="date" value={form.expiresOn} onChange={(e) => setForm((f) => ({ ...f, expiresOn: e.target.value }))} required className="mt-1" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Доставчик / застраховател</span>
            <Input value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">№ полица / фактура</span>
            <Input value={form.referenceNumber} onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Разход (€)</span>
            <Input value={form.costEur} onChange={(e) => setForm((f) => ({ ...f, costEur: e.target.value }))} inputMode="decimal" className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Бележки</span>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting} className="flex-1">Отказ</Button>
            <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Запис…" : "Запази"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
