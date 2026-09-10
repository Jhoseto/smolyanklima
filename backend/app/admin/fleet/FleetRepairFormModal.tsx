"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { FLEET_MODAL_BACKDROP, FLEET_MODAL_PANEL } from "./fleetModalStyles";
import {
  AdminModalDragHandle,
  Button,
  Input,
  Textarea,
  useAdminBackHandler,
} from "../ui";

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
}

type CostMode = "breakdown" | "total";

export function FleetRepairFormModal({
  open,
  onClose,
  onSaved,
  vehicleId,
  defaultOdometer,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  vehicleId: string;
  defaultOdometer?: number;
}) {
  const [title, setTitle] = useState("");
  const [performedOn, setPerformedOn] = useState(todayIso());
  const [odometerKm, setOdometerKm] = useState("");
  const [partsDescription, setPartsDescription] = useState("");
  const [partsCostEur, setPartsCostEur] = useState("");
  const [laborCostEur, setLaborCostEur] = useState("");
  const [costEur, setCostEur] = useState("");
  const [costMode, setCostMode] = useState<CostMode>("breakdown");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useAdminBackHandler(open, onClose, "fleet-repair-form");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPerformedOn(todayIso());
    setOdometerKm(defaultOdometer != null ? String(defaultOdometer) : "");
    setPartsDescription("");
    setPartsCostEur("");
    setLaborCostEur("");
    setCostEur("");
    setCostMode("breakdown");
    setVendor("");
    setNotes("");
    setError(null);
  }, [open, defaultOdometer]);

  const computedTotal = useMemo(() => {
    if (costMode !== "breakdown") return null;
    const parts = partsCostEur.trim() ? Number(partsCostEur) : 0;
    const labor = laborCostEur.trim() ? Number(laborCostEur) : 0;
    if (!parts && !labor) return null;
    return parts + labor;
  }, [costMode, partsCostEur, laborCostEur]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload =
        costMode === "breakdown"
          ? {
              kind: "repair" as const,
              title: title.trim(),
              performedOn,
              odometerKm: odometerKm.trim() ? Number(odometerKm) : null,
              partsDescription: partsDescription.trim(),
              partsCostEur: partsCostEur.trim() ? Number(partsCostEur) : null,
              laborCostEur: laborCostEur.trim() ? Number(laborCostEur) : null,
              vendor: vendor.trim() || null,
              notes: notes.trim() || null,
              updateVehicleOdometer: true,
            }
          : {
              kind: "repair" as const,
              title: title.trim(),
              performedOn,
              odometerKm: odometerKm.trim() ? Number(odometerKm) : null,
              partsDescription: partsDescription.trim(),
              costEur: costEur.trim() ? Number(costEur) : null,
              vendor: vendor.trim() || null,
              notes: notes.trim() || null,
              updateVehicleOdometer: true,
            };

      const res = await fetch(`/api/admin/fleet/vehicles/${vehicleId}/maintenance`, {
        method: "POST",
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
          <h2 className="text-base font-bold text-slate-900">Ремонт</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 md:px-6 space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <p className="text-xs text-slate-500">
            Опишете какво е направено и кои части са закупени. Може разбивка части + труд или само обща сума.
          </p>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Какво е направено *</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Напр. Смяна на съединител" className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Части и материали *</span>
            <Textarea
              value={partsDescription}
              onChange={(e) => setPartsDescription(e.target.value)}
              required
              rows={3}
              placeholder="Закупени части, количества, доставчик…"
              className="mt-1"
            />
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
            <span className="text-xs font-semibold text-slate-600">Сервиз</span>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1" />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCostMode("breakdown")}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold ${costMode === "breakdown" ? "border-brand-blue-300 bg-brand-blue-50 text-brand-blue-800" : "border-slate-200 text-slate-600"}`}
            >
              Части + труд
            </button>
            <button
              type="button"
              onClick={() => setCostMode("total")}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-bold ${costMode === "total" ? "border-brand-blue-300 bg-brand-blue-50 text-brand-blue-800" : "border-slate-200 text-slate-600"}`}
            >
              Само обща сума
            </button>
          </div>

          {costMode === "breakdown" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Части (€)</span>
                <Input value={partsCostEur} onChange={(e) => setPartsCostEur(e.target.value)} inputMode="decimal" className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Труд (€)</span>
                <Input value={laborCostEur} onChange={(e) => setLaborCostEur(e.target.value)} inputMode="decimal" className="mt-1" />
              </label>
              {computedTotal != null && (
                <div className="col-span-2 text-sm font-semibold text-slate-700 tabular-nums">
                  Общо: €{computedTotal.toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
          ) : (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Обща сума (€) *</span>
              <Input value={costEur} onChange={(e) => setCostEur(e.target.value)} inputMode="decimal" required className="mt-1" />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Допълнителни бележки</span>
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
