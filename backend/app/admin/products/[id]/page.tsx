"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const id = params.id;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
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
      const role = (w.data?.admin?.role as string) ?? "master_admin";
      setCanEditPrice(role === "master_admin");
      setCanEditStockLocation(role === "master_admin" || role === "office_staff");
      if (!pRes.ok) throw new Error(p.error || "Failed to load product");
      setForm(mapLoadedProductToForm(p.data));
    })()
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function doSave() {
    setError(null);
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
      setToast({ kind: "ok", text: "Запазено" });
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

  if (loading) return <div className="flex items-center justify-center p-12 text-slate-500 font-medium">Зареждане...</div>;

  return (
    <div className="w-full max-w-none space-y-4 pb-24 md:pb-4">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border font-bold text-sm transition-all ${
            toast.kind === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      )}
      
      <div>
        <h1 className="text-lg md:text-xl font-bold text-slate-900 mb-1 leading-tight">
          <SectionTitle title="Редакция на продукт" hint="Промяна на параметри, наличности и медия на съществуващ продукт." />
        </h1>
      </div>

      <HelpCard>
        <HelpRow items={["Запис запазва всички промени в картата", "Изтрий премахва продукта и свързаните му публични данни", "Магазин/склад и каталог-статус са отделни полета"]} />
      </HelpCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      )}

      <Card className="p-4 md:p-6">
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
        />
      </Card>

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
      <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex gap-2">
          <Button variant="danger" onClick={remove} className="gap-1.5 shrink-0 !py-3 text-xs">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="primary" className="flex-1 justify-center gap-2 !py-3 text-sm font-bold" onClick={save} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? "Запазвам..." : "Запази промените"}
          </Button>
        </div>
      </div>

      {pendingPhotosConfirm && (
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

      {confirmDelete && (
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
