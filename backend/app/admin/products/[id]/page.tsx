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
    if (!confirm("Да изтрия ли продукта?")) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Грешка");
    else router.push("/admin/products");
  }

  if (loading) return <div>Зареждане...</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 14,
            right: 14,
            zIndex: 50,
            background: toast.kind === "ok" ? "#ecfdf5" : "#fef2f2",
            border: toast.kind === "ok" ? "1px solid #a7f3d0" : "1px solid #fecaca",
            color: toast.kind === "ok" ? "#065f46" : "#991b1b",
            padding: "10px 12px",
            borderRadius: 12,
            boxShadow: "0 10px 25px rgba(0,0,0,.08)",
            fontWeight: 800,
          }}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      )}
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Редакция на продукт</h1>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <ProductFormFields brands={brands} types={types} form={form} setForm={setForm} />
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: saving ? "#0284c7" : "#0ea5e9",
            color: "white",
            fontWeight: 900,
            border: "1px solid #0ea5e9",
            opacity: saving ? 0.85 : 1,
            cursor: saving ? "not-allowed" : "pointer",
            transform: saving ? "translateY(1px)" : "translateY(0)",
            boxShadow: saving ? "none" : "0 8px 20px rgba(14,165,233,.25)",
            transition: "transform .06s ease, box-shadow .12s ease, opacity .12s ease",
          }}
        >
          {saving ? "Запазвам..." : "Запази"}
        </button>
        <button onClick={remove} style={{ padding: "10px 12px", borderRadius: 12, background: "#fff", color: "#b91c1c", fontWeight: 900, border: "1px solid #fecaca" }}>
          Изтрий
        </button>
      </div>
    </div>
  );
}
