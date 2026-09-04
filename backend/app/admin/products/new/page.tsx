"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductFormFields, emptyProductForm, buildPostBody, type AdminProductForm } from "../ProductForm";
import { SectionTitle, Card, Button } from "../../ui";
import { Save } from "lucide-react";

/** Максимален брой еднакви бройки, добавяни наведнъж (защита от грешка в полето). */
const MAX_BULK_QUANTITY = 50;

type Brand = { id: string; name: string };
type ProductType = { id: string; name: string };
type SupplierRow = { id: string; full_name: string };
type ContainerRow = { id: string; name: string };

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [canEditPrice, setCanEditPrice] = useState(true);
  const [canEditStockLocation, setCanEditStockLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AdminProductForm>(emptyProductForm);
  // Брой неприбрани (в preview, но не качени) снимки. Save-action-ът
  // проверява тази стойност и показва confirm dialog преди да продължи.
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [pendingPhotosConfirm, setPendingPhotosConfirm] = useState<null | { proceed: () => void }>(null);
  const [highlightRequired, setHighlightRequired] = useState(false);
  // Бройки без сериен № (само за „Втора употреба“) — вж. bulkQuantity() по-долу.
  const [bulkQuantity, setBulkQuantity] = useState("1");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      const [bRes, tRes, wRes, sRes, cRes] = await Promise.all([
        fetch("/api/admin/meta/brands", { credentials: "include" }),
        fetch("/api/admin/meta/product-types", { credentials: "include" }),
        fetch("/api/admin/whoami", { credentials: "include" }),
        fetch("/api/admin/contacts?kind=supplier&perPage=200", { credentials: "include" }),
        fetch("/api/admin/containers?perPage=200", { credentials: "include" }),
      ]);
      const b = await bRes.json();
      const t = await tRes.json();
      const w = await wRes.json();
      const s = await sRes.json();
      const c = await cRes.json().catch(() => ({}));
      setBrands(b.data ?? []);
      setTypes(t.data ?? []);
      setSuppliers(
        (s.data ?? []).map((row: { id: string; full_name: string }) => ({
          id: row.id,
          full_name: row.full_name,
        })),
      );
      setContainers(
        ((c as { data?: { id: string; name: string }[] }).data ?? []).map((row) => ({ id: row.id, name: row.name })),
      );
      const role = (w.data?.admin?.role as string) ?? "master_admin";
      setCanEditPrice(role === "master_admin" || role === "service_staff");
      setCanEditStockLocation(role === "master_admin" || role === "office_staff");
      // Default type: „Стенни климатици“ — това е най-често продаваният
      // вид и почти всеки нов запис е стенен климатик. Така спестяваме
      // едно кликане на потребителя. Ако този тип липсва (rare edge case),
      // fallback-ваме на първия от списъка.
      const typesList: Array<{ id: string; name: string }> = t.data ?? [];
      const wallType =
        typesList.find((row) => /стен/i.test(row.name)) ??
        typesList.find((row) => /wall/i.test(row.name)) ??
        typesList[0];
      setForm((prev) => ({
        ...prev,
        // Полето „Марка“ е празно по default — потребителят сам избира от
        // комбобокса или го въвежда нов. (Преди тук се избираше първата
        // марка автоматично, което създаваше confusion при нов продукт.)
        brandId: "",
        typeId: wallType?.id ?? "",
      }));
    })().catch((e) => setError(String(e?.message ?? e)));
  }, []);

  /** Ефективен брой бройки за създаване. > 1 само при „Втора употреба“ —
   *  партида еднакви климатици без серийни номера (виж disableSerialFields). */
  const isBulkUsedBatch = form.productCondition === "used";
  const effectiveQuantity = isBulkUsedBatch
    ? Math.min(MAX_BULK_QUANTITY, Math.max(1, parseInt(bulkQuantity, 10) || 1))
    : 1;

  async function postOneProduct(body: Record<string, unknown>): Promise<{ id?: string; error?: string }> {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (json as any)?.error || "Грешка при създаване" };
    }
    return { id: String((json as { data?: { id?: string } })?.data?.id ?? "") };
  }

  // Реалното submit действие — без protection guard. Извиква се след
  // confirm dialog-а (или директно ако няма pending снимки).
  async function doSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const qty = effectiveQuantity;
      const baseBody = buildPostBody(form);
      // При > 1 бройка серийните номера не важат за цялата партида —
      // изчистваме ги (полетата вече са заключени и в UI, виж disableSerialFields).
      if (qty > 1) {
        baseBody.indoorUnitSerial = null;
        baseBody.outdoorUnitSerial = null;
      }

      let created = 0;
      let lastId = "";
      for (let i = 0; i < qty; i++) {
        const result = await postOneProduct(baseBody);
        if (result.error) {
          const msg =
            created > 0
              ? `Добавени ${created} от ${qty} бройки — спряно поради грешка: ${result.error}`
              : result.error;
          setError(msg);
          setToast({ kind: "err", text: msg });
          if (created > 0) router.replace("/admin/products");
          return;
        }
        created += 1;
        lastId = result.id ?? "";
      }

      setToast({ kind: "ok", text: qty > 1 ? `Добавени ${created} бройки` : "Създадено" });
      if (qty > 1) {
        router.replace("/admin/products");
      } else if (lastId) {
        router.replace(`/admin/products?focusProductId=${encodeURIComponent(lastId)}`);
      } else {
        router.replace("/admin/products");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Wrapper за save бутона — валидира задължителните полета (Име + Модел),
  // после ако има неприбрани снимки, иска потвърждение.
  function submit() {
    if (!form.name.trim() || !form.modelCode.trim()) {
      setHighlightRequired(true);
      setError("Попълнете задължителните полета: Име и Модел.");
      return;
    }
    setHighlightRequired(false);
    if (pendingPhotos > 0) {
      setPendingPhotosConfirm({ proceed: () => void doSubmit() });
      return;
    }
    void doSubmit();
  }

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
      
      <div className="md:pt-0">
        <h1 className="text-base md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Нов климатик" />
        </h1>
        <p className="mt-0.5 md:mt-1 text-[12px] md:text-[13px] text-slate-500 leading-snug">
          Марка, модел, снимки и спецификации.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      )}

      <Card className="p-2 sm:p-3 md:p-6 shadow-sm border-slate-200/90 max-md:rounded-lg">
        <ProductFormFields
          brands={brands}
          types={types}
          suppliers={suppliers}
          containers={containers}
          form={form}
          setForm={setForm}
          canEditPrice={canEditPrice}
          canEditStockLocation={canEditStockLocation}
          canEditProductRegion={canEditStockLocation}
          autoPriceWithMountFromCatalog
          onPendingPhotosChange={setPendingPhotos}
          highlightRequired={highlightRequired}
          disableSerialFields={effectiveQuantity > 1}
          bulkQuantityValue={bulkQuantity}
          onBulkQuantityChange={setBulkQuantity}
          bulkQuantityMax={MAX_BULK_QUANTITY}
        />
      </Card>

      {/* Desktop save button */}
      <div className="hidden md:flex justify-end">
        <Button variant="primary" size="lg" onClick={submit} disabled={submitting} className="gap-2 shadow-sm">
          <Save className="w-5 h-5" />
          {submitting
            ? "Създавам..."
            : effectiveQuantity > 1
              ? `Създай ${effectiveQuantity} бройки`
              : "Създай климатик"}
        </Button>
      </div>

      {/* Mobile sticky save bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <Button variant="primary" className="w-full justify-center gap-2 !py-3 text-sm font-bold rounded-xl" onClick={submit} disabled={submitting}>
          <Save className="w-4 h-4" />
          {submitting
            ? "Създавам..."
            : effectiveQuantity > 1
              ? `Създай ${effectiveQuantity} бройки`
              : "Създай климатик"}
        </Button>
      </div>

      {/* Pending-photos protection modal — задейства се при опит за save,
          ако в preview-a има неприбрани в Cloudinary снимки. */}
      {pendingPhotosConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-slate-950/55 backdrop-blur-md"
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
              Ако продължиш сега, продуктът ще се създаде <strong>без тях</strong>. Препоръчително
              е първо да натиснеш бутона „Качи в Cloudinary“ в секцията със снимките.
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
                Създай без качване
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
