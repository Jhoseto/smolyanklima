"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Table,
  Th,
  Td,
  Input,
  Select,
  Textarea,
  Button,
  SectionTitle,
  ADMIN_MODAL_BACKDROP,
  ADMIN_MODAL_PANEL,
  AdminModalDragHandle,
  useAdminBackHandler,
} from "../ui";
import { Plus, RefreshCw, PackageSearch, Trash2, Pencil, ArrowRight } from "lucide-react";

type ContainerRow = {
  id: string;
  name: string;
  year: number;
  sequence_in_year: number;
  arrival_date: string | null;
  supplier_name: string | null;
  departure_date: string | null;
  customs_duty: number | null;
  vat_amount: number | null;
  japan_price: number | null;
  transport_to_bulgaria: number | null;
  transport_to_smolyan: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product_count: number;
};

type SortField = "year" | "arrival_date" | "created_at" | "name";
type SortDir = "asc" | "desc";

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("bg-BG");
  } catch {
    return v;
  }
}

function currentYear(): number {
  return new Date().getFullYear();
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${Number(n).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function totalCost(row: {
  customs_duty: number | null;
  vat_amount: number | null;
  japan_price: number | null;
  transport_to_bulgaria: number | null;
  transport_to_smolyan: number | null;
}): number | null {
  const parts = [row.customs_duty, row.vat_amount, row.japan_price, row.transport_to_bulgaria, row.transport_to_smolyan];
  if (parts.every((p) => p == null)) return null;
  return parts.reduce((sum: number, p) => sum + (p ?? 0), 0);
}

export default function AdminContainersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [yearFilter, setYearFilter] = useState("");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [createOpen, setCreateOpen] = useState(false);
  const [createYear, setCreateYear] = useState(String(currentYear()));
  const [createArrivalDate, setCreateArrivalDate] = useState("");
  const [createSupplierName, setCreateSupplierName] = useState("");
  const [createDepartureDate, setCreateDepartureDate] = useState("");
  const [createCustomsDuty, setCreateCustomsDuty] = useState("");
  const [createVatAmount, setCreateVatAmount] = useState("");
  const [createJapanPrice, setCreateJapanPrice] = useState("");
  const [createTransportToBulgaria, setCreateTransportToBulgaria] = useState("");
  const [createTransportToSmolyan, setCreateTransportToSmolyan] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ContainerRow | null>(null);
  const [editArrivalDate, setEditArrivalDate] = useState("");
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editDepartureDate, setEditDepartureDate] = useState("");
  const [editCustomsDuty, setEditCustomsDuty] = useState("");
  const [editVatAmount, setEditVatAmount] = useState("");
  const [editJapanPrice, setEditJapanPrice] = useState("");
  const [editTransportToBulgaria, setEditTransportToBulgaria] = useState("");
  const [editTransportToSmolyan, setEditTransportToSmolyan] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ContainerRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useAdminBackHandler(Boolean(createOpen || editing || deleteTarget), () => {
    if (deleteTarget) setDeleteTarget(null);
    else if (editing) setEditing(null);
    else setCreateOpen(false);
  }, "containers-modal");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (yearFilter.trim()) sp.set("year", yearFilter.trim());
    if (q.trim()) sp.set("q", q.trim());
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("perPage", "200");
    return sp.toString();
  }, [yearFilter, q, sortBy, sortDir]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/containers?${qs}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при зареждане");
      setRows((json as { data?: ContainerRow[] }).data ?? []);
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

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) set.add(r.year);
    const y = currentYear();
    set.add(y);
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const previewName = useMemo(() => {
    const y = Number(createYear);
    if (!Number.isFinite(y)) return "";
    const existingForYear = rows.filter((r) => r.year === y).length;
    const nextSeq = existingForYear + 1;
    return nextSeq <= 1 ? `Контейнер ${y}` : `Контейнер ${y}-${nextSeq}`;
  }, [createYear, rows]);

  const createTotalCost = useMemo(() => {
    const nums = [createCustomsDuty, createVatAmount, createJapanPrice, createTransportToBulgaria, createTransportToSmolyan]
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n !== 0);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0);
  }, [createCustomsDuty, createVatAmount, createJapanPrice, createTransportToBulgaria, createTransportToSmolyan]);

  const editTotalCost = useMemo(() => {
    const nums = [editCustomsDuty, editVatAmount, editJapanPrice, editTransportToBulgaria, editTransportToSmolyan]
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n !== 0);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0);
  }, [editCustomsDuty, editVatAmount, editJapanPrice, editTransportToBulgaria, editTransportToSmolyan]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  }

  async function submitCreate() {
    setCreateError(null);
    const y = Number(createYear);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      setCreateError("Въведете валидна година.");
      return;
    }
    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/admin/containers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: y,
          arrivalDate: createArrivalDate.trim() || null,
          supplierName: createSupplierName.trim() || null,
          departureDate: createDepartureDate.trim() || null,
          customsDuty: createCustomsDuty.trim() || null,
          vatAmount: createVatAmount.trim() || null,
          japanPrice: createJapanPrice.trim() || null,
          transportToBulgaria: createTransportToBulgaria.trim() || null,
          transportToSmolyan: createTransportToSmolyan.trim() || null,
          notes: createNotes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при създаване");
      setCreateOpen(false);
      setCreateArrivalDate("");
      setCreateSupplierName("");
      setCreateDepartureDate("");
      setCreateCustomsDuty("");
      setCreateVatAmount("");
      setCreateJapanPrice("");
      setCreateTransportToBulgaria("");
      setCreateTransportToSmolyan("");
      setCreateNotes("");
      setCreateYear(String(currentYear()));
      setToast({ kind: "ok", text: `Създаден: ${(json as { data?: { name?: string } }).data?.name ?? ""}` });
      void load();
    } catch (e: unknown) {
      setCreateError(String(e instanceof Error ? e.message : e));
    } finally {
      setCreateSubmitting(false);
    }
  }

  function openEdit(row: ContainerRow) {
    setEditing(row);
    setEditArrivalDate(row.arrival_date ?? "");
    setEditSupplierName(row.supplier_name ?? "");
    setEditDepartureDate(row.departure_date ?? "");
    setEditCustomsDuty(row.customs_duty != null ? String(row.customs_duty) : "");
    setEditVatAmount(row.vat_amount != null ? String(row.vat_amount) : "");
    setEditJapanPrice(row.japan_price != null ? String(row.japan_price) : "");
    setEditTransportToBulgaria(row.transport_to_bulgaria != null ? String(row.transport_to_bulgaria) : "");
    setEditTransportToSmolyan(row.transport_to_smolyan != null ? String(row.transport_to_smolyan) : "");
    setEditNotes(row.notes ?? "");
    setEditError(null);
  }

  async function submitEdit() {
    if (!editing) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/containers/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrivalDate: editArrivalDate.trim() || null,
          supplierName: editSupplierName.trim() || null,
          departureDate: editDepartureDate.trim() || null,
          customsDuty: editCustomsDuty.trim() || null,
          vatAmount: editVatAmount.trim() || null,
          japanPrice: editJapanPrice.trim() || null,
          transportToBulgaria: editTransportToBulgaria.trim() || null,
          transportToSmolyan: editTransportToSmolyan.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при запис");
      setEditing(null);
      setToast({ kind: "ok", text: "Запазено" });
      void load();
    } catch (e: unknown) {
      setEditError(String(e instanceof Error ? e.message : e));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/admin/containers/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при изтриване");
      setDeleteTarget(null);
      setToast({ kind: "ok", text: "Изтрит" });
      void load();
    } catch (e: unknown) {
      setDeleteError(String(e instanceof Error ? e.message : e));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function viewProducts(row: ContainerRow) {
    router.push(`/admin/products?containerId=${encodeURIComponent(row.id)}`);
  }

  return (
    <div className="w-full space-y-3">
      {toast && (
        <div
          className={`fixed top-2 left-2 right-2 md:top-4 md:left-auto md:right-4 z-50 px-3 py-2.5 md:px-4 md:py-3 rounded-xl shadow-lg border font-bold text-xs md:text-sm transition-all ${
            toast.kind === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold leading-tight text-slate-900 md:text-xl">
          <SectionTitle
            title="Контейнери"
            hint="Пратки втора употреба от Япония. Всеки контейнер групира заведените към него климатици."
          />
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => setCreateOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Нов контейнер
          </Button>
          <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Обнови</span>
          </Button>
        </div>
      </div>

      <Card className="space-y-2 p-2.5 md:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Търсене по име или бележка…"
            className="flex-1 text-sm"
          />
          <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="!w-auto min-w-[8rem]">
            <option value="">Година: всички</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-10 text-sm font-medium text-slate-500 gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Зареждане…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>
      )}

      {!loading && !error && (
        <div className="hidden md:block">
          <Table>
            <thead>
              <tr>
                <SortableTh label="Име" field="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Година" field="year" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
                <SortableTh label="Пристигане" field="arrival_date" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
                <Th className="text-left">Доставчик</Th>
                <Th className="text-right">Разходи</Th>
                <Th className="text-center">Климатици</Th>
                <SortableTh label="Създаден" field="created_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
                <Th className="text-center">Действия</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <Td className="font-bold text-slate-900">{row.name}</Td>
                  <Td className="text-center tabular-nums">{row.year}</Td>
                  <Td className="text-center whitespace-nowrap">{fmtDate(row.arrival_date)}</Td>
                  <Td>{row.supplier_name || "—"}</Td>
                  <Td className="text-right tabular-nums font-semibold text-slate-700">{fmtMoney(totalCost(row))}</Td>
                  <Td className="text-center">
                    <button
                      type="button"
                      onClick={() => viewProducts(row)}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-blue-200 bg-brand-blue-50 px-2.5 py-1 text-xs font-bold text-brand-blue-700 hover:bg-brand-blue-100"
                      title="Виж климатиците в този контейнер"
                    >
                      {row.product_count}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </Td>
                  <Td className="text-center whitespace-nowrap text-slate-500">{fmtDate(row.created_at)}</Td>
                  <Td className="text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(row)} title="Редактирай">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(row);
                        }}
                        title="Изтрий"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <Td colSpan={8} className="py-10 text-center text-slate-500">
                    <PackageSearch className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                    Няма контейнери. Създайте първия с бутона по-горе.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-2 md:hidden">
          {rows.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Няма контейнери. Създайте първия с бутона по-горе.
            </div>
          )}
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{row.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Пристигане: {fmtDate(row.arrival_date)}
                    {row.supplier_name ? ` · ${row.supplier_name}` : ""}
                  </div>
                  {totalCost(row) != null && (
                    <div className="mt-0.5 text-xs font-semibold text-slate-700">
                      Разходи: {fmtMoney(totalCost(row))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => viewProducts(row)}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-blue-200 bg-brand-blue-50 px-2.5 py-1 text-xs font-bold text-brand-blue-700"
                >
                  {row.product_count} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" className="font-bold !text-xs" onClick={() => openEdit(row)}>
                  <Pencil className="mr-1 inline h-3.5 w-3.5" />
                  Редактирай
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="font-bold !text-xs"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(row);
                  }}
                >
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                  Изтрий
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <div className={ADMIN_MODAL_BACKDROP} onClick={() => !createSubmitting && setCreateOpen(false)}>
          <div className={ADMIN_MODAL_PANEL} onClick={(e) => e.stopPropagation()}>
            <AdminModalDragHandle />
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="text-base font-bold text-slate-900">Нов контейнер</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 px-5 py-4">
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                  {createError}
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Дата на отпътуване от Япония (по избор)
                </span>
                <Input
                  type="date"
                  value={createDepartureDate}
                  onChange={(e) => setCreateDepartureDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Дата на пристигане (по избор)
                </span>
                <Input type="date" value={createArrivalDate} onChange={(e) => setCreateArrivalDate(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">Година</span>
                <Input
                  type="number"
                  value={createYear}
                  onChange={(e) => setCreateYear(e.target.value)}
                  min={2000}
                  max={2100}
                />
                {previewName && (
                  <div className="mt-1 text-[11px] font-semibold text-brand-blue-700">Ще се казва: {previewName}</div>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Доставчик (по избор)
                </span>
                <Input
                  value={createSupplierName}
                  onChange={(e) => setCreateSupplierName(e.target.value)}
                  placeholder="Име на доставчика…"
                />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Разходи по контейнера (по избор, €)
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">Цена от Япония</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={createJapanPrice}
                      onChange={(e) => setCreateJapanPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">Мито</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={createCustomsDuty}
                      onChange={(e) => setCreateCustomsDuty(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">ДДС</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={createVatAmount}
                      onChange={(e) => setCreateVatAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">Транспорт до България</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={createTransportToBulgaria}
                      onChange={(e) => setCreateTransportToBulgaria(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">Транспорт до Смолян</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={createTransportToSmolyan}
                      onChange={(e) => setCreateTransportToSmolyan(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>
                {createTotalCost != null && (
                  <div className="text-[11px] font-bold text-brand-blue-700">Общо: {fmtMoney(createTotalCost)}</div>
                )}
              </div>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Бележки (по избор)
                </span>
                <Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} rows={3} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
                Отказ
              </Button>
              <Button variant="primary" onClick={submitCreate} disabled={createSubmitting}>
                {createSubmitting ? "Създавам…" : "Създай"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className={ADMIN_MODAL_BACKDROP} onClick={() => !editSubmitting && setEditing(null)}>
          <div className={ADMIN_MODAL_PANEL} onClick={(e) => e.stopPropagation()}>
            <AdminModalDragHandle />
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="text-base font-bold text-slate-900">Редакция: {editing.name}</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 px-5 py-4">
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                  {editError}
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Дата на отпътуване от Япония
                </span>
                <Input type="date" value={editDepartureDate} onChange={(e) => setEditDepartureDate(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Дата на пристигане
                </span>
                <Input type="date" value={editArrivalDate} onChange={(e) => setEditArrivalDate(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">Доставчик</span>
                <Input
                  value={editSupplierName}
                  onChange={(e) => setEditSupplierName(e.target.value)}
                  placeholder="Име на доставчика…"
                />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Разходи по контейнера (€)
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">Цена от Япония</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editJapanPrice}
                      onChange={(e) => setEditJapanPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">Мито</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editCustomsDuty}
                      onChange={(e) => setEditCustomsDuty(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">ДДС</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editVatAmount}
                      onChange={(e) => setEditVatAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">Транспорт до България</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editTransportToBulgaria}
                      onChange={(e) => setEditTransportToBulgaria(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">Транспорт до Смолян</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editTransportToSmolyan}
                      onChange={(e) => setEditTransportToSmolyan(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>
                {editTotalCost != null && (
                  <div className="text-[11px] font-bold text-brand-blue-700">Общо: {fmtMoney(editTotalCost)}</div>
                )}
              </div>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">Бележки</span>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={editSubmitting}>
                Отказ
              </Button>
              <Button variant="primary" onClick={submitEdit} disabled={editSubmitting}>
                {editSubmitting ? "Запазвам…" : "Запази"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className={ADMIN_MODAL_BACKDROP} onClick={() => !deleteSubmitting && setDeleteTarget(null)}>
          <div className={`${ADMIN_MODAL_PANEL} md:max-w-md`} onClick={(e) => e.stopPropagation()}>
            <AdminModalDragHandle />
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="text-base font-bold text-slate-900">Изтриване на {deleteTarget.name}?</div>
            </div>
            <div className="px-5 py-4 text-sm text-slate-600">
              {deleteError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                  {deleteError}
                </div>
              ) : (
                "Действието е необратимо. Ако контейнерът съдържа климатици, изтриването ще бъде отказано."
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteSubmitting}>
                Отказ
              </Button>
              <Button variant="danger" onClick={submitDelete} disabled={deleteSubmitting}>
                {deleteSubmitting ? "Изтривам…" : "Изтрий"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTh({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
  center = false,
}: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  center?: boolean;
}) {
  const isActive = sortBy === field;
  return (
    <Th className="p-0">
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`w-full px-3.5 py-2.5 ${center ? "text-center justify-center" : "text-left justify-start"} inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap transition-colors hover:bg-slate-100 ${
          isActive ? "text-brand-blue-700 bg-brand-blue-50/60" : "text-slate-600"
        }`}
      >
        {label}
        {isActive && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </Th>
  );
}
