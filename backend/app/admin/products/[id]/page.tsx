"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ProductFormFields,
  emptyProductForm,
  mapLoadedProductToForm,
  buildPutBody,
  type AdminProductForm,
} from "../ProductForm";
import { HelpRow, SectionTitle, HelpCard, Card, Button } from "../../ui";
import { Save, Trash2 } from "lucide-react";

type Brand = { id: string; name: string };
type ProductType = { id: string; name: string };
type SupplierRow = { id: string; full_name: string };

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightDelivery = searchParams.get("highlight") === "delivery";
  const id = params.id;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [role, setRole] = useState<string>("master_admin");
  const [canEditPrice, setCanEditPrice] = useState(true);
  const [canEditStockLocation, setCanEditStockLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AdminProductForm>(emptyProductForm);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Брой неприбрани (preview, но не качени) снимки.
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [pendingPhotosConfirm, setPendingPhotosConfirm] = useState<null | { proceed: () => void }>(null);
  const [isDeliveredInstance, setIsDeliveredInstance] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bRes, tRes, pRes, wRes, sRes] = await Promise.all([
        fetch("/api/admin/meta/brands", { credentials: "include" }),
        fetch("/api/admin/meta/product-types", { credentials: "include" }),
        fetch(`/api/admin/products/${id}`, { credentials: "include" }),
        fetch("/api/admin/whoami", { credentials: "include" }),
        fetch("/api/admin/contacts?kind=supplier&perPage=200", { credentials: "include" }),
      ]);
      const b = await bRes.json();
      const t = await tRes.json();
      const p = await pRes.json();
      const w = await wRes.json();
      const s = await sRes.json();
      setBrands(b.data ?? []);
      setTypes(t.data ?? []);
      setSuppliers(
        (s.data ?? []).map((row: { id: string; full_name: string }) => ({
          id: row.id,
          full_name: row.full_name,
        })),
      );
      const r = (w.data?.admin?.role as string) ?? "master_admin";
      setRole(r);
      setCanEditPrice(r === "master_admin");
      setCanEditStockLocation(r === "master_admin" || r === "office_staff");
      if (!pRes.ok) throw new Error(p.error || "Failed to load product");
      const productData = p.data as {
        purchase_price?: number | null;
        supplier_order_work_item_id?: string | null;
      };
      let nextForm = mapLoadedProductToForm(p.data);
      const orderWorkItemId = productData.supplier_order_work_item_id;
      const missingPurchase =
        productData.purchase_price == null || !Number.isFinite(Number(productData.purchase_price));
      if (orderWorkItemId && missingPurchase) {
        const oRes = await fetch(`/api/admin/work-items/${orderWorkItemId}`, { credentials: "include" });
        const oJson = (await oRes.json().catch(() => ({}))) as {
          data?: { work_item?: { unit_price?: number | null } };
        };
        const agreed = oJson.data?.work_item?.unit_price;
        if (typeof agreed === "number" && Number.isFinite(agreed) && agreed >= 0) {
          nextForm = { ...nextForm, purchasePrice: String(agreed) };
        }
      }
      setForm(nextForm);
      setIsDeliveredInstance(Boolean(orderWorkItemId));
    })()
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function checkSerialDup(serial: string): Promise<boolean> {
    if (!serial.trim()) return false;
    const url = new URL("/api/admin/products/check-serial", window.location.origin);
    url.searchParams.set("serial", serial.trim());
    url.searchParams.set("excludeId", id);
    const res = await fetch(url.toString(), { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { data?: unknown[] };
    return Array.isArray(json.data) && json.data.length > 0;
  }

  async function doSave() {
    setError(null);

    const needsDelivery = isDeliveredInstance || highlightDelivery;
    if (needsDelivery) {
      if (!form.indoorUnitSerial.trim()) {
        setError("Въведете сериен номер на вътрешното тяло.");
        setToast({ kind: "err", text: "Въведете сериен номер на вътрешното тяло." });
        return;
      }
      if (!form.outdoorUnitSerial.trim()) {
        setError("Въведете сериен номер на външното тяло.");
        setToast({ kind: "err", text: "Въведете сериен номер на външното тяло." });
        return;
      }
      if (!form.purchasedAt.trim()) {
        setError("Въведете дата на доставка.");
        setToast({ kind: "err", text: "Въведете дата на доставка." });
        return;
      }
      if (!form.supplierInvoiceNumber.trim()) {
        setError("Въведете номер на фактура от доставчик.");
        setToast({ kind: "err", text: "Въведете номер на фактура от доставчик." });
        return;
      }
      const [indoorDup, outdoorDup] = await Promise.all([
        checkSerialDup(form.indoorUnitSerial),
        checkSerialDup(form.outdoorUnitSerial),
      ]);
      if (indoorDup || outdoorDup) {
        const msg = "Сериен номерът вече е записан при друг продукт.";
        setError(msg);
        setToast({ kind: "err", text: msg });
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPutBody(form)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as any)?.error || "Грешка при запис";
        setError(msg);
        setToast({ kind: "err", text: msg });
        return json;
      }
      router.push("/admin/products");
      return json;
    } finally {
      setSaving(false);
    }
  }

  // Wrapper за save бутона — ако има pending снимки, иска потвърждение.
  function save() {
    if (pendingPhotos > 0) {
      setPendingPhotosConfirm({ proceed: () => void doSave() });
      return;
    }
    void doSave();
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Грешка");
    else router.push("/admin/products");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 md:p-12 text-slate-500 text-sm font-medium">
        Зареждане...
      </div>
    );
  }

  const readOnly = role === "service_staff";

  return (
    <div className="w-full max-w-none space-y-3 pb-24 md:space-y-4 md:pb-4">
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
      
      <div>
        <h1 className="text-base md:text-xl font-bold text-slate-900 mb-0.5 md:mb-1 leading-tight">
          <SectionTitle
            title={readOnly ? "Преглед на продукт" : "Редакция на продукт"}
            hint={
              readOnly
                ? "Само за четене. За промени по картата обърнете се към офис или главен администратор."
                : "Промяна на параметри, наличности и медия на съществуващ продукт."
            }
          />
        </h1>
      </div>

      {!readOnly && (
        <HelpCard className="!p-2.5 md:!p-3">
          <HelpRow items={["Запис запазва всички промени в картата", "Изтрий премахва продукта и свързаните му публични данни", "Магазин/склад и каталог-статус са отделни полета"]} />
        </HelpCard>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg md:rounded-xl p-3 text-sm font-medium">
          {error}
        </div>
      )}

      {(highlightDelivery || isDeliveredInstance) && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-4 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-red-900">Попълнете данните за доставената единица</div>
            <div className="mt-1 text-xs text-red-700">
              Намерете секцията <strong>„Серийни номера и доставчик"</strong> по-долу и попълнете серийните номера (вътрешно / външно тяло), дата на доставка и номер на фактура. След запис продуктът ще е готов за продажба.
            </div>
          </div>
        </div>
      )}

      <Card className="p-2 sm:p-3 md:p-6 shadow-sm border-slate-200/90 max-md:rounded-lg">
        <ProductFormFields
          brands={brands}
          types={types}
          suppliers={suppliers}
          form={form}
          setForm={setForm}
          canEditPrice={canEditPrice}
          canEditStockLocation={canEditStockLocation}
          canEditProductRegion={canEditStockLocation}
          currentProductId={id}
          onPendingPhotosChange={setPendingPhotos}
          readOnly={readOnly}
          highlightDelivery={highlightDelivery || isDeliveredInstance}
        />
      </Card>

      {!readOnly && (
        <>
          {/* Desktop action row */}
          <div className="hidden md:flex justify-between items-center pt-2">
            <Button variant="danger" onClick={remove} className="gap-2">
              <Trash2 className="w-4 h-4" /> Изтрий продукт
            </Button>
            <Button variant="primary" size="lg" onClick={save} disabled={saving} className="gap-2 shadow-sm">
              <Save className="w-5 h-5" />
              {saving ? "Запазвам..." : "Запази промените"}
            </Button>
          </div>

          {/* Mobile sticky save bar */}
          <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <div className="flex gap-2">
              <Button variant="danger" onClick={remove} className="gap-1.5 shrink-0 !py-3 text-xs rounded-xl" title="Изтрий продукт">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="primary" className="flex-1 justify-center gap-2 !py-3 text-sm font-bold rounded-xl" onClick={save} disabled={saving}>
                <Save className="w-4 h-4" />
                {saving ? "Запазвам..." : "Запази промените"}
              </Button>
            </div>
          </div>
        </>
      )}

      {!readOnly && pendingPhotosConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-slate-950/55 backdrop-blur-md"
          onClick={() => setPendingPhotosConfirm(null)}
        >
          <div
            className="w-full md:max-w-lg overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="border-b border-slate-100 bg-amber-50/60 px-6 py-5">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">
                Внимание
              </div>
              <div className="mt-1 text-xl md:text-2xl font-black leading-tight text-slate-950">
                Имаш {pendingPhotos} {pendingPhotos === 1 ? "снимка" : "снимки"} в preview
              </div>
            </div>
            <div className="p-6 text-sm text-slate-700 leading-6">
              {pendingPhotos === 1
                ? "Тази снимка все още не е качена в Cloudinary."
                : "Тези снимки все още не са качени в Cloudinary."}{" "}
              Ако продължиш сега, промените ще се запишат <strong>без тях</strong>. Препоръчително
              е първо да натиснеш „Качи в Cloudinary“ в секцията със снимките.
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button
                variant="secondary"
                onClick={() => setPendingPhotosConfirm(null)}
                className="sm:order-1 order-2"
              >
                Назад към снимките
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const cb = pendingPhotosConfirm.proceed;
                  setPendingPhotosConfirm(null);
                  cb();
                }}
                className="sm:order-2 order-1 gap-2"
              >
                <Save className="w-4 h-4" />
                Запази без качване
              </Button>
            </div>
          </div>
        </div>
      )}

      {!readOnly && confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-slate-950/55 backdrop-blur-md" onClick={() => setConfirmDelete(false)}>
          <div className="w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-white/70 bg-white p-6 shadow-[0_-8px_40px_rgba(15,23,42,0.25)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3 md:hidden"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
            <div className="text-xl font-black text-slate-950">Изтриване на продукт</div>
            <div className="mt-2 text-sm text-slate-500">Сигурни ли сте, че искате да изтриете този продукт и свързаните му данни?</div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Отказ</Button>
              <Button variant="danger" onClick={() => void remove()}>Изтрий</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
