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
  FLEET_MISC_EXPENSE_CATEGORIES,
  fleetMiscExpenseCategoryLabel,
  type FleetMiscExpenseCategory,
} from "@/lib/admin/fleetTypes";

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
}

export function FleetMiscExpenseFormModal({
  open,
  onClose,
  onSaved,
  vehicleId,
  defaultCategory = "other",
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  vehicleId: string;
  defaultCategory?: FleetMiscExpenseCategory;
}) {
  const [category, setCategory] = useState<FleetMiscExpenseCategory>(defaultCategory);
  const [title, setTitle] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [costEur, setCostEur] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useAdminBackHandler(open, onClose, "fleet-misc-expense-form");

  useEffect(() => {
    if (!open) return;
    setCategory(defaultCategory);
    setTitle("");
    setExpenseDate(todayIso());
    setCostEur("");
    setNotes("");
    setError(null);
  }, [open, defaultCategory]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/fleet/vehicles/${vehicleId}/misc-expenses`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          expenseDate,
          costEur: Number(costEur),
          notes: notes.trim() || null,
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
          <h2 className="text-base font-bold text-slate-900">Друг разход</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 md:px-6 space-y-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <p className="text-xs text-slate-500">
            Глоби, пътни такси, паркинг и други разходи, които не са поддръжка или срокове.
          </p>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Категория *</span>
            <Select value={category} onChange={(e) => setCategory(e.target.value as FleetMiscExpenseCategory)} className="mt-1">
              {FLEET_MISC_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{fleetMiscExpenseCategoryLabel(c)}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Описание *</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" placeholder="Напр. Глоба — превишена скорост" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Дата *</span>
              <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Сума (€) *</span>
              <Input value={costEur} onChange={(e) => setCostEur(e.target.value)} inputMode="decimal" required className="mt-1" />
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
