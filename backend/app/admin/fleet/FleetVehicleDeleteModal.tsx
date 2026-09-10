"use client";

import { AlertTriangle } from "lucide-react";
import {
  AdminModalDragHandle,
  Button,
  useAdminBackHandler,
} from "../ui";
import { FLEET_MODAL_BACKDROP, FLEET_MODAL_PANEL } from "./fleetModalStyles";
import { FleetModalPortal } from "./FleetModalPortal";

export function FleetVehicleDeleteModal({
  open,
  onClose,
  onConfirm,
  registrationNumber,
  vehicleLabel,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  registrationNumber: string;
  vehicleLabel: string;
  submitting: boolean;
  error: string | null;
}) {
  useAdminBackHandler(open && !submitting, onClose, "fleet-vehicle-delete");

  if (!open) return null;

  return (
    <FleetModalPortal>
    <div className={FLEET_MODAL_BACKDROP} data-admin-overlay="true">
      <div className="absolute inset-0" onClick={() => !submitting && onClose()} aria-hidden />
      <div className={`${FLEET_MODAL_PANEL} relative z-10 max-w-md`} onClick={(e) => e.stopPropagation()}>
        <AdminModalDragHandle />
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Изтриване на МПС?</h2>
              <p className="mt-1 text-sm font-mono font-bold text-slate-800">{registrationNumber}</p>
              <p className="text-sm text-slate-600">{vehicleLabel}</p>
            </div>
          </div>
        </div>
        <div className="px-5 pb-4 space-y-3">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 leading-relaxed">
            <p className="font-bold">Това действие е необратимо.</p>
            <p className="mt-1 text-red-800">
              МПС-то ще бъде изтрито завинаги заедно с всички записи за винетка, гражданска отговорност, преглед, поддръжки и ремонти.
              Възстановяване не е възможно.
            </p>
          </div>
          {error && (
            <div className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting} className="flex-1">
            Отказ
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={submitting} className="flex-1">
            {submitting ? "Изтриване…" : "Изтрий завинаги"}
          </Button>
        </div>
      </div>
    </div>
    </FleetModalPortal>
  );
}
