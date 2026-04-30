"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Brand = { id: string; name: string };
type ProductType = { id: string; name: string };

export default function NewProductPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    slug: "",
    name: "",
    brandId: "",
    typeId: "",
    price: 0,
    isActive: true,
    isFeatured: false,
  });

  useEffect(() => {
    (async () => {
      const [bRes, tRes] = await Promise.all([
        fetch("/api/admin/meta/brands"),
        fetch("/api/admin/meta/product-types"),
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
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Грешка");
      return;
    }
    router.push(`/admin/products/${json.data.id}`);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Нов продукт</h1>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Slug</div>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </label>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Име</div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Марка</div>
            <select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Тип</div>
            <select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Цена (EUR)</div>
          <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Активен
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
          Избран
        </label>
        <button onClick={submit} style={{ padding: "10px 12px", borderRadius: 12, background: "#0ea5e9", color: "white", fontWeight: 900, border: "1px solid #0ea5e9" }}>
          Създай
        </button>
      </div>
    </div>
  );
}

