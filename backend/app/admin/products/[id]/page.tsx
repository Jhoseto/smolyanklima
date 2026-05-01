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

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AdminProductForm>(emptyProductForm);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bRes, tRes, pRes] = await Promise.all([
        fetch("/api/admin/meta/brands", { credentials: "include" }),
        fetch("/api/admin/meta/product-types", { credentials: "include" }),
        fetch(`/api/admin/products/${id}`, { credentials: "include" }),
      ]);
      const b = await bRes.json();
      const t = await tRes.json();
      const p = await pRes.json();
      setBrands(b.data ?? []);
      setTypes(t.data ?? []);
      if (!pRes.ok) throw new Error(p.error || "Failed to load product");
      setForm(mapLoadedProductToForm(p.data));
    })()
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
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
    <div className="w-full max-w-none space-y-4">
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
        <h1 className="text-xl font-bold text-slate-900 mb-1 leading-tight">
          <SectionTitle title="Редакция на продукт" hint="Промяна на параметри, наличности и медия на съществуващ продукт." />
        </h1>
      </div>

      <HelpCard>
        <HelpRow items={["Запис запазва всички промени в картата", "Изтрий премахва продукта и свързаните му публични данни", "Провери stock и active преди запазване"]} />
      </HelpCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      )}

      <Card className="p-6">
        <ProductFormFields brands={brands} types={types} form={form} setForm={setForm} />
      </Card>

      <div className="flex justify-between items-center pt-2">
        <Button variant="danger" onClick={remove} className="gap-2">
          <Trash2 className="w-4 h-4" /> Изтрий продукт
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={save}
          disabled={saving}
          className="gap-2 shadow-sm"
        >
          <Save className="w-5 h-5" />
          {saving ? "Запазвам..." : "Запази промените"}
        </Button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
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
