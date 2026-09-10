"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { Button, useAdminBackHandler } from "../ui";
import { FleetStatusDot } from "./FleetStatusDot";
import { FleetComplianceFormModal } from "./FleetComplianceFormModal";
import { FleetMaintenanceFormModal } from "./FleetMaintenanceFormModal";
import { FleetRepairFormModal } from "./FleetRepairFormModal";
import { FleetVehicleFormModal } from "./FleetVehicleFormModal";
import {
  FLEET_ALL_COMPLIANCE_KINDS,
  FLEET_CORE_COMPLIANCE_KINDS,
  fleetComplianceKindLabel,
  fleetFuelTypeLabel,
  fleetMaintenanceKindLabel,
  fleetAssignedAdminName,
  fleetVehicleStatusLabel,
  isFleetRepairKind,
  type FleetComplianceKind,
  type FleetComplianceRecordRow,
  type FleetMaintenanceEventRow,
  type FleetVehicleListRow,
} from "@/lib/admin/fleetTypes";
import { fleetComplianceLevelClass, fleetComplianceLevelLabel } from "@/lib/admin/fleetComplianceStatus";

type DetailPayload = {
  vehicle: FleetVehicleListRow;
  compliance: FleetComplianceRecordRow[];
  maintenance: FleetMaintenanceEventRow[];
  year_costs: { year: number; compliance_eur: number; maintenance_eur: number; total_eur: number };
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso.slice(0, 10)).toLocaleDateString("bg-BG");
  } catch {
    return iso;
  }
}

function fmtEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${Number(n).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKm(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Number(n).toLocaleString("bg-BG")} km`;
}

type Tab = "overview" | "maintenance" | "costs";

export function FleetVehicleDrawer({
  vehicleId,
  onClose,
  onChanged,
}: {
  vehicleId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [showKasko, setShowKasko] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [complianceModal, setComplianceModal] = useState<{ kind: FleetComplianceKind; provider?: string } | null>(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);

  useAdminBackHandler(true, onClose, "fleet-vehicle-drawer");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/fleet/vehicles/${vehicleId}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      setDetail(json.data as DetailPayload);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    setTab("overview");
    setShowKasko(false);
    setEditOpen(false);
    setComplianceModal(null);
    setMaintenanceOpen(false);
    setRepairOpen(false);
  }, [vehicleId]);

  function handleSaved() {
    void loadDetail();
    onChanged();
  }

  const vehicle = detail?.vehicle;
  const complianceKinds: FleetComplianceKind[] = showKasko
    ? FLEET_ALL_COMPLIANCE_KINDS
    : FLEET_CORE_COMPLIANCE_KINDS;

  return (
    <>
      <div className="fixed inset-0 z-[150] bg-slate-950/40 backdrop-blur-sm md:bg-slate-950/30" onClick={onClose} aria-hidden />
      <aside
        className="fixed inset-y-0 right-0 z-[151] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl pb-safe"
        role="dialog"
        aria-label="Детайли МПС"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          {vehicle ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <FleetStatusDot level={vehicle.overall_level} />
                <span className="font-mono text-lg font-bold text-slate-900">{vehicle.registration_number}</span>
              </div>
              <p className="text-sm text-slate-600 truncate">
                {vehicle.make} {vehicle.model}
                {vehicle.year ? ` (${vehicle.year})` : ""}
              </p>
            </div>
          ) : (
            <div className="h-10 flex-1" />
          )}
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-2">
          {(
            [
              ["overview", "Преглед"],
              ["maintenance", "Поддръжки"],
              ["costs", "Разходи"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 px-2 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                tab === id ? "border-brand-blue-500 text-brand-blue-700" : "border-transparent text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {vehicle && !loading && tab === "overview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="text-xs" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Редактирай
                </Button>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showKasko} onChange={(e) => setShowKasko(e.target.checked)} />
                  Покажи каско
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Статус</span><span>{fleetVehicleStatusLabel(vehicle.status)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Гориво</span><span>{fleetFuelTypeLabel(vehicle.fuel_type)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Пробег</span><span className="tabular-nums">{fmtKm(vehicle.odometer_km)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Отговорник</span><span>{fleetAssignedAdminName(vehicle.assigned_admin) ?? "—"}</span></div>
                {vehicle.notes && <p className="text-xs text-slate-600 pt-1 border-t border-slate-200 mt-2">{vehicle.notes}</p>}
              </div>

              <div className="space-y-2">
                {complianceKinds.map((kind) => {
                  const item = vehicle.compliance_summary[kind];
                  const level = item?.level ?? "missing";
                  return (
                    <div key={kind} className={`rounded-xl border p-3 ${fleetComplianceLevelClass(level)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wide opacity-80">{fleetComplianceKindLabel(kind)}</div>
                          <div className="text-sm font-semibold mt-0.5">{fmtDate(item?.expires_on ?? null)}</div>
                          <div className="text-xs mt-1 opacity-90">{fleetComplianceLevelLabel(level)}</div>
                          {item?.provider && <div className="text-xs mt-1">{item.provider}</div>}
                          {item?.reference_number && <div className="text-xs font-mono">{item.reference_number}</div>}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs shrink-0 h-8"
                          onClick={() =>
                            setComplianceModal({ kind, provider: item?.provider ?? undefined })
                          }
                        >
                          <Plus className="h-3 w-3 mr-0.5" /> Поднови
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {detail && detail.compliance.length > 3 && (
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">История срокове</h3>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {detail.compliance.slice(0, 8).map((r) => (
                      <li key={r.id} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                        <span>{fleetComplianceKindLabel(r.kind)}</span>
                        <span className="tabular-nums">{fmtDate(r.expires_on)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {vehicle && !loading && tab === "maintenance" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button type="button" className="flex-1 text-xs" onClick={() => setMaintenanceOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Поддръжка
                </Button>
                <Button type="button" variant="secondary" className="flex-1 text-xs" onClick={() => setRepairOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ремонт
                </Button>
              </div>

              {(() => {
                const services = (detail?.maintenance ?? []).filter((m) => !isFleetRepairKind(m.kind));
                const repairs = (detail?.maintenance ?? []).filter((m) => isFleetRepairKind(m.kind));

                if (!services.length && !repairs.length) {
                  return <p className="text-sm text-slate-500 text-center py-8">Няма записи</p>;
                }

                return (
                  <>
                    {services.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Поддръжки</h3>
                        <ul className="space-y-2">
                          {services.map((m) => (
                            <li key={m.id} className="rounded-xl border border-slate-200 p-3">
                              <div className="flex justify-between gap-2">
                                <div className="font-semibold text-sm text-slate-900">{fleetMaintenanceKindLabel(m.kind)}</div>
                                <span className="text-xs text-slate-500 shrink-0">{fmtDate(m.performed_on)}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 mt-2">
                                {m.odometer_km != null && <span>{fmtKm(m.odometer_km)}</span>}
                                {m.cost_eur != null && <span>{fmtEuro(m.cost_eur)}</span>}
                                {m.vendor && <span>{m.vendor}</span>}
                              </div>
                              {m.next_due_km != null && (
                                <div className="text-xs text-amber-700 mt-1">Следваща след {fmtKm(m.next_due_km)}</div>
                              )}
                              {m.next_due_date && (
                                <div className="text-xs text-amber-700">Следваща на {fmtDate(m.next_due_date)}</div>
                              )}
                              {m.notes && <p className="text-xs text-slate-500 mt-1">{m.notes}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {repairs.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase text-red-700/80 mb-2">Ремонти</h3>
                        <ul className="space-y-2">
                          {repairs.map((m) => (
                            <li key={m.id} className="rounded-xl border border-red-100 bg-red-50/40 p-3">
                              <div className="flex justify-between gap-2">
                                <div className="font-semibold text-sm text-slate-900">{m.title}</div>
                                <span className="text-xs text-slate-500 shrink-0">{fmtDate(m.performed_on)}</span>
                              </div>
                              {m.parts_description && (
                                <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap">{m.parts_description}</p>
                              )}
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 mt-2">
                                {m.odometer_km != null && <span>{fmtKm(m.odometer_km)}</span>}
                                {m.vendor && <span>{m.vendor}</span>}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-800 mt-2">
                                {m.parts_cost_eur != null && <span>Части: {fmtEuro(m.parts_cost_eur)}</span>}
                                {m.labor_cost_eur != null && <span>Труд: {fmtEuro(m.labor_cost_eur)}</span>}
                                {m.cost_eur != null && <span>Общо: {fmtEuro(m.cost_eur)}</span>}
                              </div>
                              {m.notes && <p className="text-xs text-slate-500 mt-1">{m.notes}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {vehicle && !loading && tab === "costs" && detail && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-bold uppercase text-slate-500">{detail.year_costs.year} г.</div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Срокове (GO, винетка…)</span><span className="font-semibold tabular-nums">{fmtEuro(detail.year_costs.compliance_eur)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Поддръжки и ремонти</span><span className="font-semibold tabular-nums">{fmtEuro(detail.year_costs.maintenance_eur)}</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-base"><span className="font-bold">Общо</span><span className="font-bold tabular-nums">{fmtEuro(detail.year_costs.total_eur)}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {vehicle && editOpen && (
        <FleetVehicleFormModal
          key={`edit-${vehicle.id}`}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
          vehicleId={vehicle.id}
          initial={{
            registrationNumber: vehicle.registration_number,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year ? String(vehicle.year) : "",
            vin: vehicle.vin ?? "",
            fuelType: vehicle.fuel_type,
            odometerKm: String(vehicle.odometer_km),
            status: vehicle.status,
            assignedAdminUserId: vehicle.assigned_admin_user_id ?? "",
            notes: vehicle.notes ?? "",
          }}
        />
      )}

      {vehicle && complianceModal && (
        <FleetComplianceFormModal
          key={`compliance-${vehicle.id}-${complianceModal.kind}`}
          open
          onClose={() => setComplianceModal(null)}
          onSaved={handleSaved}
          vehicleId={vehicle.id}
          initial={{
            kind: complianceModal.kind,
            provider: complianceModal.provider ?? "",
          }}
        />
      )}

      {vehicle && maintenanceOpen && (
        <FleetMaintenanceFormModal
          open
          onClose={() => setMaintenanceOpen(false)}
          onSaved={handleSaved}
          vehicleId={vehicle.id}
          defaultOdometer={vehicle.odometer_km}
        />
      )}

      {vehicle && repairOpen && (
        <FleetRepairFormModal
          open
          onClose={() => setRepairOpen(false)}
          onSaved={handleSaved}
          vehicleId={vehicle.id}
          defaultOdometer={vehicle.odometer_km}
        />
      )}
    </>
  );
}
