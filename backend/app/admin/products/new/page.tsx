"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductFormFields, emptyProductForm, buildPostBody, type AdminProductForm } from "../ProductForm";
import { HelpRow, SectionTitle, HelpCard, Card, Button } from "../../ui";
import { Save } from "lucide-react";

type Brand = { id: string; name: string };
type ProductType = { id: string; name: string };

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AdminProductForm>(emptyProductForm);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      const [bRes, tRes] = await Promise.all([
        fetch("/api/admin/meta/brands", { credentials: "include" }),
        fetch("/api/admin/meta/product-types", { credentials: "include" }),
      ]);
      const b = await bRes.json();
      const t = await tRes.json();
      setBrands(b.data ?? []);
      setTypes(t.data ?? []);
      setForm((prev) => ({
        ...prev,
        brandId: (b.data?.[0]?.id as string) ?? "",
        typeId: (t.data?.[0]?.id as string) ?? "",
      }));
    })().catch((e) => setError(String(e?.message ?? e)));
  }, []);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPostBody(form)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as any)?.error || "Грешка при създаване";
        setError(msg);
        setToast({ kind: "err", text: msg });
        return;
      }
      setToast({ kind: "ok", text: "Създадено" });
      router.push(`/admin/products/${(json as any).data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

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
          <SectionTitle title="Нов продукт" hint="Създаване на нова продуктова карта за каталога." />
        </h1>
      </div>

      <HelpCard>
        <HelpRow items={["Slug се ползва за URL и Cloudinary папка", "Маркирай състояние: Нови/Втора употреба", "Пази поне една главна снимка"]} />
      </HelpCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      )}

      <Card className="p-6">
        <ProductFormFields brands={brands} types={types} form={form} setForm={setForm} />
      </Card>

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="lg"
          onClick={submit}
          disabled={submitting}
          className="gap-2 shadow-sm"
        >
          <Save className="w-5 h-5" />
          {submitting ? "Създавам..." : "Създай продукт"}
        </Button>
      </div>
    </div>
  );
}
