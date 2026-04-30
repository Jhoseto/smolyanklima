"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductFormFields, emptyProductForm, buildPostBody, type AdminProductForm } from "../ProductForm";

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
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Нов продукт</h1>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <ProductFormFields brands={brands} types={types} form={form} setForm={setForm} />
      <button
        onClick={submit}
        disabled={submitting}
        style={{
          marginTop: 14,
          padding: "10px 12px",
          borderRadius: 12,
          background: submitting ? "#0284c7" : "#0ea5e9",
          color: "white",
          fontWeight: 900,
          border: "1px solid #0ea5e9",
          opacity: submitting ? 0.85 : 1,
          cursor: submitting ? "not-allowed" : "pointer",
          transform: submitting ? "translateY(1px)" : "translateY(0)",
          boxShadow: submitting ? "none" : "0 8px 20px rgba(14,165,233,.25)",
          transition: "transform .06s ease, box-shadow .12s ease, opacity .12s ease",
        }}
      >
        {submitting ? "Създавам..." : "Създай"}
      </button>
    </div>
  );
}
