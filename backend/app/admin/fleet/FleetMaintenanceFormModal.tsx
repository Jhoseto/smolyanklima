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
import {
  FLEET_SERVICE_KINDS,
  fleetMaintenanceKindLabel,
  type FleetServiceKind,
} from "@/lib/admin/fleetTypes";

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
}

export function FleetMaintenanceFormModal({
  open,
  onClose,
  onSaved,
  vehicleId,
  defaultKind = "scheduled_service",
  defaultOdometer,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  vehicleId: string;
  defaultKind?: FleetServiceKind;
  defaultOdometer?: number;
}) {
  const [kind, setKind] = useState<FleetServiceKind>(defaultKind);
  const [performedOn, setPerformedOn] = useState(todayIso());
  const [odometerKm, setOdometerKm] = useState("");
  const [costEur, setCostEur] = useState("");
  const [vendor, setVendor] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [nextDueKm, setNextDueKm] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useAdminBackHandler(open, onClose, "fleet-maintenance-form");

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind);
    setPerformedOn(todayIso());
    setOdometerKm(defaultOdometer != null ? String(defaultOdometer) : "");
    setCostEur("");
    setVendor("");
    setNextDueDate("");
    setNextDueKm("");
    setNotes("");
    setError(null);
  }, [open, defaultKind, defaultOdometer]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/fleet/vehicles/${vehicleId}/maintenance`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          performedOn,
          odometerKm: odometerKm.trim() ? Number(odometerKm) : null,
          costEur: costEur.trim() ? Number(costEur) : null,
          vendor: vendor.trim() || null,
          nextDueDate: nextDueDate || null,
          nextDueKm: nextDueKm.trim() ? Number(nextDueKm) : null,
          notes: notes.trim() || null,
          updateVehicleOdometer: true,
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
          <h2 className="text-base font-bold text-slate-900">Поддръжка</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 md:px-6 space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <p className="text-xs text-slate-500">
            Редовна поддръжка: масло, филтри, гуми, консумативи и периодичен сервиз.
          </p>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Вид *</span>
            <Select value={kind} onChange={(e) => setKind(e.target.value as FleetServiceKind)} className="mt-1">
              {FLEET_SERVICE_KINDS.map((k) => (
                <option key={k} value={k}>{fleetMaintenanceKindLabel(k)}</option>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Дата *</span>
              <Input type="date" value={performedOn} onChange={(e) => setPerformedOn(e.target.value)} required className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Пробег (km)</span>
              <Input value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} inputMode="numeric" className="mt-1" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Сервиз / доставчик</span>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Разход (€)</span>
            <Input value={costEur} onChange={(e) => setCostEur(e.target.value)} inputMode="decimal" className="mt-1" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Следваща дата</span>
              <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Следващ km</span>
              <Input value={nextDueKm} onChange={(e) => setNextDueKm(e.target.value)} inputMode="numeric" className="mt-1" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Бележки</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1" />
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
