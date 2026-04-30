"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Brand = { id: string; name: string };
type ProductType = { id: string; name: string };

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
      const [bRes, tRes, pRes] = await Promise.all([
        fetch("/api/admin/meta/brands"),
        fetch("/api/admin/meta/product-types"),
        fetch(`/api/admin/products/${id}`),
      ]);
      const b = await bRes.json();
      const t = await tRes.json();
      const p = await pRes.json();
      setBrands(b.data ?? []);
      setTypes(t.data ?? []);
      if (!pRes.ok) throw new Error(p.error || "Failed to load product");
      setForm({
        slug: p.data.slug,
        name: p.data.name,
        brandId: p.data.brand_id,
        typeId: p.data.type_id,
        price: Number(p.data.price),
        isActive: Boolean(p.data.is_active),
        isFeatured: Boolean(p.data.is_featured),
      });
    })()
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    setError(null);
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: Number(form.price) }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Грешка");
    return json;
  }

  async function remove() {
    if (!confirm("Да изтрия ли продукта?")) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Грешка");
    else router.push("/admin/products");
  }

  if (loading) return <div>Зареждане...</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Редакция на продукт</h1>
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
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={save} style={{ padding: "10px 12px", borderRadius: 12, background: "#0ea5e9", color: "white", fontWeight: 900, border: "1px solid #0ea5e9" }}>
            Запази
          </button>
          <button onClick={remove} style={{ padding: "10px 12px", borderRadius: 12, background: "#fff", color: "#b91c1c", fontWeight: 900, border: "1px solid #fecaca" }}>
            Изтрий
          </button>
        </div>
      </div>
    </div>
  );
}

