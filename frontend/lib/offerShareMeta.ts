import type { PageSeoConfig } from './seo/config';

const EUR_RATE = 1.95583;

type OfferShareInput = {
  offer_number: string;
  title: string | null;
  client_name: string | null;
  object_note: string | null;
  valid_until: string | null;
  total_incl_vat: number;
  currency: string;
  company: { tradeName: string; phone: string };
  items: Array<{
    brand_name: string | null;
    model_code: string | null;
    name: string;
  }>;
};

function toEur(n: number, currency: string): number {
  const val = Number(n) || 0;
  if ((currency || 'EUR').toUpperCase() === 'BGN') return Math.round((val / EUR_RATE) * 100) / 100;
  return val;
}

function moneyEur(n: number, currency: string): string {
  return `€${toEur(n, currency).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return v;
  }
}

function itemName(it: OfferShareInput['items'][0]): string {
  return [it.brand_name, it.model_code || it.name].filter(Boolean).join(' ') || it.name;
}

function productSummary(items: OfferShareInput['items']): string | null {
  if (!items.length) return null;
  const names = items.slice(0, 3).map(itemName);
  const extra = items.length > 3 ? ` +${items.length - 3}` : '';
  return names.join(' · ') + extra;
}

export function offerShareOgImagePath(token: string): string {
  return `/api/og/offer/${encodeURIComponent(token)}`;
}

export function buildOfferShareSeo(data: OfferShareInput, token: string): PageSeoConfig {
  const headline = data.title?.trim() || 'Оферта за климатизация';
  const title = `${headline} · ${data.offer_number} | ${data.company.tradeName}`;

  const parts: string[] = [];
  if (data.client_name?.trim()) parts.push(`Клиент: ${data.client_name.trim()}`);
  if (data.object_note?.trim()) parts.push(data.object_note.trim());
  const products = productSummary(data.items);
  if (products) parts.push(products);
  parts.push(`Крайна цена: ${moneyEur(data.total_incl_vat, data.currency)} с ДДС`);
  parts.push(`Валидна до ${fmtDate(data.valid_until)}`);
  parts.push(`${data.company.phone} · ${data.company.tradeName}`);

  return {
    title,
    description: parts.join(' · '),
    canonicalPath: `/oferta/${token}`,
    ogImage: offerShareOgImagePath(token),
    ogType: 'website',
    noindex: true,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageType: 'image/jpeg',
    ogImageAlt: headline,
  };
}
