"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  is_featured: boolean;
  stock_status: "in_stock" | "out_of_stock" | "on_order";
  stock_quantity: number;
  sold_quantity: number;
  product_condition: "new" | "used";
  brands?: { name?: string } | null;
  product_types?: { name?: string } | null;
};

type OptionRow = { id: string; name: string };
type ContactChoice = { id: string; full_name: string; phone: string; email?: string | null; address?: string | null };
type SortField = "created_at" | "name" | "price" | "stock_quantity" | "sold_quantity" | "is_active" | "is_featured";
type SortDir = "asc" | "desc";

export default function AdminProductsPage() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<OptionRow[]>([]);
  const [types, setTypes] = useState<OptionRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [condition, setCondition] = useState<"" | "new" | "used">("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [featured, setFeatured] = useState<"" | "featured" | "regular">("");
  const [stockStatus, setStockStatus] = useState<"" | "in_stock" | "out_of_stock" | "on_order">("");
  const [brandId, setBrandId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [stockMax, setStockMax] = useState("");
  const [soldMin, setSoldMin] = useState("");
  const [soldMax, setSoldMax] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleFor, setSaleFor] = useState<ProductRow | null>(null);
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleForm, setSaleForm] = useState({
    contactId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerEmail: "",
    notes: "",
  });
  const [contactQuery, setContactQuery] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResults, setContactResults] = useState<ContactChoice[]>([]);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (condition) sp.set("condition", condition);
    if (status) sp.set("status", status);
    if (featured) sp.set("featured", featured);
    if (stockStatus) sp.set("stockStatus", stockStatus);
    if (brandId) sp.set("brandId", brandId);
    if (typeId) sp.set("typeId", typeId);
    if (priceMin.trim()) sp.set("priceMin", priceMin.trim());
    if (priceMax.trim()) sp.set("priceMax", priceMax.trim());
    if (stockMin.trim()) sp.set("stockMin", stockMin.trim());
    if (stockMax.trim()) sp.set("stockMax", stockMax.trim());
    if (soldMin.trim()) sp.set("soldMin", soldMin.trim());
    if (soldMax.trim()) sp.set("soldMax", soldMax.trim());
    if (createdFrom) sp.set("createdFrom", createdFrom);
    if (createdTo) sp.set("createdTo", createdTo);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("page", String(page));
    sp.set("perPage", "20");
    return sp.toString();
  }, [
    q,
    condition,
    status,
    featured,
    stockStatus,
    brandId,
    typeId,
    priceMin,
    priceMax,
    stockMin,
    stockMax,
    soldMin,
    soldMax,
    createdFrom,
    createdTo,
    sortBy,
    sortDir,
    page,
  ]);

  async function loadMeta() {
    try {
      const [bRes, tRes] = await Promise.all([
        fetch("/api/admin/meta/brands", { credentials: "include" }),
        fetch("/api/admin/meta/product-types", { credentials: "include" }),
      ]);
      const [bJson, tJson] = await Promise.all([bRes.json(), tRes.json()]);
      if (bRes.ok) setBrands((bJson.data ?? []) as OptionRow[]);
      if (tRes.ok) setTypes((tJson.data ?? []) as OptionRow[]);
    } catch {
      // non-blocking for products table
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 20, total: 0 });
      setSelected([]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  function resetFilters() {
    setQ("");
    setCondition("");
    setStatus("");
    setFeatured("");
    setStockStatus("");
    setBrandId("");
    setTypeId("");
    setPriceMin("");
    setPriceMax("");
    setStockMin("");
    setStockMax("");
    setSoldMin("");
    setSoldMax("");
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("created_at");
    setSortDir("desc");
    setPage(1);
  }

  async function bulk(action: "activate" | "deactivate" | "set_new" | "set_used" | "delete") {
    if (selected.length === 0) return;
    if (action === "delete" && !confirm("Сигурни ли сте за изтриване на избраните продукти?")) return;
    const res = await fetch("/api/admin/products/bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, action }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при масова операция");
      return;
    }
    await load();
  }

  useEffect(() => {
    if (!saleFor) return;
    const q = contactQuery.trim();
    if (q.length < 2) {
      setContactResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setContactLoading(true);
      try {
        const res = await fetch(`/api/admin/contacts?q=${encodeURIComponent(q)}&perPage=20`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setContactResults((json as any).data ?? []);
      } finally {
        setContactLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [contactQuery, saleFor]);

  async function createContactInline() {
    if (!saleForm.customerName.trim() || !saleForm.customerPhone.trim()) return;
    const res = await fetch("/api/admin/contacts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: saleForm.customerName.trim(),
        phone: saleForm.customerPhone.trim(),
        email: saleForm.customerEmail.trim() || null,
        address: saleForm.customerAddress.trim() || null,
        notes: saleForm.notes.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any).error || "Грешка при създаване на контакт");
    const c = (json as any).data as ContactChoice;
    setSaleForm((s) => ({ ...s, contactId: c.id }));
    setContactQuery(c.full_name);
    setContactResults([c]);
  }

  async function markAsSold(
    p: ProductRow,
    customer: { id?: string; name: string; phone: string; address: string; email?: string; notes: string },
  ) {
    if (p.stock_quantity <= 0) return;
    const nextQty = Math.max(0, p.stock_quantity - 1);
    const nextSold = Math.max(0, Number(p.sold_quantity ?? 0) + 1);
    const shouldHideFromCatalog = nextQty === 0;
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stockQuantity: nextQty,
        soldQuantity: nextSold,
        stockStatus: shouldHideFromCatalog ? "out_of_stock" : p.stock_status,
        isActive: shouldHideFromCatalog ? false : p.is_active,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при маркиране на продажба");
      return;
    }
    setItems((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? {
              ...x,
              stock_quantity: nextQty,
              sold_quantity: nextSold,
              stock_status: shouldHideFromCatalog ? "out_of_stock" : x.stock_status,
              is_active: shouldHideFromCatalog ? false : x.is_active,
            }
          : x,
      ),
    );

    // Auto-create an operational record visible in the dashboard calendar.
    const today = new Date().toISOString().slice(0, 10);
    void fetch("/api/admin/work-items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "sale",
        eventCode: "sale",
        title: `Продажба: ${p.name}`,
        dueDate: today,
        priority: "medium",
        status: "done",
        productId: p.id,
        contactId: customer.id || null,
        customerName: customer.name || null,
        customerPhone: customer.phone || null,
        customerAddress: customer.address || null,
        notes: customer.notes || null,
        quantity: 1,
        unitPrice: Number(p.price),
        totalAmount: Number(p.price),
      }),
    });
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>Продукти</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Професионално управление с филтри и масови действия</p>
        </div>
        <Link href="/admin/products/new" style={{ padding: "8px 12px", borderRadius: 10, background: "#0ea5e9", color: "white", fontWeight: 700, fontSize: 12 }}>
          + Нов продукт
        </Link>
      </div>

      <div style={{ border: "1px solid #e2e8f0", background: "white", borderRadius: 16, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px 180px 180px auto", gap: 10, marginBottom: 10 }}>
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси по име..." style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          <select value={condition} onChange={(e) => { setPage(1); setCondition(e.target.value as any); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
            <option value="">Всички състояния</option>
            <option value="new">Нови</option>
            <option value="used">Втора употреба</option>
          </select>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as any); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
            <option value="">Всички статуси</option>
            <option value="active">Активни</option>
            <option value="inactive">Неактивни</option>
          </select>
          <select value={featured} onChange={(e) => { setPage(1); setFeatured(e.target.value as any); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
            <option value="">Featured: всички</option>
            <option value="featured">Само избрани</option>
            <option value="regular">Само нормални</option>
          </select>
          <select value={stockStatus} onChange={(e) => { setPage(1); setStockStatus(e.target.value as any); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
            <option value="">Наличност: всички</option>
            <option value="in_stock">В наличност</option>
            <option value="out_of_stock">Изчерпан</option>
            <option value="on_order">По поръчка</option>
          </select>
          <button onClick={load} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontWeight: 700, background: "#f8fafc" }}>Обнови</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
          <select value={brandId} onChange={(e) => { setPage(1); setBrandId(e.target.value); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
            <option value="">Марка: всички</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={typeId} onChange={(e) => { setPage(1); setTypeId(e.target.value); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
            <option value="">Тип: всички</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input value={priceMin} onChange={(e) => { setPage(1); setPriceMin(e.target.value); }} placeholder="Цена от" type="number" min={0} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          <input value={priceMax} onChange={(e) => { setPage(1); setPriceMax(e.target.value); }} placeholder="Цена до" type="number" min={0} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          <input value={stockMin} onChange={(e) => { setPage(1); setStockMin(e.target.value); }} placeholder="Налични от" type="number" min={0} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          <input value={stockMax} onChange={(e) => { setPage(1); setStockMax(e.target.value); }} placeholder="Налични до" type="number" min={0} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
          <input value={soldMin} onChange={(e) => { setPage(1); setSoldMin(e.target.value); }} placeholder="Продадени от" type="number" min={0} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          <input value={soldMax} onChange={(e) => { setPage(1); setSoldMax(e.target.value); }} placeholder="Продадени до" type="number" min={0} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          <input value={createdFrom} onChange={(e) => { setPage(1); setCreatedFrom(e.target.value); }} type="date" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          <input value={createdTo} onChange={(e) => { setPage(1); setCreatedTo(e.target.value); }} type="date" style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          <select value={sortBy} onChange={(e) => { setPage(1); setSortBy(e.target.value as SortField); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
            <option value="created_at">Сортиране: дата</option>
            <option value="name">Сортиране: име</option>
            <option value="price">Сортиране: цена</option>
            <option value="stock_quantity">Сортиране: налични</option>
            <option value="sold_quantity">Сортиране: продадени</option>
            <option value="is_active">Сортиране: активност</option>
            <option value="is_featured">Сортиране: избрани</option>
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={sortDir} onChange={(e) => { setPage(1); setSortDir(e.target.value as SortDir); }} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
              <option value="desc">Низходящо</option>
              <option value="asc">Възходящо</option>
            </select>
            <button onClick={resetFilters} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 700 }}>
              Изчисти
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={() => bulk("activate")} disabled={selected.length === 0} style={bulkBtn(selected.length > 0)}>Активирай</button>
        <button onClick={() => bulk("deactivate")} disabled={selected.length === 0} style={bulkBtn(selected.length > 0)}>Деактивирай</button>
        <button onClick={() => bulk("set_new")} disabled={selected.length === 0} style={bulkBtn(selected.length > 0)}>Маркирай Нови</button>
        <button onClick={() => bulk("set_used")} disabled={selected.length === 0} style={bulkBtn(selected.length > 0)}>Маркирай Втора употреба</button>
        <button onClick={() => bulk("delete")} disabled={selected.length === 0} style={{ ...bulkBtn(selected.length > 0), borderColor: "#fecaca", color: "#b91c1c" }}>Изтрий</button>
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>{error}</div>}

      <div style={{ border: "1px solid #e2e8f0", background: "white", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={th}>
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.length === items.length}
                  onChange={(e) => setSelected(e.target.checked ? items.map((x) => x.id) : [])}
                />
              </th>
              {["Име", "Марка", "Състояние", "Тип", "Цена", "Налични", "Продадени", "Статус", ""].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && items.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={td}><input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))} /></td>
                <td style={{ ...td, fontWeight: 800 }}>{p.name}</td>
                <td style={td}>{p.brands?.name ?? "—"}</td>
                <td style={td}>{p.product_condition === "used" ? "Втора употреба" : "Нови"}</td>
                <td style={td}>{p.product_types?.name ?? "—"}</td>
                <td style={td}>€{Number(p.price).toLocaleString()}</td>
                <td style={td}>{Number(p.stock_quantity ?? 0)}</td>
                <td style={td}>{Number(p.sold_quantity ?? 0)}</td>
                <td style={td}>{p.is_active ? "Активен" : "Неактивен"}</td>
                <td style={td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSaleFor(p);
                        setSaleForm({ contactId: "", customerName: "", customerPhone: "", customerAddress: "", customerEmail: "", notes: "" });
                        setContactQuery("");
                        setContactResults([]);
                      }}
                      disabled={p.stock_quantity <= 0}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: "white",
                        fontWeight: 700,
                        color: "#0f172a",
                        opacity: p.stock_quantity > 0 ? 1 : 0.45,
                        cursor: p.stock_quantity > 0 ? "pointer" : "not-allowed",
                      }}
                      title="Намалява бройката с 1. При 0 се скрива от каталога."
                    >
                      Продаден
                    </button>
                    <Link href={`/admin/products/${p.id}`} style={{ fontWeight: 800, color: "#0284c7" }}>Редакция</Link>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 14, color: "#64748b" }}>Няма продукти.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{ color: "#64748b", fontSize: 13 }}>Общо: {meta.total}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={bulkBtn(page > 1)}>Предишна</button>
          <span style={{ fontSize: 13, color: "#475569", alignSelf: "center" }}>Стр. {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={bulkBtn(page < pages)}>Следваща</button>
        </div>
      </div>

      {saleFor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => !saleBusy && setSaleFor(null)}
        >
          <div
            style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", width: "min(760px, 100%)", padding: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Продажба - {saleFor.name}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Избери съществуващ контакт (live search) или създай нов. Данните влизат в История и Календар.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10, position: "relative" }}>
              <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                <input
                  value={contactQuery}
                  onChange={(e) => {
                    setContactQuery(e.target.value);
                    setSaleForm((s) => ({ ...s, contactId: "" }));
                  }}
                  placeholder="Търси контакт (име/телефон) ..."
                  style={inputField}
                />
                {(contactLoading || contactResults.length > 0) && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", border: "1px solid #cbd5e1", borderRadius: 10, background: "white", zIndex: 5, maxHeight: 180, overflow: "auto" }}>
                    {contactLoading ? (
                      <div style={{ padding: "8px 10px", fontSize: 12, color: "#64748b" }}>Търсене...</div>
                    ) : (
                      contactResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSaleForm((s) => ({
                              ...s,
                              contactId: c.id,
                              customerName: c.full_name || "",
                              customerPhone: c.phone || "",
                              customerAddress: c.address || "",
                              customerEmail: c.email || "",
                            }));
                            setContactQuery(`${c.full_name} (${c.phone})`);
                            setContactResults([]);
                          }}
                          style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "white", padding: "8px 10px", cursor: "pointer", fontSize: 12 }}
                        >
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{c.full_name}</div>
                          <div style={{ color: "#64748b" }}>{c.phone}{c.email ? ` / ${c.email}` : ""}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <input value={saleForm.customerName} onChange={(e) => setSaleForm((s) => ({ ...s, customerName: e.target.value }))} placeholder="Контактно лице*" style={inputField} />
              <input value={saleForm.customerPhone} onChange={(e) => setSaleForm((s) => ({ ...s, customerPhone: e.target.value }))} placeholder="Телефон*" style={inputField} />
              <input value={saleForm.customerEmail} onChange={(e) => setSaleForm((s) => ({ ...s, customerEmail: e.target.value }))} placeholder="Имейл" style={inputField} />
              <input value={saleForm.customerAddress} onChange={(e) => setSaleForm((s) => ({ ...s, customerAddress: e.target.value }))} placeholder="Адрес" style={{ ...inputField, gridColumn: "1 / -1" }} />
              <textarea value={saleForm.notes} onChange={(e) => setSaleForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Бележки (по желание)" rows={3} style={{ ...inputField, gridColumn: "1 / -1", resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Сума: €{Number(saleFor.price).toLocaleString()}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={saleBusy || !saleForm.customerName.trim() || !saleForm.customerPhone.trim()}
                  onClick={async () => {
                    setSaleBusy(true);
                    try {
                      await createContactInline();
                    } catch (e: any) {
                      setError(String(e?.message ?? e));
                    } finally {
                      setSaleBusy(false);
                    }
                  }}
                  style={bulkBtn(!saleBusy && !!saleForm.customerName.trim() && !!saleForm.customerPhone.trim())}
                >
                  + Нов контакт
                </button>
                <button type="button" disabled={saleBusy} onClick={() => setSaleFor(null)} style={bulkBtn(!saleBusy)}>Отказ</button>
                <button
                  type="button"
                  disabled={saleBusy || !saleForm.customerName.trim() || !saleForm.customerPhone.trim()}
                  onClick={async () => {
                    setSaleBusy(true);
                    try {
                      await markAsSold(saleFor, {
                        id: saleForm.contactId || undefined,
                        name: saleForm.customerName.trim(),
                        phone: saleForm.customerPhone.trim(),
                        address: saleForm.customerAddress.trim(),
                        email: saleForm.customerEmail.trim(),
                        notes: saleForm.notes.trim(),
                      });
                      setSaleFor(null);
                    } finally {
                      setSaleBusy(false);
                    }
                  }}
                  style={{ ...bulkBtn(!saleBusy && !!saleForm.customerName.trim() && !!saleForm.customerPhone.trim()), borderColor: "#0ea5e9", color: "#0369a1" }}
                >
                  {saleBusy ? "Запис..." : "Запиши продажба"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#334155", fontWeight: 800 };
const td: CSSProperties = { padding: "10px 12px", color: "#334155", fontSize: 13 };
function bulkBtn(enabled: boolean): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

const inputField: CSSProperties = {
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 12,
  color: "#0f172a",
  background: "white",
};

