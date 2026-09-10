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
  fleetFuelTypeLabel,
  fleetVehicleStatusLabel,
  type FleetFuelType,
  type FleetVehicleStatus,
} from "@/lib/admin/fleetTypes";

export type FleetVehicleFormValues = {
  registrationNumber: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  fuelType: FleetFuelType;
  odometerKm: string;
  status: FleetVehicleStatus;
  assignedAdminUserId: string;
  notes: string;
};

type StaffOption = { id: string; name: string };

const emptyForm = (): FleetVehicleFormValues => ({
  registrationNumber: "",
  make: "",
  model: "",
  year: "",
  vin: "",
  fuelType: "diesel",
  odometerKm: "0",
  status: "active",
  assignedAdminUserId: "",
  notes: "",
});

export function FleetVehicleFormModal({
  open,
  onClose,
  onSaved,
  initial,
  vehicleId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<FleetVehicleFormValues>;
  vehicleId?: string;
}) {
  const [form, setForm] = useState<FleetVehicleFormValues>(emptyForm());
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useAdminBackHandler(open, onClose, "fleet-vehicle-form");

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm(),
      registrationNumber: initial?.registrationNumber ?? "",
      make: initial?.make ?? "",
      model: initial?.model ?? "",
      year: initial?.year ?? "",
      vin: initial?.vin ?? "",
      fuelType: initial?.fuelType ?? "diesel",
      odometerKm: initial?.odometerKm ?? "0",
      status: initial?.status ?? "active",
      assignedAdminUserId: initial?.assignedAdminUserId ?? "",
      notes: initial?.notes ?? "",
    });
    setError(null);
    // Reset only when the modal opens (or another vehicle is edited), not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicleId]);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/admin/staff", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const list = ((j as { staff?: StaffOption[] }).staff ?? []).filter(
          (s) => s.name?.trim(),
        );
        setStaff(list);
      })
      .catch(() => setStaff([]));
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        registrationNumber: form.registrationNumber.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year.trim() ? Number(form.year) : null,
        vin: form.vin.trim() || null,
        fuelType: form.fuelType,
        odometerKm: Number(form.odometerKm) || 0,
        status: form.status,
        assignedAdminUserId: form.assignedAdminUserId || null,
        notes: form.notes.trim() || null,
      };

      const url = vehicleId ? `/api/admin/fleet/vehicles/${vehicleId}` : "/api/admin/fleet/vehicles";
      const res = await fetch(url, {
        method: vehicleId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      <div className={`${FLEET_MODAL_PANEL} max-w-lg`}>
        <AdminModalDragHandle />
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 md:px-6">
          <h2 className="text-base font-bold text-slate-900">{vehicleId ? "Редакция на МПС" : "Ново МПС"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 md:px-6 space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Рег. номер *</span>
              <Input
                value={form.registrationNumber}
                onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))}
                required
                className="font-mono mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Марка *</span>
              <Input value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} required className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Модел *</span>
              <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} required className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Година</span>
              <Input value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} inputMode="numeric" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Пробег (km)</span>
              <Input value={form.odometerKm} onChange={(e) => setForm((f) => ({ ...f, odometerKm: e.target.value }))} inputMode="numeric" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Гориво</span>
              <Select value={form.fuelType} onChange={(e) => setForm((f) => ({ ...f, fuelType: e.target.value as FleetFuelType }))} className="mt-1">
                {(["petrol", "diesel", "lpg", "electric", "hybrid"] as FleetFuelType[]).map((f) => (
                  <option key={f} value={f}>{fleetFuelTypeLabel(f)}</option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Статус</span>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FleetVehicleStatus }))} className="mt-1">
                {(["active", "inactive", "sold"] as FleetVehicleStatus[]).map((s) => (
                  <option key={s} value={s}>{fleetVehicleStatusLabel(s)}</option>
                ))}
              </Select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">VIN</span>
              <Input value={form.vin} onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))} className="mt-1 font-mono text-sm" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Отговорник</span>
              <Select
                value={form.assignedAdminUserId}
                onChange={(e) => setForm((f) => ({ ...f, assignedAdminUserId: e.target.value }))}
                className="mt-1"
              >
                <option value="">— без —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Бележки</span>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="mt-1" />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting} className="flex-1">
              Отказ
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Запис…" : "Запази"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
