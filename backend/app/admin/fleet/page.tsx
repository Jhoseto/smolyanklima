"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useSearchParams } from "next/navigation";
import { Car, Plus, RefreshCw } from "lucide-react";
import { FleetRowActionsMenu } from "./FleetRowActionsMenu";
import {
  Button,
  Card,
  Input,
  SectionTitle,
  Select,
  Table,
  Td,
  Th,
  AdminTableLoadingRow,
} from "../ui";
import { FleetComplianceBadge, FleetComplianceMiniBadge } from "./FleetComplianceBadge";
import { FleetStatusDot } from "./FleetStatusDot";
import { FleetVehicleDrawer } from "./FleetVehicleDrawer";
import { FleetVehicleFormModal } from "./FleetVehicleFormModal";
import { FleetVehicleDeleteModal } from "./FleetVehicleDeleteModal";
import type { FleetSummaryCounts } from "@/lib/admin/fleetQueries";
import type { FleetVehicleListRow, FleetVehicleStatus } from "@/lib/admin/fleetTypes";
import { fleetAssignedAdminName, fleetVehicleStatusLabel } from "@/lib/admin/fleetTypes";

type StaffOption = { id: string; name: string };

function fmtKm(n: number): string {
  return `${Number(n).toLocaleString("bg-BG")} km`;
}

function FleetPageInner() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<FleetVehicleListRow[]>([]);
  const [summary, setSummary] = useState<FleetSummaryCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [statusFilter, setStatusFilter] = useState<FleetVehicleStatus | "all">("active");
  const [alertFilter, setAlertFilter] = useState<"all" | "alert" | "critical">(
    searchParams.get("alert") === "critical" ? "critical" : "all",
  );
  const [assignedFilter, setAssignedFilter] = useState("");
  const [sortBy, setSortBy] = useState<"registration" | "alert" | "odometer">("alert");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [editVehicle, setEditVehicle] = useState<FleetVehicleListRow | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<FleetVehicleListRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    sp.set("status", statusFilter);
    sp.set("alertLevel", alertFilter);
    if (assignedFilter) sp.set("assignedAdminUserId", assignedFilter);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    return sp.toString();
  }, [debouncedQ, statusFilter, alertFilter, assignedFilter, sortBy, sortDir]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/admin/fleet/vehicles?${qs}`, { credentials: "include" }),
        fetch("/api/admin/fleet/summary", { credentials: "include" }),
      ]);
      const listJson = await listRes.json().catch(() => ({}));
      const summaryJson = await summaryRes.json().catch(() => ({}));
      if (!listRes.ok) throw new Error((listJson as { error?: string }).error || "Грешка при зареждане");
      setRows((listJson as { data?: FleetVehicleListRow[] }).data ?? []);
      if (summaryRes.ok) setSummary((summaryJson as { data?: FleetSummaryCounts }).data ?? null);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    void fetch("/api/admin/whoami", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setIsMasterAdmin((j as { data?: { admin?: { role?: string } } }).data?.admin?.role === "master_admin"))
      .catch(() => setIsMasterAdmin(false));
  }, []);

  useEffect(() => {
    void fetch("/api/admin/staff", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setStaff(((j as { staff?: StaffOption[] }).staff ?? []).filter((s) => s.name?.trim())))
      .catch(() => setStaff([]));
  }, []);

  function vehicleLabel(row: FleetVehicleListRow): string {
    return [row.make, row.model, row.year ? `(${row.year})` : ""].filter(Boolean).join(" ");
  }

  function openEdit(row: FleetVehicleListRow) {
    setEditVehicle(row);
  }

  function openDelete(row: FleetVehicleListRow) {
    setMenuId(null);
    setSelectedId(null);
    setDeleteError(null);
    setDeleteVehicle(row);
  }

  async function confirmDelete() {
    if (!deleteVehicle) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/fleet/vehicles/${deleteVehicle.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при изтриване");
      if (selectedId === deleteVehicle.id) setSelectedId(null);
      setDeleteVehicle(null);
      void load();
    } catch (e: unknown) {
      setDeleteError(String(e instanceof Error ? e.message : e));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Car className="h-5 w-5 text-brand-blue-600" />
            <SectionTitle title="Автопарк" hint="Проследяване на винетка, гражданска отговорност, преглед и поддръжки по МПС." />
          </h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading} className="h-10">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)} className="h-10">
            <Plus className="h-4 w-4 mr-1" /> МПС
          </Button>
        </div>
      </div>

      <Card className="space-y-2 p-2.5 md:p-3">
        {summary && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs md:text-sm border-b border-slate-100 pb-2">
            <span className="inline-flex items-center gap-1 font-semibold text-red-700 whitespace-nowrap">
              <FleetStatusDot level="critical" size="sm" /> {summary.critical} критични
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 whitespace-nowrap">
              <FleetStatusDot level="warning" size="sm" /> {summary.warning} скоро
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 whitespace-nowrap">
              <FleetStatusDot level="ok" size="sm" /> {summary.ok} OK
            </span>
            <Select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value as typeof alertFilter)}
              className="!w-auto min-w-[8.5rem] ml-auto text-xs h-8"
            >
              <option value="all">Всички МПС</option>
              <option value="alert">Само alert</option>
              <option value="critical">Само критични</option>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Търси рег. №, марка…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:flex-1 sm:min-w-[10rem] text-sm h-9"
          />
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:contents">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FleetVehicleStatus | "all")}
              className="!w-auto flex-1 sm:flex-none min-w-0 sm:min-w-[7.5rem] text-xs h-9"
            >
              <option value="active">Активни</option>
              <option value="inactive">Неактивни</option>
              <option value="sold">Продадени</option>
              <option value="all">Всички</option>
            </Select>
            <Select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="!w-auto flex-1 sm:flex-none min-w-0 sm:min-w-[9rem] text-xs h-9"
            >
              <option value="">Отговорник</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [by, dir] = e.target.value.split(":") as [typeof sortBy, typeof sortDir];
                setSortBy(by);
                setSortDir(dir);
              }}
              className="!w-auto flex-1 sm:flex-none min-w-0 sm:min-w-[9.5rem] text-xs h-9"
            >
              <option value="alert:asc">Сорт: alert</option>
              <option value="registration:asc">Рег. № А→Я</option>
              <option value="registration:desc">Рег. № Я→А</option>
              <option value="odometer:desc">Пробег ↓</option>
              <option value="odometer:asc">Пробег ↑</option>
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="hidden md:block">
        <Table loading={loading}>
          <thead>
            <tr>
              <Th className="w-8" />
              <Th>Рег. №</Th>
              <Th>МПС</Th>
              <Th>Винетка</Th>
              <Th>Гражданска отговорност</Th>
              <Th>Преглед</Th>
              <Th>Пробег</Th>
              <Th>Отговорник</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <AdminTableLoadingRow colSpan={9} />
            ) : rows.length === 0 ? (
              <tr>
                <Td colSpan={9} className="text-center text-slate-500 py-10">Няма МПС</Td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer hover:bg-slate-50/80 ${menuId === row.id ? "relative z-30 bg-slate-50/80" : ""}`}
                  onClick={() => {
                    setMenuId(null);
                    setSelectedId(row.id);
                  }}
                >
                  <Td><FleetStatusDot level={row.overall_level} title={fleetVehicleStatusLabel(row.status)} /></Td>
                  <Td><span className="font-mono font-bold text-slate-900">{row.registration_number}</span></Td>
                  <Td className="text-sm">
                    {row.make} {row.model}
                    {row.year ? <span className="text-slate-500"> ({row.year})</span> : null}
                  </Td>
                  <Td><FleetComplianceBadge item={row.compliance_summary.vignette} compact /></Td>
                  <Td><FleetComplianceBadge item={row.compliance_summary.civil_liability} compact /></Td>
                  <Td><FleetComplianceBadge item={row.compliance_summary.technical_inspection} compact /></Td>
                  <Td className="tabular-nums text-sm">{fmtKm(row.odometer_km)}</Td>
                  <Td className="text-sm truncate max-w-[8rem]">{fleetAssignedAdminName(row.assigned_admin) ?? "—"}</Td>
                  <Td className="relative" onClick={(e) => e.stopPropagation()}>
                    <FleetRowActionsMenu
                      open={menuId === row.id}
                      onOpenChange={(open) => setMenuId(open ? row.id : null)}
                      onDetails={() => setSelectedId(row.id)}
                      onEdit={() => openEdit(row)}
                      onDelete={() => openDelete(row)}
                      canDelete={isMasterAdmin}
                    />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <div className="md:hidden space-y-2">
        {loading && rows.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">Зареждане…</Card>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">Няма МПС</Card>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className="flex-1 min-w-0 text-left active:opacity-80"
                >
                  <div className="flex items-center gap-2">
                    <FleetStatusDot level={row.overall_level} />
                    <span className="font-mono font-bold text-slate-900">{row.registration_number}</span>
                  </div>
                </button>
                <FleetRowActionsMenu
                  open={menuId === row.id}
                  onOpenChange={(open) => setMenuId(open ? row.id : null)}
                  onDetails={() => setSelectedId(row.id)}
                  onEdit={() => openEdit(row)}
                  onDelete={() => openDelete(row)}
                  canDelete={isMasterAdmin}
                />
              </div>
              <button type="button" onClick={() => setSelectedId(row.id)} className="w-full text-left active:opacity-80">
              <div className="text-sm text-slate-600 mt-0.5">{row.make} {row.model}{row.year ? ` (${row.year})` : ""}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <FleetComplianceMiniBadge shortLabel="В" item={row.compliance_summary.vignette} />
                <FleetComplianceMiniBadge shortLabel="Гр. отг." item={row.compliance_summary.civil_liability} />
                <FleetComplianceMiniBadge shortLabel="П" item={row.compliance_summary.technical_inspection} />
              </div>
              <div className="text-xs text-slate-500 mt-2 tabular-nums">{fmtKm(row.odometer_km)}</div>
              </button>
            </div>
          ))
        )}
      </div>

      {createOpen && (
        <FleetVehicleFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={() => void load()}
        />
      )}

      {editVehicle && (
        <FleetVehicleFormModal
          open
          onClose={() => setEditVehicle(null)}
          onSaved={() => {
            setEditVehicle(null);
            void load();
          }}
          vehicleId={editVehicle.id}
          initial={{
            registrationNumber: editVehicle.registration_number,
            make: editVehicle.make,
            model: editVehicle.model,
            year: editVehicle.year ? String(editVehicle.year) : "",
            vin: editVehicle.vin ?? "",
            fuelType: editVehicle.fuel_type,
            odometerKm: String(editVehicle.odometer_km),
            status: editVehicle.status,
            assignedAdminUserId: editVehicle.assigned_admin_user_id ?? "",
            notes: editVehicle.notes ?? "",
          }}
        />
      )}

      {deleteVehicle && (
        <FleetVehicleDeleteModal
          open
          onClose={() => !deleteSubmitting && setDeleteVehicle(null)}
          onConfirm={() => void confirmDelete()}
          registrationNumber={deleteVehicle.registration_number}
          vehicleLabel={vehicleLabel(deleteVehicle)}
          submitting={deleteSubmitting}
          error={deleteError}
        />
      )}

      {selectedId && (
        <FleetVehicleDrawer
          vehicleId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

export default function AdminFleetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Зареждане…</div>}>
      <FleetPageInner />
    </Suspense>
  );
}
