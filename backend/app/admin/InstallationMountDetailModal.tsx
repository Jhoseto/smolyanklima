"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, ADMIN_MODAL_PANEL, AdminModalBackdrop, AdminModalDragHandle, AdminPhoneLink } from "./ui";
import { X, Loader2, Package, CheckCircle2, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";

type ProductEmbed = {
  id: string;
  name: string;
  slug: string;
  model_code?: string | null;
  price?: number | null;
  price_with_mount?: number | null;
  product_condition?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  stock_status?: string | null;
  stock_quantity?: number | null;
  brands?: { name?: string } | null;
  product_types?: { name?: string } | null;
};

type LinkedSale = {
  id: string;
  title?: string | null;
  status: string;
  sale_install_state?: string | null;
  total_amount?: number | null;
  unit_price?: number | null;
  event_code?: string | null;
};

type LinkedProtocol = {
  id: string;
  protocol_number: string;
  status: string;
  date?: string | null;
};

type WorkRow = {
  id: string;
  type: string;
  event_code?: string | null;
  status: string;
  priority: string;
  title: string;
  notes?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  product_id?: string | null;
  sale_work_item_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_amount?: number | null;
  products?: ProductEmbed | ProductEmbed[] | null;
};

function asProduct(p: WorkRow["products"]): ProductEmbed | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

function fmtBg(dt: string | null | undefined) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return dt;
  }
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${Number(n).toLocaleString("bg-BG")}`;
}

type Props = {
  workItemId: string | null;
  readOnly?: boolean;
  onClose: () => void;
  onCompleted?: () => void;
};

export function InstallationMountDetailModal({ workItemId, readOnly = false, onClose, onCompleted }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<WorkRow | null>(null);
  const [linkedSale, setLinkedSale] = useState<LinkedSale | null>(null);
  const [linkedProtocol, setLinkedProtocol] = useState<LinkedProtocol | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workItemId) {
      setRow(null);
      setLinkedSale(null);
      setLinkedProtocol(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${workItemId}`, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { work_item: WorkRow; linked_sale: LinkedSale | null; linked_protocol: LinkedProtocol | null };
      };
      if (!res.ok) throw new Error(json.error || "Грешка при зареждане");
      const w = json.data?.work_item;
      if (!w) throw new Error("Няма данни");
      setRow(w);
      setLinkedSale(json.data?.linked_sale ?? null);
      setLinkedProtocol(json.data?.linked_protocol ?? null);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      setRow(null);
      setLinkedSale(null);
      setLinkedProtocol(null);
    } finally {
      setLoading(false);
    }
  }, [workItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCompleteSale() {
    if (!linkedSale?.id || linkedSale.sale_install_state !== "pending_mount") return;
    setCompleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${linkedSale.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleInstallState: "completed" }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Грешка");
      await load();
      onCompleted?.();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setCompleteBusy(false);
    }
  }

  if (!workItemId) return null;

  const product = row ? asProduct(row.products) : null;
  const canCompleteSale = !readOnly && linkedSale?.sale_install_state === "pending_mount" && linkedSale.event_code === "sale";

  return (
    <AdminModalBackdrop open onClose={onClose} busy={completeBusy} layerId={`mount-detail-${workItemId ?? "new"}`}>
      <div
        className={`${ADMIN_MODAL_PANEL} max-w-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <AdminModalDragHandle />
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-brand-blue-700">Монтаж</div>
            <h2 className="text-lg font-black text-slate-900 leading-tight mt-0.5 truncate">{row?.title ?? "Зареждане…"}</h2>
          </div>
          <button
            type="button"
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
            onClick={() => !completeBusy && onClose()}
            aria-label="Затвори"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {error && <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}

          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-medium">Зареждане…</span>
            </div>
          )}

          {!loading && row && (
            <>
              <Card className="p-4 border-slate-200 bg-slate-50/80">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500 mb-3">Клиент и график</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Контакт</div>
                    <div className="font-semibold text-slate-900">{row.customer_name || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Телефон</div>
                    <div className="font-semibold text-slate-900">
                      <AdminPhoneLink phone={row.customer_phone} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Адрес монтаж</div>
                    <div className="font-medium text-slate-800 whitespace-pre-wrap">{row.customer_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Дата (план)</div>
                    <div className="font-semibold text-slate-900">{row.due_date ? new Date(row.due_date).toLocaleDateString("bg-BG") : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Статус задача</div>
                    <div className="font-semibold text-slate-900 capitalize">{row.status}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Начало</div>
                    <div className="font-semibold text-slate-900">{fmtBg(row.scheduled_start)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Край</div>
                    <div className="font-semibold text-slate-900">{fmtBg(row.scheduled_end)}</div>
                  </div>
                </div>
                {row.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Бележки</div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{row.notes}</div>
                  </div>
                )}
              </Card>

              {linkedProtocol && (
                <Card className="p-4 border-violet-100 bg-violet-50/40">
                  <div className="text-xs font-black uppercase tracking-wide text-violet-800 mb-2">Приемно-предавателен протокол</div>
                  <div className="text-sm font-semibold text-slate-900">{linkedProtocol.protocol_number}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Дата: {linkedProtocol.date ? new Date(linkedProtocol.date).toLocaleDateString("bg-BG") : "—"} · Статус:{" "}
                    <strong>{linkedProtocol.status === "signed" ? "подписан" : linkedProtocol.status === "in_progress" ? "в процес" : "подготвен"}</strong>
                  </div>
                  <div className="pt-3 mt-2 border-t border-violet-100">
                    <Link
                      href={`/admin/service/documents/acceptance?edit=${linkedProtocol.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-800 hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Отвори протокола за допълване
                    </Link>
                  </div>
                </Card>
              )}

              {linkedSale && (
                <Card className="p-4 border-emerald-100 bg-emerald-50/50">
                  <div className="text-xs font-black uppercase tracking-wide text-emerald-800 mb-2">Свързана продажба</div>
                  <div className="text-sm font-semibold text-slate-900">{linkedSale.title || "Продажба"}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Сума: {fmtMoney(linkedSale.total_amount ?? linkedSale.unit_price)} · Статус монтаж:{" "}
                    <strong>
                      {linkedSale.sale_install_state === "pending_mount"
                        ? "чака монтаж"
                        : linkedSale.sale_install_state === "completed"
                          ? "завършен"
                          : "—"}
                    </strong>
                  </div>
                </Card>
              )}

              <Card className="p-4 border-brand-blue-100 bg-brand-blue-50/30">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-brand-blue-800 mb-3">
                  <Package className="w-4 h-4" />
                  Климатик за монтаж
                </div>
                {product ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-black text-slate-950 text-base leading-snug">{product.name}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-slate-700">
                      <div>
                        <span className="text-slate-500 font-medium">Марка:</span> {product.brands?.name ?? "—"}
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Тип:</span> {product.product_types?.name ?? "—"}
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Модел:</span> {product.model_code?.trim() || "—"}
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Състояние:</span> {product.product_condition === "used" ? "употребяван" : "нов"}
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Цена:</span> {fmtMoney(product.price ?? null)}
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Цена с монтаж:</span> {fmtMoney(product.price_with_mount ?? null)}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 font-medium">Вътрешна единица (SN):</span>{" "}
                        <span className="font-mono text-xs">{product.indoor_unit_serial || "—"}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 font-medium">Външна единица (SN):</span>{" "}
                        <span className="font-mono text-xs">{product.outdoor_unit_serial || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Склад:</span> {product.stock_status ?? "—"} / {product.stock_quantity ?? "—"} бр.
                      </div>
                    </div>
                    <div className="pt-3 mt-1 border-t border-slate-200/80">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue-700 hover:underline"
                      >
                        Отвори продукт в админа <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Няма вързан продукт към тази задача (ручен запис в календара). Данните за климатик са само в заглавието и бележките.
                  </p>
                )}
              </Card>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-4 flex flex-wrap gap-2 justify-end shrink-0 bg-slate-50/90">
          <Button variant="secondary" type="button" onClick={onClose} disabled={completeBusy}>
            Затвори
          </Button>
          {canCompleteSale && (
            <Button variant="primary" type="button" className="gap-2" disabled={completeBusy} onClick={() => void handleCompleteSale()}>
              {completeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Завършен
            </Button>
          )}
        </div>
      </div>
    </AdminModalBackdrop>
  );
}
