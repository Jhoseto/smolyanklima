"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HelpRow, SectionTitle, HelpCard, Card, Button, Input, Select, Table, Th, Td, Textarea, InfoDot } from "../ui";
import { Plus, Search, FilterX, CheckCircle, XCircle, Tag, Trash2, Edit, Filter, ChevronDown } from "lucide-react";
import { ProductQuickViewButton } from "../ProductQuickView";

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
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState<{ productName: string; customerName: string; amount: number } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    if (action === "delete" && !confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
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
    setConfirmBulkDelete(false);
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
    if (p.stock_quantity <= 0) return false;
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
      return false;
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
    return true;
  }

  function startPriceEdit(p: ProductRow) {
    setEditingPriceId(p.id);
    setPriceDraft(String(Number(p.price)));
  }

  async function savePrice(p: ProductRow) {
    const nextPrice = Number(String(priceDraft).replace(",", "."));
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setError("Въведете валидна цена.");
      return;
    }
    setPriceBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: nextPrice }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при редакция на цена");
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, price: nextPrice } : x)));
      setEditingPriceId(null);
      setPriceDraft("");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPriceBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  const activeFiltersCount = [condition, status, featured, stockStatus, brandId, typeId, priceMin, priceMax, stockMin, stockMax, soldMin, soldMax, createdFrom, createdTo].filter(Boolean).length;

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 mb-0.5 leading-tight">
            <SectionTitle title="Продукти" hint="Пълен контрол: филтри, наличности, продажби и масови действия." />
          </h1>
          <p className="text-xs text-slate-500 hidden md:block">Професионално управление с филтри и масови действия</p>
        </div>
        <Link href="/admin/products/new" className="inline-flex items-center gap-2 bg-sky-600 text-white px-3 py-2 md:px-4 rounded-xl font-semibold hover:bg-sky-700 active:bg-sky-800 transition-colors shadow-sm text-sm">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Нов продукт</span>
          <span className="sm:hidden">Нов</span>
        </Link>
      </div>

      <HelpCard className="hidden md:block">
        <HelpRow items={["Търси и филтрирай по всички полета", "Бутон Продаден намалява наличността с 1", "При 0 бройки продуктът се скрива от каталога"]} />
      </HelpCard>

      {/* Mobile: search + filter toggle row */}
      <div className="flex gap-2 md:hidden">
        <div className="flex-1">
          <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси по име..." />
        </div>
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold text-sm shrink-0 transition-colors ${filtersOpen ? "bg-sky-50 border-sky-200 text-sky-700" : "bg-white border-slate-200 text-slate-700"}`}
        >
          <Filter className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <span className="bg-sky-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Filters card — always visible on desktop, toggleable on mobile */}
      <Card className={`p-3 md:p-4 ${filtersOpen ? "block" : "hidden"} md:block`}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 md:gap-3 mb-2 md:mb-3">
          <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Търси по име..." className="hidden md:block" />
          <Select value={condition} onChange={(e) => { setPage(1); setCondition(e.target.value as any); }}>
            <option value="">Всички състояния</option>
            <option value="new">Нови</option>
            <option value="used">Втора употреба</option>
          </Select>
          <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as any); }}>
            <option value="">Всички статуси</option>
            <option value="active">Активни</option>
            <option value="inactive">Неактивни</option>
          </Select>
          <Select value={featured} onChange={(e) => { setPage(1); setFeatured(e.target.value as any); }}>
            <option value="">Featured: всички</option>
            <option value="featured">Само избрани</option>
            <option value="regular">Само нормални</option>
          </Select>
          <Select value={stockStatus} onChange={(e) => { setPage(1); setStockStatus(e.target.value as any); }}>
            <option value="">Наличност: всички</option>
            <option value="in_stock">В наличност</option>
            <option value="out_of_stock">Изчерпан</option>
            <option value="on_order">По поръчка</option>
          </Select>
          <Button variant="secondary" onClick={load} className="gap-2">
            <Search className="w-4 h-4" /> Обнови
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-3 mb-2 md:mb-3">
          <Select value={brandId} onChange={(e) => { setPage(1); setBrandId(e.target.value); }}>
            <option value="">Марка: всички</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Select value={typeId} onChange={(e) => { setPage(1); setTypeId(e.target.value); }}>
            <option value="">Тип: всички</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Input value={priceMin} onChange={(e) => { setPage(1); setPriceMin(e.target.value); }} placeholder="Цена от" type="number" min={0} />
          <Input value={priceMax} onChange={(e) => { setPage(1); setPriceMax(e.target.value); }} placeholder="Цена до" type="number" min={0} />
          <Input value={stockMin} onChange={(e) => { setPage(1); setStockMin(e.target.value); }} placeholder="Налични от" type="number" min={0} />
          <Input value={stockMax} onChange={(e) => { setPage(1); setStockMax(e.target.value); }} placeholder="Налични до" type="number" min={0} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-3">
          <Input value={soldMin} onChange={(e) => { setPage(1); setSoldMin(e.target.value); }} placeholder="Продадени от" type="number" min={0} />
          <Input value={soldMax} onChange={(e) => { setPage(1); setSoldMax(e.target.value); }} placeholder="Продадени до" type="number" min={0} />
          <Input value={createdFrom} onChange={(e) => { setPage(1); setCreatedFrom(e.target.value); }} type="date" />
          <Input value={createdTo} onChange={(e) => { setPage(1); setCreatedTo(e.target.value); }} type="date" />
          <Select value={sortBy} onChange={(e) => { setPage(1); setSortBy(e.target.value as SortField); }}>
            <option value="created_at">Сортиране: дата</option>
            <option value="name">Сортиране: име</option>
            <option value="price">Сортиране: цена</option>
            <option value="stock_quantity">Сортиране: налични</option>
            <option value="sold_quantity">Сортиране: продадени</option>
            <option value="is_active">Сортиране: активност</option>
            <option value="is_featured">Сортиране: избрани</option>
          </Select>
          <div className="flex gap-2">
            <Select value={sortDir} onChange={(e) => { setPage(1); setSortDir(e.target.value as SortDir); }} className="flex-1">
              <option value="desc">Низходящо</option>
              <option value="asc">Възходящо</option>
            </Select>
            <Button variant="secondary" onClick={resetFilters} title="Изчисти филтрите" className="px-3">
              <FilterX className="w-4 h-4 text-slate-500" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Bulk actions — desktop always, mobile only when items selected */}
      {(selected.length > 0) && (
        <div className="md:hidden bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-sky-800">{selected.length} избрани</span>
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => bulk("activate")} className="gap-1 !py-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Активирай
            </Button>
            <Button variant="secondary" size="sm" onClick={() => bulk("deactivate")} className="gap-1 !py-1.5">
              <XCircle className="w-3.5 h-3.5 text-slate-400" /> Деакт.
            </Button>
            <Button variant="danger" size="sm" onClick={() => bulk("delete")} className="gap-1 !py-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Изтрий
            </Button>
          </div>
        </div>
      )}

      <div className="hidden md:flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 mr-2">
          Масови действия <InfoDot text="Прилагат се само върху избраните редове." />
        </span>
        <Button variant="secondary" size="sm" onClick={() => bulk("activate")} disabled={selected.length === 0} className="gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Активирай
        </Button>
        <Button variant="secondary" size="sm" onClick={() => bulk("deactivate")} disabled={selected.length === 0} className="gap-1.5">
          <XCircle className="w-3.5 h-3.5 text-slate-400" /> Деактивирай
        </Button>
        <Button variant="secondary" size="sm" onClick={() => bulk("set_new")} disabled={selected.length === 0} className="gap-1.5">
          <Tag className="w-3.5 h-3.5 text-sky-500" /> Маркирай Нови
        </Button>
        <Button variant="secondary" size="sm" onClick={() => bulk("set_used")} disabled={selected.length === 0} className="gap-1.5">
          <Tag className="w-3.5 h-3.5 text-amber-500" /> Маркирай Втора употреба
        </Button>
        <Button variant="danger" size="sm" onClick={() => bulk("delete")} disabled={selected.length === 0} className="gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> Изтрий
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={items.length > 0 && selected.length === items.length}
                  onChange={(e) => setSelected(e.target.checked ? items.map((x) => x.id) : [])}
                />
              </Th>
              <Th>Име</Th>
              <Th>Марка</Th>
              <Th>Състояние</Th>
              <Th>Тип</Th>
              <Th>Цена</Th>
              <Th>Налични</Th>
              <Th>Продадени</Th>
              <Th>Статус</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                <Td>
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={selected.includes(p.id)}
                    onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))}
                  />
                </Td>
                <Td className="font-bold text-slate-900">
                  <ProductQuickViewButton productId={p.id} productName={p.name} />
                </Td>
                <Td>{p.brands?.name ?? "—"}</Td>
                <Td>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.product_condition === "used" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                    {p.product_condition === "used" ? "Втора употреба" : "Нови"}
                  </span>
                </Td>
                <Td>{p.product_types?.name ?? "—"}</Td>
                <Td className="font-semibold">
                  {editingPriceId === p.id ? (
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className="max-w-[120px]" autoFocus />
                      <Button size="sm" onClick={() => void savePrice(p)} disabled={priceBusy}>Запази</Button>
                      <Button variant="secondary" size="sm" onClick={() => { setEditingPriceId(null); setPriceDraft(""); }} disabled={priceBusy}>Отказ</Button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => startPriceEdit(p)} className="rounded-md px-2 py-1 text-left font-semibold text-slate-900 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-200" title="Кликни за редакция на цена">
                      €{Number(p.price).toLocaleString()}
                    </button>
                  )}
                </Td>
                <Td>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${p.stock_quantity > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {Number(p.stock_quantity ?? 0)}
                  </span>
                </Td>
                <Td>{Number(p.sold_quantity ?? 0)}</Td>
                <Td>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {p.is_active ? "Активен" : "Неактивен"}
                  </span>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setSaleFor(p); setSaleForm({ contactId: "", customerName: "", customerPhone: "", customerAddress: "", customerEmail: "", notes: "" }); setContactQuery(""); setContactResults([]); }} disabled={p.stock_quantity <= 0} className="!py-1 !px-2 !text-xs font-bold">
                      Продажба
                    </Button>
                    <Link href={`/admin/products/${p.id}`} className="inline-flex items-center gap-1.5 px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold transition-colors">
                      <Edit className="w-3.5 h-3.5" /> Редакция
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><Td colSpan={10} className="text-center py-8 text-slate-500">Няма намерени продукти.</Td></tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {loading && (
          <div className="text-center py-10 text-slate-500 text-sm">Зареждане...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени продукти.</div>
        )}
        {!loading && items.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden active:bg-slate-50 transition-colors">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 shrink-0"
                  checked={selected.includes(p.id)}
                  onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-sm leading-snug">
                    <ProductQuickViewButton productId={p.id} productName={p.name} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${p.product_condition === "used" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                      {p.product_condition === "used" ? "Втора употр." : "Нов"}
                    </span>
                    {p.brands?.name && <span className="text-xs text-slate-500">{p.brands.name}</span>}
                    {p.product_types?.name && <span className="text-xs text-slate-400">{p.product_types.name}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {editingPriceId === p.id ? (
                    <div className="flex flex-col gap-1.5 items-end">
                      <Input type="number" min={0} value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className="w-24 text-right" autoFocus />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => void savePrice(p)} disabled={priceBusy} className="!py-1 !px-2 !text-xs">OK</Button>
                        <Button variant="secondary" size="sm" onClick={() => { setEditingPriceId(null); setPriceDraft(""); }} disabled={priceBusy} className="!py-1 !px-2 !text-xs">✕</Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => startPriceEdit(p)} className="text-lg font-black text-slate-900 rounded-lg px-2 py-1 hover:bg-sky-50 hover:text-sky-700 focus:outline-none active:bg-sky-50 transition-colors">
                      €{Number(p.price).toLocaleString()}
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 justify-end mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${p.stock_quantity > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {Number(p.stock_quantity ?? 0)} бр.
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.is_active ? "✓" : "–"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setSaleFor(p); setSaleForm({ contactId: "", customerName: "", customerPhone: "", customerAddress: "", customerEmail: "", notes: "" }); setContactQuery(""); setContactResults([]); }}
                disabled={p.stock_quantity <= 0}
                className="flex-1 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-40 border-r border-slate-100"
              >
                Продажба
              </button>
              <Link href={`/admin/products/${p.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 active:bg-sky-100 transition-colors">
                <Edit className="w-4 h-4" /> Редакция
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">Общо: {meta.total}</span>
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Пред.</Button>
          <span className="text-sm font-medium text-slate-600">{page} / {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Следв. ›</Button>
        </div>
      </div>

      {saleFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onClick={() => !saleBusy && setSaleFor(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f8fafc_100%)] px-6 py-5">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Запис на продажба</div>
              <div className="mt-1 text-2xl font-black leading-tight text-slate-950">{saleFor.name}</div>
              <div className="mt-1 text-sm font-medium text-slate-500">
                Създава продажба в календара, намалява наличността и връзва контакт към сделката.
              </div>
            </div>

            <div className="grid max-h-[calc(100vh-12rem)] grid-cols-1 gap-3 overflow-y-auto p-6 md:grid-cols-2">
              <div className="col-span-full relative">
                <Input
                  value={contactQuery}
                  onChange={(e) => {
                    setContactQuery(e.target.value);
                    setSaleForm((s) => ({ ...s, contactId: "" }));
                  }}
                  placeholder="Търси контакт (име/телефон) ..."
                />
                {(contactLoading || contactResults.length > 0) && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] border border-slate-200 rounded-lg bg-white shadow-lg z-10 max-h-32 overflow-y-auto p-1">
                    {contactLoading ? (
                      <div className="p-3 text-sm text-slate-500 text-center">Търсене...</div>
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
                          className="block w-full text-left p-2 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <div className="font-bold text-slate-900 text-sm">{c.full_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{c.phone}{c.email ? ` / ${c.email}` : ""}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Input value={saleForm.customerName} onChange={(e) => setSaleForm((s) => ({ ...s, customerName: e.target.value }))} placeholder="Контактно лице*" />
              <Input value={saleForm.customerPhone} onChange={(e) => setSaleForm((s) => ({ ...s, customerPhone: e.target.value }))} placeholder="Телефон*" />
              <Input value={saleForm.customerEmail} onChange={(e) => setSaleForm((s) => ({ ...s, customerEmail: e.target.value }))} placeholder="Имейл" />
              <Input value={saleForm.customerAddress} onChange={(e) => setSaleForm((s) => ({ ...s, customerAddress: e.target.value }))} placeholder="Адрес" className="md:col-span-2" />
              <Textarea value={saleForm.notes} onChange={(e) => setSaleForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Бележки (по желание)" rows={2} className="md:col-span-2 min-h-[2.75rem]" />
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 bg-slate-50 px-6 py-4 gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-900">Сума: €{Number(saleFor.price).toLocaleString()}</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
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
                >
                  + Нов контакт
                </Button>
                <Button variant="secondary" disabled={saleBusy} onClick={() => setSaleFor(null)}>Отказ</Button>
                <Button
                  variant="primary"
                  disabled={saleBusy || !saleForm.customerName.trim() || !saleForm.customerPhone.trim()}
                  onClick={async () => {
                    setSaleBusy(true);
                    try {
                      const ok = await markAsSold(saleFor, {
                        id: saleForm.contactId || undefined,
                        name: saleForm.customerName.trim(),
                        phone: saleForm.customerPhone.trim(),
                        address: saleForm.customerAddress.trim(),
                        email: saleForm.customerEmail.trim(),
                        notes: saleForm.notes.trim(),
                      });
                      if (ok) {
                        setSaleSuccess({ productName: saleFor.name, customerName: saleForm.customerName.trim(), amount: Number(saleFor.price) });
                        setSaleFor(null);
                      }
                    } finally {
                      setSaleBusy(false);
                    }
                  }}
                >
                  {saleBusy ? "Запис..." : "Запиши продажба"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saleSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md" onClick={() => setSaleSuccess(null)}>
          <div
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[radial-gradient(circle_at_top_left,#dcfce7_0,#ffffff_44%,#f8fafc_100%)] px-6 py-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
                <CheckCircle className="h-7 w-7" />
              </div>
              <div className="text-2xl font-black text-slate-950">Продажбата е записана</div>
              <div className="mt-2 text-sm font-medium text-slate-500">
                {saleSuccess.productName} · {saleSuccess.customerName}
              </div>
            </div>
            <div className="grid gap-3 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Сума</div>
                <div className="mt-1 text-2xl font-black text-slate-900">€{saleSuccess.amount.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
                Наличността е намалена, продажбата е добавена в историята на продажбите и в календара.
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button onClick={() => setSaleSuccess(null)}>Готово</Button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md" onClick={() => setConfirmBulkDelete(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-black text-slate-950">Изтриване на продукти</div>
            <div className="mt-2 text-sm text-slate-500">Сигурни ли сте, че искате да изтриете {selected.length} избрани продукта?</div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmBulkDelete(false)}>Отказ</Button>
              <Button variant="danger" onClick={() => void bulk("delete")}>Изтрий</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
