"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ExternalLink,
  Truck,
  PackageCheck,
  AlertTriangle,
  User,
  Phone,
  MapPin,
  Calendar,
  Store,
  BookOpen,
  Save,
  Loader2,
  Wind,
} from "lucide-react";
import { Button, Input } from "./ui";
import { CatalogProductImage } from "@/app/admin/components/CatalogProductImage";
import type { NormalizedSupplierOrderRow } from "@/lib/admin/supplierOrderRow";

function formatBgDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("bg-BG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return value ?? "—";
  }
}

function formatBgDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("bg-BG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value ?? "—";
  }
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${Number(n).toLocaleString("bg-BG")}`;
}

function pickMainImage(
  images: Array<{ url: string; is_main: boolean; sort_order: number }> | undefined,
): string | null {
  if (!images?.length) return null;
  const main = images.find((i) => i.is_main);
  if (main) return main.url;
  return [...images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
}

function publicProductUrl(frontendOrigin: string, prod: NormalizedSupplierOrderRow["products"]) {
  const base = frontendOrigin.replace(/\/$/, "");
  if (!prod) return `${base}/catalog`;
  if (prod.slug?.trim()) return `${base}/product/${encodeURIComponent(prod.slug.trim())}`;
  if (prod.id) return `${base}/product/${encodeURIComponent(prod.id)}`;
  return `${base}/catalog`;
}

function FieldLabel({
  label,
  icon,
  className = "text-slate-400",
}: {
  label: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${className}`}>
      {icon}
      {label}
    </div>
  );
}

export function SupplierOrderDetailModal({
  orderId,
  onClose,
  onCancelled,
  onUpdated,
  frontendOrigin = "http://localhost:3000",
}: {
  orderId: string;
  onClose: () => void;
  onCancelled: (orderId: string) => void;
  onUpdated?: (order: NormalizedSupplierOrderRow) => void;
  frontendOrigin?: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<NormalizedSupplierOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [agreedDraft, setAgreedDraft] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceSaved, setPriceSaved] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [cancelStep, setCancelStep] = useState<"idle" | "confirm">("idle");
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setImgError(false);
    setCancelStep("idle");
    setActionError(null);
    (async () => {
      const res = await fetch(`/api/admin/supplier-orders/${orderId}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setLoadError((json as { error?: string }).error ?? "Грешка при зареждане");
        setOrder(null);
      } else {
        const row = (json as { data?: NormalizedSupplierOrderRow }).data ?? null;
        setOrder(row);
        setAgreedDraft(row?.unit_price != null ? String(row.unit_price) : "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const prod = order?.products;
  const specs = prod?.product_specs;
  const mainImage = imgError ? null : pickMainImage(prod?.product_images);
  const catalogUrl = publicProductUrl(frontendOrigin, prod ?? null);
  const supplierUrl = prod?.source_url?.trim() || null;
  const specBadges: { icon: string; text: string }[] = [];
  if (specs?.cooling_power_kw != null) specBadges.push({ icon: "❄️", text: `${specs.cooling_power_kw} kW студ` });
  if (specs?.heating_power_kw != null) specBadges.push({ icon: "🔥", text: `${specs.heating_power_kw} kW топл` });
  if (specs?.coverage_m2 != null) specBadges.push({ icon: "📐", text: `до ${specs.coverage_m2} м²` });
  if (specs?.energy_class_cool) specBadges.push({ icon: "⚡", text: `Кл. ${specs.energy_class_cool}` });
  if (specs?.energy_class_heat) specBadges.push({ icon: "🌡️", text: `Топл. ${specs.energy_class_heat}` });
  if (specs?.btu != null) specBadges.push({ icon: "💨", text: `${specs.btu}K BTU` });
  if (specs?.wifi) specBadges.push({ icon: "📶", text: "Wi-Fi" });

  async function saveAgreedPrice() {
    if (!order) return;
    const num = Number(String(agreedDraft).replace(",", ".").trim());
    if (!Number.isFinite(num) || num < 0) {
      setActionError("Въведете валидна договорена цена.");
      return;
    }
    setActionError(null);
    setSavingPrice(true);
    setPriceSaved(false);
    try {
      const res = await fetch(`/api/admin/work-items/${order.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPrice: num, totalAmount: num }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((json as { error?: string }).error ?? "Грешка при запис на цената");
        return;
      }
      const next = { ...order, unit_price: num };
      setOrder(next);
      setPriceSaved(true);
      onUpdated?.(next);
      setTimeout(() => setPriceSaved(false), 2500);
    } catch (e) {
      setActionError(String((e as Error)?.message ?? "Неочаквана грешка"));
    } finally {
      setSavingPrice(false);
    }
  }

  async function handleDelivered() {
    if (!order) return;
    setActionError(null);
    setDelivering(true);
    try {
      const res = await fetch(`/api/admin/supplier-orders/${order.id}/fulfill`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((json as { error?: string }).error ?? "Грешка при записване на доставката");
        return;
      }
      const productInstanceId = (json as { data?: { productInstanceId?: string } }).data?.productInstanceId;
      onClose();
      if (productInstanceId) {
        router.push(`/admin/products/${productInstanceId}?highlight=delivery`);
      }
    } catch (e) {
      setActionError(String((e as Error)?.message ?? "Неочаквана грешка"));
    } finally {
      setDelivering(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    if (cancelStep === "idle") {
      setCancelStep("confirm");
      return;
    }
    setActionError(null);
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/work-items/${order.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((json as { error?: string }).error ?? "Грешка при отказване");
        setCancelStep("idle");
        return;
      }
      onCancelled(order.id);
      onClose();
    } catch (e) {
      setActionError(String((e as Error)?.message ?? "Неочаквана грешка"));
      setCancelStep("idle");
    } finally {
      setCancelling(false);
    }
  }

  const customerName = order?.customer_name ?? order?.contacts?.full_name ?? null;
  const customerPhone = order?.customer_phone ?? order?.contacts?.phone ?? null;
  const customerAddress = order?.customer_address ?? null;
  const catalogPrice = prod?.price ?? null;
  const purchasePrice = prod?.purchase_price ?? null;
  const headerDate = order?.due_date ? formatBgDate(order.due_date) : order ? formatBgDateTime(order.created_at) : "";

  const linkBtnClass =
    "inline-flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-2 text-[11px] font-bold text-violet-800 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-violet-50/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 shrink-0 text-violet-600" />
              <h2 className="text-base font-bold text-slate-900">Поръчка от доставчик</h2>
            </div>
            {!loading && !loadError && order && (
              <p className="mt-0.5 pl-7 text-xs text-slate-500">{headerDate}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
            aria-label="Затвори"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <p className="text-sm font-medium">Зареждане…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <p className="text-sm font-semibold text-red-800">{loadError}</p>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Затвори
              </Button>
            </div>
          ) : !order ? (
            <p className="py-10 text-center text-sm text-slate-500">Поръчката не е намерена.</p>
          ) : (
            <div className="space-y-4">
              {/* Mini product card */}
              <div className="flex gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-white p-3 shadow-sm">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white">
                  {mainImage ? (
                    <CatalogProductImage
                      src={mainImage}
                      alt={prod?.name ?? ""}
                      fade="thumb"
                      className="h-full w-full p-1"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#00B4D8]">
                      <Wind className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {prod?.brand_name && (
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#00B4D8]">
                      {prod.brand_name}
                    </p>
                  )}
                  <p className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
                    {prod?.name ?? order.title}
                  </p>
                  {prod?.product_type_name && (
                    <p className="mt-0.5 text-xs text-slate-500">{prod.product_type_name}</p>
                  )}
                  {prod?.model_code && (
                    <p className="mt-0.5 font-mono text-[11px] text-slate-400">{prod.model_code}</p>
                  )}
                  {specBadges.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {specBadges.map((b) => (
                        <span
                          key={b.text}
                          className="inline-flex items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80"
                        >
                          <span aria-hidden>{b.icon}</span>
                          {b.text}
                        </span>
                      ))}
                    </div>
                  )}
                  {catalogPrice != null && (
                    <p className="mt-1.5 text-sm font-black text-[#FF4D00]">{fmtMoney(catalogPrice)}</p>
                  )}
                </div>
              </div>

              {/* Link row */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={catalogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkBtnClass}
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  Публичен каталог
                </a>
                {supplierUrl ? (
                  <a
                    href={supplierUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Отвори при доставчика"
                    className={linkBtnClass}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    При доставчика
                  </a>
                ) : (
                  <span
                    className={`${linkBtnClass} cursor-default border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-50`}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    Няма URL при доставчик
                  </span>
                )}
              </div>

              {/* Supplier */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <FieldLabel label="Доставчик" icon={<Store className="h-3 w-3" />} />
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {prod?.supplier_name ?? "—"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Доставна цена:{" "}
                  <span className="font-bold text-slate-800">{fmtMoney(purchasePrice)}</span>
                </p>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <FieldLabel label="Цена в каталога" className="text-slate-500" />
                  <p className="mt-1 text-lg font-black text-slate-900">{fmtMoney(catalogPrice)}</p>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50/40 px-3 py-2.5">
                  <FieldLabel label="Договорена цена" className="text-violet-600" />
                  <div className="mt-1 flex gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={agreedDraft}
                      onChange={(e) => setAgreedDraft(e.target.value)}
                      placeholder="0"
                      className="text-sm"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void saveAgreedPrice()}
                      disabled={savingPrice}
                      className="shrink-0 gap-1"
                    >
                      {savingPrice ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Запази
                    </Button>
                  </div>
                  {priceSaved && (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-600">Записано.</p>
                  )}
                </div>
              </div>

              {/* Client */}
              <div className="space-y-2 rounded-2xl border border-slate-100 px-4 py-3">
                <FieldLabel label="Клиент" icon={<User className="h-3 w-3" />} />
                <p className="text-sm font-semibold text-slate-900">{customerName ?? "—"}</p>
                {customerPhone ? (
                  <a
                    href={`tel:${customerPhone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0077B6] hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {customerPhone}
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
                {customerAddress ? (
                  <p className="flex items-start gap-1.5 text-sm text-slate-600">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {customerAddress}
                  </p>
                ) : null}
              </div>

              {/* Order meta */}
              <div className="space-y-1 text-sm text-slate-600">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700">Дата на поръчка:</span>{" "}
                  {order.due_date ? formatBgDate(order.due_date) : formatBgDateTime(order.created_at)}
                </p>
                {order.notes?.trim() ? (
                  <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Бележки</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-900">{order.notes.trim()}</p>
                  </div>
                ) : null}
              </div>

              {actionError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {actionError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !loadError && order && (
          <div className="shrink-0 space-y-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
            {cancelStep === "confirm" && (
              <p className="text-center text-xs font-semibold text-red-700">
                Сигурни ли сте? Поръчката ще бъде отказана.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="md"
                className="flex-1 min-w-[140px]"
                onClick={() => void handleCancel()}
                disabled={cancelling || delivering}
              >
                {cancelling ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                {cancelStep === "confirm" ? "Потвърди отказ" : "Откажи поръчката"}
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1 min-w-[160px] gap-1.5 bg-violet-600 hover:bg-violet-700 focus:ring-violet-500"
                onClick={() => void handleDelivered()}
                disabled={delivering || cancelling}
              >
                {delivering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PackageCheck className="h-4 w-4" />
                )}
                Продуктът е доставен
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
