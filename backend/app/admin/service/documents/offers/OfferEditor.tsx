"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, GripVertical, X } from "lucide-react";
import { Button, Input, Textarea } from "../../../ui";
import { ContactAutocomplete, type ContactSuggestion } from "../acceptance/ContactAutocomplete";
import { CatalogProductAutocomplete, type CatalogProductPick } from "./CatalogProductAutocomplete";
import { calcOfferTotals, formatOfferMoney } from "@/lib/offers/calcTotals";
import { DEFAULT_OFFER_TERMS } from "@/lib/company/companyInfo";
import type { OfferSpecRow } from "@/lib/offers/buildSpecsFromProduct";

export type EditorItem = {
  key: string;
  productId: string | null;
  kind: "product" | "installation" | "custom";
  name: string;
  brandName: string;
  typeName: string;
  modelCode: string;
  imageUrl: string;
  description: string;
  specs: OfferSpecRow[];
  groupLabel: string;
  quantity: string;
  unitPrice: string;
  installPrice: string;
  lineNote: string;
};

export type OfferEditorValue = {
  contactId: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  title: string;
  objectNote: string;
  introNote: string;
  termsNote: string;
  validUntil: string;
  vatRate: string;
  pricesIncludeVat: boolean;
  discountTotal: string;
  items: EditorItem[];
};

function uid() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyOfferEditor(): OfferEditorValue {
  const until = new Date();
  until.setDate(until.getDate() + 14);
  return {
    contactId: null,
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    clientAddress: "",
    title: "Оферта за климатизация",
    objectNote: "",
    introNote: "",
    termsNote: DEFAULT_OFFER_TERMS,
    validUntil: until.toISOString().slice(0, 10),
    vatRate: "20",
    pricesIncludeVat: true,
    discountTotal: "0",
    items: [],
  };
}

export function offerToEditor(data: {
  contact_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  title?: string | null;
  object_note?: string | null;
  intro_note?: string | null;
  terms_note?: string | null;
  valid_until?: string | null;
  vat_rate?: number;
  prices_include_vat?: boolean;
  discount_total?: number;
  items?: Array<{
    id: string;
    product_id?: string | null;
    kind?: EditorItem["kind"];
    name: string;
    brand_name?: string | null;
    type_name?: string | null;
    model_code?: string | null;
    image_url?: string | null;
    description?: string | null;
    specs?: OfferSpecRow[];
    group_label?: string | null;
    quantity: number;
    unit_price: number;
    install_price?: number | null;
    line_note?: string | null;
  }>;
}): OfferEditorValue {
  return {
    contactId: data.contact_id ?? null,
    clientName: data.client_name ?? "",
    clientPhone: data.client_phone ?? "",
    clientEmail: data.client_email ?? "",
    clientAddress: data.client_address ?? "",
    title: data.title ?? "",
    objectNote: data.object_note ?? "",
    introNote: data.intro_note ?? "",
    termsNote: data.terms_note ?? DEFAULT_OFFER_TERMS,
    validUntil: data.valid_until ?? "",
    vatRate: String(data.vat_rate ?? 20),
    pricesIncludeVat: data.prices_include_vat !== false,
    discountTotal: String(data.discount_total ?? 0),
    items: (data.items ?? []).map((it) => ({
      key: it.id,
      productId: it.product_id ?? null,
      kind: it.kind ?? "product",
      name: it.name,
      brandName: it.brand_name ?? "",
      typeName: it.type_name ?? "",
      modelCode: it.model_code ?? "",
      imageUrl: it.image_url ?? "",
      description: it.description ?? "",
      specs: Array.isArray(it.specs) ? it.specs : [],
      groupLabel: it.group_label ?? "",
      quantity: String(it.quantity),
      unitPrice: String(it.unit_price),
      installPrice: it.install_price != null ? String(it.install_price) : "",
      lineNote: it.line_note ?? "",
    })),
  };
}

export function editorToPayload(v: OfferEditorValue) {
  return {
    contactId: v.contactId,
    clientName: v.clientName.trim() || null,
    clientPhone: v.clientPhone.trim() || null,
    clientEmail: v.clientEmail.trim() || null,
    clientAddress: v.clientAddress.trim() || null,
    title: v.title.trim() || null,
    objectNote: v.objectNote.trim() || null,
    introNote: v.introNote.trim() || null,
    termsNote: v.termsNote.trim() || null,
    validUntil: v.validUntil.trim() || null,
    vatRate: Number(v.vatRate) || 20,
    pricesIncludeVat: v.pricesIncludeVat,
    discountTotal: Number(v.discountTotal) || 0,
    items: v.items.map((it, idx) => ({
      productId: it.productId,
      kind: it.kind,
      name: it.name.trim() || "Артикул",
      brandName: it.brandName.trim() || null,
      typeName: it.typeName.trim() || null,
      modelCode: it.modelCode.trim() || null,
      imageUrl: it.imageUrl.trim() || null,
      description: it.description.trim() || null,
      specs: it.specs.filter((s) => s.label.trim() || s.value.trim()),
      groupLabel: it.groupLabel.trim() || null,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      installPrice: it.installPrice.trim() === "" ? null : Number(it.installPrice),
      lineNote: it.lineNote.trim() || null,
      sortOrder: idx,
    })),
  };
}

type Props = {
  value: OfferEditorValue;
  onChange: (v: OfferEditorValue) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  mode: "create" | "edit";
};

export function OfferEditor({ value, onChange, onClose, onSave, saving, error, mode }: Props) {
  const set = <K extends keyof OfferEditorValue>(key: K, val: OfferEditorValue[K]) =>
    onChange({ ...value, [key]: val });

  const updateItem = (key: string, patch: Partial<EditorItem>) => {
    onChange({
      ...value,
      items: value.items.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    });
  };

  const removeItem = (key: string) => {
    onChange({ ...value, items: value.items.filter((it) => it.key !== key) });
  };

  const addFromCatalog = (p: CatalogProductPick) => {
    const item: EditorItem = {
      key: uid(),
      productId: p.productId,
      kind: "product",
      name: p.name,
      brandName: p.brandName ?? "",
      typeName: p.typeName ?? "",
      modelCode: p.modelCode ?? "",
      imageUrl: p.imageUrl ?? "",
      description: p.description ?? "",
      specs: p.specs,
      groupLabel: "",
      quantity: "1",
      unitPrice: String(p.unitPrice),
      installPrice: String(p.installPrice),
      lineNote: "",
    };
    onChange({ ...value, items: [...value.items, item] });
  };

  const addCustom = () => {
    onChange({
      ...value,
      items: [
        ...value.items,
        {
          key: uid(),
          productId: null,
          kind: "custom",
          name: "",
          brandName: "",
          typeName: "",
          modelCode: "",
          imageUrl: "",
          description: "",
          specs: [],
          groupLabel: "",
          quantity: "1",
          unitPrice: "0",
          installPrice: "",
          lineNote: "",
        },
      ],
    });
  };

  const totals = useMemo(
    () =>
      calcOfferTotals({
        items: value.items.map((it) => ({
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unitPrice) || 0,
          install_price: it.installPrice.trim() === "" ? null : Number(it.installPrice),
        })),
        vatRate: Number(value.vatRate) || 20,
        pricesIncludeVat: value.pricesIncludeVat,
        discountTotal: Number(value.discountTotal) || 0,
      }),
    [value.items, value.vatRate, value.pricesIncludeVat, value.discountTotal],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 md:px-5">
        <div>
          <div className="text-base font-bold text-slate-900">
            {mode === "create" ? "Нова оферта" : "Редакция на оферта"}
          </div>
          <div className="text-xs text-slate-500">Цените и описанието се теглят от публичния каталог</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 px-4 py-4 md:px-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</div>
        )}

        {/* Клиент */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-brand-blue-700">Клиент</h3>
          <ContactAutocomplete
            label="Име"
            value={value.clientName}
            onChange={(name, contact?: ContactSuggestion) => {
              if (contact) {
                onChange({
                  ...value,
                  contactId: contact.id,
                  clientName: contact.full_name,
                  clientPhone: contact.phone ?? value.clientPhone,
                  clientEmail: contact.email ?? value.clientEmail,
                  clientAddress: contact.address ?? value.clientAddress,
                });
              } else {
                set("clientName", name);
                set("contactId", null);
              }
            }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Телефон</span>
              <Input value={value.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Имейл</span>
              <Input value={value.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Адрес</span>
            <Input value={value.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} />
          </label>
        </section>

        {/* Заглавие / обект */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-brand-blue-700">Оферта</h3>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Заглавие</span>
            <Input value={value.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Обект</span>
            <Input
              value={value.objectNote}
              onChange={(e) => set("objectNote", e.target.value)}
              placeholder="напр. жилище в с. Смилян"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Въведение</span>
            <Textarea value={value.introNote} onChange={(e) => set("introNote", e.target.value)} rows={2} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Валидна до</span>
              <Input type="date" value={value.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
            </label>
          </div>
        </section>

        {/* Артикули */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-brand-blue-700">Климатици</h3>
            <Button type="button" variant="secondary" size="sm" onClick={addCustom} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Свободен ред
            </Button>
          </div>
          <CatalogProductAutocomplete onPick={addFromCatalog} />

          {value.items.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
              Добавете климатик от каталога по-горе
            </div>
          )}

          {value.items.map((it) => (
            <ItemCard
              key={it.key}
              item={it}
              onChange={(patch) => updateItem(it.key, patch)}
              onRemove={() => removeItem(it.key)}
            />
          ))}
        </section>

        {/* Цени / ДДС */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-brand-blue-700">Суми и ДДС</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">ДДС %</span>
              <Input type="number" min={0} max={100} value={value.vatRate} onChange={(e) => set("vatRate", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Отстъпка €</span>
              <Input type="number" min={0} step="0.01" value={value.discountTotal} onChange={(e) => set("discountTotal", e.target.value)} />
            </label>
            <label className="col-span-2 flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={value.pricesIncludeVat}
                onChange={(e) => set("pricesIncludeVat", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-orange-500"
              />
              <span className="text-sm font-medium text-slate-700">Цените са с включен ДДС</span>
            </label>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#F0F9FF] to-[#FFF5ED] p-4 space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Междинна</span><span className="font-bold tabular-nums">{formatOfferMoney(totals.subtotal)}</span></div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm"><span className="text-slate-500">Отстъпка</span><span className="font-bold tabular-nums text-red-600">−{formatOfferMoney(totals.discount)}</span></div>
            )}
            <div className="flex justify-between text-sm"><span className="text-slate-500">Без ДДС</span><span className="font-bold tabular-nums">{formatOfferMoney(totals.base_excl_vat)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">ДДС</span><span className="font-bold tabular-nums">{formatOfferMoney(totals.vat_amount)}</span></div>
            <div className="flex justify-between border-t border-brand-orange-200/60 pt-2 text-base">
              <span className="font-bold text-brand-orange-600">С ДДС</span>
              <span className="font-black tabular-nums text-brand-orange-600">{formatOfferMoney(totals.total_incl_vat)}</span>
            </div>
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-brand-blue-700">Условия за монтаж</h3>
          <Textarea value={value.termsNote} onChange={(e) => set("termsNote", e.target.value)} rows={8} />
        </section>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 md:px-5">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Отказ
        </Button>
        <Button variant="primary" onClick={onSave} disabled={saving || value.items.length === 0}>
          {saving ? "Записвам…" : mode === "create" ? "Създай оферта" : "Запази"}
        </Button>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: EditorItem;
  onChange: (p: Partial<EditorItem>) => void;
  onRemove: () => void;
}) {
  const [specsOpen, setSpecsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
      <div className="flex items-start gap-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover border border-slate-200" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-200 text-slate-400">
            <GripVertical className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Име"
            className="font-bold"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input value={item.brandName} onChange={(e) => onChange({ brandName: e.target.value })} placeholder="Марка" />
            <Input value={item.modelCode} onChange={(e) => onChange({ modelCode: e.target.value })} placeholder="Модел" />
          </div>
        </div>
        <button type="button" onClick={onRemove} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Textarea
        value={item.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={3}
        placeholder="Описание от каталога…"
        className="text-xs"
      />

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-bold text-slate-500">Кол-во</span>
          <Input type="number" min={0.01} step="1" value={item.quantity} onChange={(e) => onChange({ quantity: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-bold text-slate-500">Цена €</span>
          <Input type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => onChange({ unitPrice: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-bold text-slate-500">Монтаж €</span>
          <Input type="number" min={0} step="0.01" value={item.installPrice} onChange={(e) => onChange({ installPrice: e.target.value })} />
        </label>
      </div>

      <Input
        value={item.groupLabel}
        onChange={(e) => onChange({ groupLabel: e.target.value })}
        placeholder="Група (мулти-сплит) — по избор"
        className="text-xs"
      />

      <button
        type="button"
        onClick={() => setSpecsOpen((v) => !v)}
        className="text-[11px] font-bold uppercase tracking-wide text-brand-blue-700 hover:underline"
      >
        {specsOpen ? "Скрий спецификации" : `Спецификации (${item.specs.length})`}
      </button>

      {specsOpen && (
        <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
          {item.specs.map((sp, i) => (
            <div key={i} className="flex gap-1.5">
              <Input
                value={sp.label}
                onChange={(e) => {
                  const next = [...item.specs];
                  next[i] = { ...next[i], label: e.target.value };
                  onChange({ specs: next });
                }}
                placeholder="Етикет"
                className="text-xs"
              />
              <Input
                value={sp.value}
                onChange={(e) => {
                  const next = [...item.specs];
                  next[i] = { ...next[i], value: e.target.value };
                  onChange({ specs: next });
                }}
                placeholder="Стойност"
                className="text-xs"
              />
              <button
                type="button"
                onClick={() => onChange({ specs: item.specs.filter((_, j) => j !== i) })}
                className="rounded-lg px-2 text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-xs"
            onClick={() => onChange({ specs: [...item.specs, { label: "", value: "" }] })}
          >
            + Спецификация
          </Button>
        </div>
      )}
    </div>
  );
}
