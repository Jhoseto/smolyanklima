"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { X, Loader2, FileText, ExternalLink, Package } from "lucide-react";
import { Button, Card } from "../ui";
import { ProductQuickViewButton } from "../ProductQuickView";
import { CatalogProductImage } from "../components/CatalogProductImage";
import { saleCancelReasonLabel } from "@/lib/admin/saleCancelReason";

type ProductEmbed = {
  id: string;
  name: string;
  slug?: string | null;
  model_code?: string | null;
  price?: number | null;
  price_with_mount?: number | null;
  product_condition?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  stock_status?: string | null;
  brands?: { name?: string | null } | null;
  product_types?: { name?: string | null } | null;
  product_images?: Array<{ url: string; is_main?: boolean | null; sort_order?: number | null }> | null;
};

type ContactEmbed = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

type SaleWorkRow = {
  id: string;
  title: string;
  status: string;
  event_code?: string | null;
  sale_install_state?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_amount?: number | null;
  due_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  cancel_reason?: string | null;
  products?: ProductEmbed | ProductEmbed[] | null;
  contacts?: ContactEmbed | ContactEmbed[] | null;
};

type LinkedInstallation = {
  id: string;
  title?: string | null;
  status: string;
  due_date?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  notes?: string | null;
  completed_at?: string | null;
};

type LinkedProtocol = {
  id: string;
  protocol_number: string;
  status: string;
  date?: string | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function fmtBgDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("bg-BG");
  } catch {
    return value;
  }
}

function fmtBgDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${Number(n).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mountPhaseLabel(row: SaleWorkRow): string {
  if (row.status === "cancelled") return "Отказана";
  if (row.sale_install_state === "pending_mount") return "Чака монтаж";
  if (row.sale_install_state === "completed") return "Завършен";
  if (row.status === "done") return "Завършен";
  return "Чака монтаж";
}

function pickMainImage(product: ProductEmbed | null): string | null {
  if (!product?.product_images?.length) return null;
  const sorted = [...product.product_images].sort(
    (a, b) => Number(Boolean(b.is_main)) - Number(Boolean(a.is_main)) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
  );
  return sorted[0]?.url ?? null;
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}

type Props = {
  saleId: string | null;
  onClose: () => void;
};

export function SaleDetailModal({ saleId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sale, setSale] = useState<SaleWorkRow | null>(null);
  const [installation, setInstallation] = useState<LinkedInstallation | null>(null);
  const [protocol, setProtocol] = useState<LinkedProtocol | null>(null);

  const load = useCallback(async () => {
    if (!saleId) {
      setSale(null);
      setInstallation(null);
      setProtocol(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${saleId}`, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          work_item: SaleWorkRow;
          linked_installation: LinkedInstallation | null;
          linked_protocol: LinkedProtocol | null;
        };
      };
      if (!res.ok) throw new Error(json.error || "Грешка при зареждане");
      setSale(json.data?.work_item ?? null);
      setInstallation(json.data?.linked_installation ?? null);
      setProtocol(json.data?.linked_protocol ?? null);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      setSale(null);
      setInstallation(null);
      setProtocol(null);
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!saleId) return null;

  const product = asOne(sale?.products ?? null);
  const contact = asOne(sale?.contacts ?? null);
  const imageUrl = pickMainImage(product);
  const amount = sale?.total_amount ?? sale?.unit_price ?? null;
  const cancelLabel = saleCancelReasonLabel(sale?.cancel_reason);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/55 p-0 md:p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92dvh] md:max-h-[92vh] overflow-hidden rounded-t-3xl md:rounded-2xl border border-white/20 bg-white shadow-2xl flex flex-col pb-safe md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Продажба</div>
            <h2 className="text-lg font-black text-slate-900 leading-tight mt-0.5 truncate">
              {product?.name ?? sale?.title ?? "Детайли на продажба"}
            </h2>
          </div>
          <button
            type="button"
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
            onClick={onClose}
            aria-label="Затвори"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {error && (
            <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-medium">Зареждане…</span>
            </div>
          )}

          {!loading && sale && (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  {mountPhaseLabel(sale)}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                  Оперативен: {sale.status === "cancelled" ? "отказана" : sale.status === "done" ? "изпълнена" : "чака"}
                </span>
                {cancelLabel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-200">
                    Причина: {cancelLabel}
                  </span>
                )}
              </div>

              {product && (
                <Card className="p-4 border-slate-200 bg-slate-50/70">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-white border border-slate-200">
                      {imageUrl ? (
                        <CatalogProductImage src={imageUrl} alt={product.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-black text-slate-950 leading-snug">{product.name}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        {[product.brands?.name, product.product_types?.name, product.model_code?.trim()].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="font-bold text-slate-900">{fmtMoney(product.price ?? null)}</span>
                        {product.price_with_mount != null && (
                          <span className="text-slate-600">с монтаж: {fmtMoney(product.price_with_mount)}</span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ProductQuickViewButton
                          productId={product.id}
                          productName={product.name}
                          className="text-xs font-bold text-brand-blue-700"
                        />
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-brand-blue-700"
                        >
                          Отвори в админ <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                  {(product.indoor_unit_serial || product.outdoor_unit_serial) && (
                    <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                      <div>
                        <span className="text-slate-500">SN вътрешно:</span>{" "}
                        <span className="font-mono">{product.indoor_unit_serial || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">SN външно:</span>{" "}
                        <span className="font-mono">{product.outdoor_unit_serial || "—"}</span>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              <Card className="p-4 border-slate-200">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500 mb-3">Клиент</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoRow label="Име" value={sale.customer_name || contact?.full_name || "—"} />
                  <InfoRow label="Телефон" value={sale.customer_phone || contact?.phone || "—"} />
                  <InfoRow label="Имейл" value={contact?.email || "—"} />
                  <InfoRow label="Адрес" value={sale.customer_address || contact?.address || "—"} />
                </div>
              </Card>

              <Card className="p-4 border-slate-200">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500 mb-3">Продажба</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoRow label="Стойност" value={fmtMoney(amount)} />
                  <InfoRow label="Количество" value={sale.quantity ?? 1} />
                  <InfoRow label="Записана на" value={fmtBgDateTime(sale.created_at)} />
                  <InfoRow label="Планиран монтаж" value={fmtBgDate(sale.due_date)} />
                  {sale.completed_at && <InfoRow label="Завършена на" value={fmtBgDateTime(sale.completed_at)} />}
                  {sale.status === "cancelled" && cancelLabel && (
                    <InfoRow label="Причина за отказ" value={cancelLabel} />
                  )}
                </div>
                {sale.notes?.trim() && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Бележки</div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{sale.notes}</div>
                  </div>
                )}
              </Card>

              {installation && (
                <Card className="p-4 border-brand-blue-100 bg-brand-blue-50/30">
                  <div className="text-xs font-black uppercase tracking-wide text-brand-blue-800 mb-3">Монтаж в календара</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoRow label="Задача" value={installation.title || "—"} />
                    <InfoRow label="Статус" value={installation.status} />
                    <InfoRow label="Дата" value={fmtBgDate(installation.due_date)} />
                    <InfoRow label="Час" value={`${fmtBgDateTime(installation.scheduled_start)} – ${fmtBgDateTime(installation.scheduled_end)}`} />
                  </div>
                  {installation.notes?.trim() && (
                    <div className="mt-3 pt-3 border-t border-brand-blue-100/80 text-sm text-slate-700 whitespace-pre-wrap">
                      {installation.notes}
                    </div>
                  )}
                </Card>
              )}

              {protocol && (
                <Card className="p-4 border-violet-100 bg-violet-50/40">
                  <div className="text-xs font-black uppercase tracking-wide text-violet-800 mb-2">Приемно-предавателен протокол</div>
                  <div className="text-sm font-semibold text-slate-900">{protocol.protocol_number}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    Дата: {fmtBgDate(protocol.date)} · Статус: {protocol.status}
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/admin/service/documents/acceptance?edit=${protocol.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-800 hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Отвори протокола
                    </Link>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 shrink-0 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Затвори
          </Button>
        </div>
      </div>
    </div>
  );
}
