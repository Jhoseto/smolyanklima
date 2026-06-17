"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Receipt,
  Hash,
  Mail,
} from "lucide-react";
import { canRecordProductSale } from "@/lib/admin/recordProductSale";
import { Button, Input, AdminPhoneLink } from "./ui";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";
import { CatalogProductImage } from "@/app/admin/components/CatalogProductImage";
import { ProductQuickViewButton } from "./ProductQuickView";
import {
  agreedPriceAfterDiscount,
  discountPercentFromAgreedPrice,
  formatAgreedPriceInput,
  parseDecimalInput,
} from "@/lib/admin/agreedPriceDiscount";
import type { NormalizedSupplierOrderRow } from "@/lib/admin/supplierOrderRow";
import { publicProductOrCatalogUrl } from "@/lib/publicCatalogUrl";

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

type SerialMatch = { id: string; name: string; slug: string | null; field: "indoor" | "outdoor" | "both" };

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function SerialDupNotice({ matches }: { matches: SerialMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <p className="mt-1 text-[11px] font-medium text-amber-800">
      Вече записан при:{" "}
      {matches.map((m, i) => (
        <span key={m.id}>
          {i > 0 ? ", " : null}
          <Link href={`/admin/products/${m.id}`} className="underline hover:text-amber-950" target="_blank">
            {m.name}
          </Link>
        </span>
      ))}
    </p>
  );
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

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 font-semibold text-slate-800 ${mono ? "font-mono text-xs" : "text-sm"}`}>
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}

export function SupplierOrderDetailModal({
  orderId,
  onClose,
  onCancelled,
  onUpdated,
  onFulfilled,
  onRequestSale,
}: {
  orderId: string;
  onClose: () => void;
  onCancelled: (orderId: string) => void;
  onUpdated?: (order: NormalizedSupplierOrderRow) => void;
  /** След доставка — остава в панела вместо redirect към продукт. */
  onFulfilled?: (productInstanceId: string) => void;
  onRequestSale?: (order: NormalizedSupplierOrderRow) => void;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<NormalizedSupplierOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [agreedDraft, setAgreedDraft] = useState("");
  const [agreedDiscountPct, setAgreedDiscountPct] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceSaved, setPriceSaved] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [cancelStep, setCancelStep] = useState<"idle" | "confirm">("idle");
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [indoorSerial, setIndoorSerial] = useState("");
  const [outdoorSerial, setOutdoorSerial] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [purchasePriceDraft, setPurchasePriceDraft] = useState("");
  const [indoorDup, setIndoorDup] = useState<SerialMatch[]>([]);
  const [outdoorDup, setOutdoorDup] = useState<SerialMatch[]>([]);
  useAdminBackHandler(cancelStep === "idle", onClose, `supplier-order-${orderId}`);
  useAdminBackHandler(cancelStep === "confirm", () => setCancelStep("idle"), `supplier-order-cancel-${orderId}`);
  const debouncedIndoor = useDebouncedValue(indoorSerial.trim(), 350);
  const debouncedOutdoor = useDebouncedValue(outdoorSerial.trim(), 350);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setImgError(false);
    setCancelStep("idle");
    setActionError(null);
    setIndoorSerial("");
    setOutdoorSerial("");
    setInvoiceNumber("");
    setPurchasedAt(new Date().toISOString().slice(0, 10));
    setPurchasePriceDraft("");
    setIndoorDup([]);
    setOutdoorDup([]);
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
        const catalog = row?.products?.price != null ? Number(row.products.price) : NaN;
        const agreed = row?.unit_price != null ? Number(row.unit_price) : NaN;
        setAgreedDraft(Number.isFinite(agreed) ? formatAgreedPriceInput(agreed) : "");
        setAgreedDiscountPct(
          Number.isFinite(catalog) && Number.isFinite(agreed)
            ? discountPercentFromAgreedPrice(catalog, agreed)
            : "",
        );
        const purchaseHint =
          row?.purchase_price != null
            ? Number(row.purchase_price)
            : row?.products?.purchase_price != null
              ? Number(row.products.purchase_price)
              : NaN;
        setPurchasePriceDraft(Number.isFinite(purchaseHint) ? formatAgreedPriceInput(purchaseHint) : "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!debouncedIndoor) {
      setIndoorDup([]);
      return;
    }
    const ctrl = new AbortController();
    const url = new URL("/api/admin/products/check-serial", window.location.origin);
    url.searchParams.set("serial", debouncedIndoor);
    fetch(url.toString(), { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ data: [] })))
      .then((j: { data?: SerialMatch[] }) => setIndoorDup(j.data ?? []))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [debouncedIndoor]);

  useEffect(() => {
    if (!debouncedOutdoor) {
      setOutdoorDup([]);
      return;
    }
    const ctrl = new AbortController();
    const url = new URL("/api/admin/products/check-serial", window.location.origin);
    url.searchParams.set("serial", debouncedOutdoor);
    fetch(url.toString(), { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ data: [] })))
      .then((j: { data?: SerialMatch[] }) => setOutdoorDup(j.data ?? []))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [debouncedOutdoor]);

  const deliveryIncomplete =
    !purchasedAt.trim() ||
    !purchasePriceDraft.trim() ||
    !Number.isFinite(parseDecimalInput(purchasePriceDraft)) ||
    parseDecimalInput(purchasePriceDraft) < 0;
  const deliveryHasDup = indoorDup.length > 0 || outdoorDup.length > 0;
  const canMarkDelivered = !deliveryIncomplete && !deliveryHasDup;

  const deliveryHint = useMemo(() => {
    if (deliveryHasDup) return "Серийните номера вече съществуват при друг продукт.";
    if (deliveryIncomplete) return "Попълнете дата на доставка и доставна цена преди да отбележите получаване.";
    return null;
  }, [deliveryHasDup, deliveryIncomplete]);

  const prod = order?.products;
  const specs = prod?.product_specs;
  const mainImage = imgError ? null : pickMainImage(prod?.product_images);
  const catalogUrl = publicProductOrCatalogUrl(prod ?? null);
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
    if (!canMarkDelivered) {
      setActionError(deliveryHint ?? "Попълнете данните за доставка.");
      return;
    }
    setActionError(null);
    setDelivering(true);
    try {
      const purchasePrice = parseDecimalInput(purchasePriceDraft);
      const res = await fetch(`/api/admin/supplier-orders/${order.id}/fulfill`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indoorUnitSerial: indoorSerial.trim(),
          outdoorUnitSerial: outdoorSerial.trim(),
          supplierInvoiceNumber: invoiceNumber.trim(),
          purchasedAt: purchasedAt.trim(),
          purchasePrice,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((json as { error?: string }).error ?? "Грешка при записване на доставката");
        return;
      }
      const productInstanceId = (json as { data?: { productInstanceId?: string } }).data?.productInstanceId;
      if (productInstanceId) {
        onFulfilled?.(productInstanceId);
        onClose();
        router.push(`/admin/products?focusProductId=${encodeURIComponent(productInstanceId)}`);
      } else {
        onClose();
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
  const catalogPurchasePrice = prod?.purchase_price ?? order?.purchase_price ?? null;
  const headerDate = order?.due_date ? formatBgDate(order.due_date) : order ? formatBgDateTime(order.created_at) : "";
  const isArchived = order?.status === "done" || order?.status === "cancelled";
  const delivered = order?.delivered_product ?? null;

  const phaseLabel =
    order?.status === "cancelled" ? "Отказана" : order?.status === "done" ? "Доставена" : "Поръчана";
  const phaseClass =
    order?.status === "done"
      ? "bg-green-100 text-green-800 border-green-200"
      : order?.status === "cancelled"
        ? "bg-red-100 text-red-800 border-red-200"
        : "bg-violet-100 text-violet-900 border-violet-200";

  const linkBtnClass =
    "inline-flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2.5 min-h-[44px] text-[11px] font-bold text-violet-800 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/60 p-0 md:p-3 backdrop-blur-md"
      data-admin-overlay="true"
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-y-auto overscroll-contain rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] max-h-[92dvh] md:max-h-[calc(100vh-2rem)] pb-safe md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-violet-50/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 shrink-0 text-violet-600" />
              <h2 className="text-base font-bold text-slate-900">
                {isArchived ? "Детайли за поръчка" : "Поръчка от доставчик"}
              </h2>
            </div>
            {!loading && !loadError && order && (
              <p className="mt-0.5 pl-7 text-xs text-slate-500">{headerDate}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
            aria-label="Затвори"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Съдържание — един общ скрол за целия модал (горе → долу) */}
        <div className="px-5 py-4">
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
                  <ProductQuickViewButton
                    productId={order.product_id ?? prod?.id ?? null}
                    productName={prod?.name ?? order.title}
                    className="line-clamp-2 text-sm font-bold leading-snug text-slate-900"
                  />
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

              {/* Статус и идентификатор */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${phaseClass}`}>
                    {phaseLabel}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {order.status === "done"
                      ? "Изпълнена"
                      : order.status === "cancelled"
                        ? "Отказана"
                        : order.status === "in_progress"
                          ? "В процес"
                          : "Планирана"}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <Hash className="h-3 w-3 shrink-0" />
                    <span className="font-mono text-slate-600">{order.id}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 shrink-0" />
                    Създадена: {formatBgDateTime(order.created_at)}
                    {order.due_date ? ` · Поръчана за: ${formatBgDate(order.due_date)}` : ""}
                  </p>
                </div>
              </div>

              {/* Supplier */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <FieldLabel label="Доставчик" icon={<Store className="h-3 w-3" />} />
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {prod?.supplier_name ?? "—"}
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
                  {isArchived ? (
                    <p className="mt-1 text-lg font-black text-violet-900">
                      {order.unit_price != null ? fmtMoney(order.unit_price) : "—"}
                    </p>
                  ) : (
                    <>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="grid gap-1">
                          <span className="text-[10px] font-bold text-violet-800/80">Отстъпка (%)</span>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={agreedDiscountPct}
                            onChange={(e) => {
                              const pctStr = e.target.value;
                              setAgreedDiscountPct(pctStr);
                              const catalog = catalogPrice ?? NaN;
                              const pct = parseDecimalInput(pctStr);
                              if (pctStr.trim() === "" || !Number.isFinite(catalog)) return;
                              setAgreedDraft(formatAgreedPriceInput(agreedPriceAfterDiscount(catalog, pct)));
                            }}
                            placeholder="0"
                            className="text-sm"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-bold text-violet-800/80">Цена (€)</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={agreedDraft}
                            onChange={(e) => {
                              const agreedStr = e.target.value;
                              setAgreedDraft(agreedStr);
                              const catalog = catalogPrice ?? NaN;
                              const agreed = parseDecimalInput(agreedStr);
                              if (agreedStr.trim() === "" || !Number.isFinite(catalog)) {
                                setAgreedDiscountPct("");
                                return;
                              }
                              setAgreedDiscountPct(discountPercentFromAgreedPrice(catalog, agreed));
                            }}
                            placeholder="0"
                            className="text-sm"
                          />
                        </label>
                      </div>
                      <div className="mt-2 flex gap-2">
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
                    </>
                  )}
                </div>
              </div>

              {/* Client */}
              <div className="space-y-2 rounded-2xl border border-slate-100 px-4 py-3">
                <FieldLabel label="Клиент" icon={<User className="h-3 w-3" />} />
                <p className="text-sm font-semibold text-slate-900">{customerName ?? "—"}</p>
                {customerPhone ? (
                  <AdminPhoneLink phone={customerPhone} className="text-sm text-[#0077B6]" />
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
                {customerAddress ? (
                  <p className="flex items-start gap-1.5 text-sm text-slate-600">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {customerAddress}
                  </p>
                ) : null}
                {order.contacts?.email ? (
                  <a
                    href={`mailto:${order.contacts.email}`}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#0077B6]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {order.contacts.email}
                  </a>
                ) : null}
              </div>

              {delivered && (
                <div className="space-y-3 rounded-2xl border border-green-200 bg-green-50/40 px-4 py-3">
                  <FieldLabel label="Доставена бройка" className="text-green-800" />
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <InfoRow label="Сериен № вътрешно" value={delivered.indoor_unit_serial} mono />
                    <InfoRow label="Сериен № външно" value={delivered.outdoor_unit_serial} mono />
                    <InfoRow
                      label="Дата на доставка"
                      value={delivered.purchased_at ? formatBgDate(delivered.purchased_at) : null}
                    />
                    <InfoRow label="Фактура доставчик" value={delivered.supplier_invoice_number} />
                    <InfoRow
                      label="Закупна цена"
                      value={delivered.purchase_price != null ? fmtMoney(delivered.purchase_price) : null}
                    />
                    <InfoRow label="Продажна цена" value={delivered.price != null ? fmtMoney(delivered.price) : null} />
                    <InfoRow label="Склад" value={delivered.stock_status} />
                  </div>
                  <Link
                    href={`/admin/products/${delivered.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-green-800 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Редактирай продукта
                  </Link>
                </div>
              )}

              {order.notes?.trim() ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Бележки</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-900">{order.notes.trim()}</p>
                </div>
              ) : null}

              {actionError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {actionError}
                </p>
              )}

              <div className="space-y-3 border-t border-slate-100 pt-4">
                {isArchived && delivered && onRequestSale && canRecordProductSale(delivered.stock_status) && (
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full gap-1.5"
                    onClick={() => onRequestSale(order)}
                  >
                    <Receipt className="h-4 w-4" />
                    Запиши продажба
                  </Button>
                )}
                {isArchived && (
                  <Button variant="secondary" size="md" className="w-full" onClick={onClose}>
                    Затвори
                  </Button>
                )}
                {!isArchived && (
                  <div className="rounded-2xl border border-violet-200 bg-white px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
                      Данни при получаване
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Задължителни: дата на доставка и доставна цена. Серийните номера и фактурата могат да се
                      попълнят по-късно.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <FieldLabel label="Сериен № вътрешно (по избор)" className="text-slate-500" />
                        <Input
                          value={indoorSerial}
                          onChange={(e) => setIndoorSerial(e.target.value)}
                          placeholder="от табелката"
                          className={indoorDup.length > 0 ? "border-amber-400" : ""}
                        />
                        <SerialDupNotice matches={indoorDup} />
                      </div>
                      <div>
                        <FieldLabel label="Сериен № външно (по избор)" className="text-slate-500" />
                        <Input
                          value={outdoorSerial}
                          onChange={(e) => setOutdoorSerial(e.target.value)}
                          placeholder="от табелката"
                          className={outdoorDup.length > 0 ? "border-amber-400" : ""}
                        />
                        <SerialDupNotice matches={outdoorDup} />
                      </div>
                      <div>
                        <FieldLabel label="Дата на доставка *" className="text-slate-500" />
                        <Input
                          type="date"
                          value={purchasedAt}
                          onChange={(e) => setPurchasedAt(e.target.value)}
                          className={deliveryIncomplete && !purchasedAt.trim() ? "border-red-400" : ""}
                        />
                      </div>
                      <div>
                        <FieldLabel label="Фактура доставчик (по избор)" className="text-slate-500" />
                        <Input
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          placeholder="напр. 0000123456"
                        />
                      </div>
                      <div>
                        <FieldLabel label="Доставна цена (€) *" className="text-slate-500" />
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={purchasePriceDraft}
                          onChange={(e) => setPurchasePriceDraft(e.target.value)}
                          placeholder="0"
                          className={
                            deliveryIncomplete &&
                            (!purchasePriceDraft.trim() ||
                              !Number.isFinite(parseDecimalInput(purchasePriceDraft)) ||
                              parseDecimalInput(purchasePriceDraft) < 0)
                              ? "border-red-400"
                              : ""
                          }
                        />
                        {catalogPurchasePrice != null && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            От каталога: {fmtMoney(catalogPurchasePrice)}
                          </p>
                        )}
                      </div>
                    </div>
                    {deliveryHint && (
                      <p className="mt-2 text-[11px] font-semibold text-amber-800">{deliveryHint}</p>
                    )}
                  </div>
                )}
                {!isArchived && cancelStep === "confirm" && (
                  <p className="text-center text-xs font-semibold text-red-700">
                    Сигурни ли сте? Поръчката ще бъде отказана.
                  </p>
                )}
                {!isArchived && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    <Button
                      variant="danger"
                      size="md"
                      className="flex-1 min-w-[140px]"
                      onClick={() => void handleCancel()}
                      disabled={cancelling || delivering}
                    >
                      {cancelling ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      {cancelStep === "confirm" ? "Потвърди отказ" : "Откажи поръчката"}
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1 min-w-[160px] gap-1.5 bg-violet-600 hover:bg-violet-700 focus:ring-violet-500"
                      onClick={() => void handleDelivered()}
                      disabled={delivering || cancelling || !canMarkDelivered}
                      title={!canMarkDelivered ? (deliveryHint ?? undefined) : undefined}
                    >
                      {delivering ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PackageCheck className="h-4 w-4" />
                      )}
                      Продуктът е доставен
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
