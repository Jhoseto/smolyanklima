import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Phone,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Truck,
  BadgeCheck,
  CheckCircle2,
  FileText,
  ChevronRight,
  User,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { SiteSeo } from '../components/seo/SiteSeo';
import { buildOfferShareSeo } from '../lib/offerShareMeta';
import { splitOfferTermsEmphasis } from '../lib/offerTermsDisplay';
import {
  effectiveUnitPrice,
  formatTradeDiscountPercent,
  lineTotal as calcOfferLineTotal,
  TRADE_DISCOUNT_LABEL,
  OFFER_INSTALL_LABEL,
} from '../lib/offerCalc';

type Spec = { label: string; value: string };

type OfferItem = {
  id: string;
  kind: string;
  name: string;
  brand_name: string | null;
  type_name: string | null;
  model_code: string | null;
  image_url: string | null;
  description: string | null;
  specs: Spec[];
  group_label: string | null;
  quantity: number;
  unit_price: number;
  install_price: number | null;
  trade_discount_percent?: number | null;
  line_note: string | null;
};

type OfferData = {
  offer_number: string;
  status: string;
  client_name: string | null;
  title: string | null;
  object_note: string | null;
  intro_note: string | null;
  terms_note: string | null;
  valid_until: string | null;
  vat_rate: number;
  discount_total: number;
  currency: string;
  subtotal: number;
  base_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  created_at: string;
  items: OfferItem[];
  company: {
    tradeName: string;
    legalName: string;
    phone: string;
    phoneE164: string;
    email: string;
    tradeAddress: string;
    website: string;
    eik: string;
    vatNumber: string;
  };
};

function toEur(n: number, currency: string): number {
  const val = Number(n) || 0;
  if ((currency || 'EUR').toUpperCase() === 'BGN') return Math.round((val / 1.95583) * 100) / 100;
  return val;
}

function money(n: number, currency: string) {
  return `€${Number(toEur(n, currency)).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(v: string | null) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return v;
  }
}

function lineTotal(it: OfferItem) {
  return calcOfferLineTotal({
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
    install_price: it.install_price,
    trade_discount_percent: it.trade_discount_percent,
  });
}

function unitAfterTradeDiscount(it: OfferItem) {
  return effectiveUnitPrice({
    quantity: 1,
    unit_price: Number(it.unit_price) || 0,
    trade_discount_percent: it.trade_discount_percent,
  });
}

function displayName(it: OfferItem) {
  return [it.brand_name, it.model_code || it.name].filter(Boolean).join(' ') || it.name;
}

const trustBadges = [
  { icon: ShieldCheck, label: '2 г. гаранция', sub: 'Фабрична + монтаж' },
  { icon: Truck, label: 'Безплатен транспорт', sub: 'За Смолян и областта' },
  { icon: BadgeCheck, label: 'Лицензиран монтаж', sub: 'Опитен екип' },
];

function OfferPriceRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className={`text-sm font-bold tabular-nums text-right ${accent ? 'text-[#FF4D00]' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}

function OfferItemPriceBreakdown({ item, currency }: { item: OfferItem; currency: string }) {
  const hasDiscount = Number(item.trade_discount_percent) > 0;
  const hasInstall = item.install_price != null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 sm:mt-5">
      {/* Mobile: редове; Desktop: grid */}
      <div className="sm:hidden space-y-0 rounded-2xl bg-[#F8FAFC] px-4 py-1">
        <OfferPriceRow label="Бройки" value={item.quantity} />
        <OfferPriceRow label="Ед. цена" value={money(item.unit_price, currency)} />
        <OfferPriceRow label={TRADE_DISCOUNT_LABEL} value={formatTradeDiscountPercent(item.trade_discount_percent)} />
        {hasDiscount && (
          <OfferPriceRow
            label={`След ${TRADE_DISCOUNT_LABEL.toLowerCase()}`}
            value={money(unitAfterTradeDiscount(item), currency)}
          />
        )}
        {hasInstall && (
          <OfferPriceRow label={OFFER_INSTALL_LABEL} value={money(item.install_price!, currency)} />
        )}
      </div>

      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {[
          { label: 'Бройки', value: item.quantity },
          { label: 'Ед. цена', value: money(item.unit_price, currency) },
          { label: TRADE_DISCOUNT_LABEL, value: formatTradeDiscountPercent(item.trade_discount_percent) },
          ...(hasDiscount
            ? [{ label: `След ${TRADE_DISCOUNT_LABEL.toLowerCase()}`, value: money(unitAfterTradeDiscount(item), currency) }]
            : []),
          ...(hasInstall ? [{ label: OFFER_INSTALL_LABEL, value: money(item.install_price!, currency) }] : []),
        ].map((cell) => (
          <div key={cell.label} className="min-w-0 rounded-xl bg-[#F8FAFC] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase leading-snug text-gray-400">{cell.label}</div>
            <div className="mt-1 font-bold tabular-nums text-sm text-gray-900 sm:text-base">{cell.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#FFF5ED] px-4 py-3.5">
        <span className="text-xs font-bold uppercase tracking-wide text-[#FF4D00]">Общо за артикула</span>
        <span className="shrink-0 font-outfit text-xl font-black tabular-nums text-[#FF4D00] sm:text-2xl">
          {money(lineTotal(item), currency)}
        </span>
      </div>
    </div>
  );
}

function OfferTotalsSummary({
  data,
  totals,
  compact,
}: {
  data: OfferData;
  totals: { subtotal: number; discount: number; base: number; vat: number; total: number };
  compact?: boolean;
}) {
  const company = data.company;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg sm:rounded-3xl">
      <div className={`bg-[#111827] text-white ${compact ? 'px-4 py-4' : 'px-5 py-5 sm:px-6 sm:py-5'}`}>
        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Крайна цена</div>
        <div className={`mt-1 font-outfit font-black text-[#FF4D00] ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
          {money(totals.total, data.currency)}
        </div>
        <div className="mt-1 text-xs text-gray-400">с включен ДДС {data.vat_rate}%</div>
      </div>

      <div className={`space-y-0 ${compact ? 'px-4 py-3' : 'px-5 py-4 sm:px-6 sm:py-5'}`}>
        <OfferPriceRow label="Междинна сума" value={money(totals.subtotal, data.currency)} />
        {totals.discount > 0 && (
          <OfferPriceRow label="Отстъпка" value={`−${money(totals.discount, data.currency)}`} />
        )}
        <OfferPriceRow label="Без ДДС" value={money(totals.base, data.currency)} />
        <OfferPriceRow label={`ДДС (${data.vat_rate}%)`} value={money(totals.vat, data.currency)} />
        <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-gray-200">
          <span className="font-black text-gray-900">Крайна цена</span>
          <span className="font-outfit text-xl font-black tabular-nums text-[#FF4D00] sm:text-2xl">
            {money(totals.total, data.currency)}
          </span>
        </div>
      </div>

      <div className={compact ? 'px-4 pb-4' : 'px-5 pb-5 sm:px-6 sm:pb-6'}>
        <a
          href={`tel:${company.phoneE164}`}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-sm font-bold text-white shadow-lg shadow-[#FF4D00]/20 active:scale-[0.98] transition sm:h-14 sm:text-base"
        >
          <Phone className="h-4 w-4 shrink-0" />
          Потвърди по телефона
        </a>
      </div>
    </div>
  );
}

function OfferPriceTableMobile({ items, currency }: { items: OfferItem[]; currency: string }) {
  return (
    <div className="space-y-3 sm:hidden">
      {items.map((it) => (
        <div key={`m-${it.id}`} className="rounded-2xl border border-gray-100 bg-[#F8FAFC] p-4">
          <div className="font-semibold text-gray-900 leading-snug pr-2">{displayName(it)}</div>
          <div className="mt-3 space-y-0">
            <OfferPriceRow label="Брой" value={it.quantity} />
            <OfferPriceRow label="Ед. цена" value={money(it.unit_price, currency)} />
            <OfferPriceRow label={TRADE_DISCOUNT_LABEL} value={formatTradeDiscountPercent(it.trade_discount_percent)} />
            {it.install_price != null && (
              <OfferPriceRow label={OFFER_INSTALL_LABEL} value={money(it.install_price, currency)} />
            )}
            <OfferPriceRow label="Общо" value={money(lineTotal(it), currency)} accent />
          </div>
        </div>
      ))}
    </div>
  );
}

function OfferPriceTableDesktop({ items, currency }: { items: OfferItem[]; currency: string }) {
  return (
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-400">
            <th className="pb-3 pr-4">Артикул</th>
            <th className="pb-3 pr-3 text-right whitespace-nowrap">Бр.</th>
            <th className="pb-3 pr-3 text-right whitespace-nowrap">Ед. цена</th>
            <th className="pb-3 pr-3 text-center whitespace-nowrap">{TRADE_DISCOUNT_LABEL}</th>
            <th className="pb-3 pr-3 text-right whitespace-nowrap">{OFFER_INSTALL_LABEL}</th>
            <th className="pb-3 text-right whitespace-nowrap">Общо</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((it) => (
            <tr key={`t-${it.id}`}>
              <td className="py-3.5 pr-4 font-semibold text-gray-900">{displayName(it)}</td>
              <td className="py-3.5 pr-3 text-right tabular-nums text-gray-600">{it.quantity}</td>
              <td className="py-3.5 pr-3 text-right tabular-nums text-gray-900">{money(it.unit_price, currency)}</td>
              <td className="py-3.5 pr-3 text-center tabular-nums font-semibold text-gray-700">
                {formatTradeDiscountPercent(it.trade_discount_percent)}
              </td>
              <td className="py-3.5 pr-3 text-right tabular-nums text-gray-600">
                {it.install_price != null ? money(it.install_price, currency) : '—'}
              </td>
              <td className="py-3.5 text-right font-bold tabular-nums text-[#FF4D00]">
                {money(lineTotal(it), currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OfferViewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<OfferData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/offers/${encodeURIComponent(token)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string }).error || 'Офертата не е намерена');
        if (!cancelled) setData((json as { data: OfferData }).data);
      } catch (e: unknown) {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const totals = useMemo(() => {
    if (!data) return null;
    return {
      subtotal: toEur(data.subtotal, data.currency),
      discount: toEur(data.discount_total, data.currency),
      base: toEur(data.base_excl_vat, data.currency),
      vat: toEur(data.vat_amount, data.currency),
      total: toEur(data.total_incl_vat, data.currency),
    };
  }, [data]);

  const shareSeo = useMemo(() => {
    if (!data || !token) return null;
    return buildOfferShareSeo(data, token);
  }, [data, token]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#F4F6F8] flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-[#FF4D00]/30 border-t-[#FF4D00] animate-spin" />
      </div>
    );
  }

  if (error || !data || !totals) {
    return (
      <div className="min-h-[100dvh] bg-[#F4F6F8] flex flex-col items-center justify-center px-4 text-center">
        <FileText className="h-12 w-12 text-slate-300 mb-4" />
        <h1 className="font-outfit text-xl sm:text-2xl font-bold text-gray-900 mb-2">Офертата не е налична</h1>
        <p className="text-sm sm:text-base text-gray-500 mb-6 max-w-md">{error || 'Линкът е невалиден или офертата е деактивирана.'}</p>
        <Link to="/">
          <Button variant="primary">Към началната страница</Button>
        </Link>
      </div>
    );
  }

  const company = data.company;
  let lastGroup: string | null = null;

  return (
    <div className="min-h-[100dvh] bg-[#F4F6F8] font-sans text-[#111827] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-10">
      <SiteSeo config={shareSeo!} />

      {/* Sticky header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-[#F4F6F8]/95 backdrop-blur-sm'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF4D00] to-[#FF2A4D] text-white font-black text-xs sm:text-sm">
              СК
            </div>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-bold uppercase tracking-wider text-[#FF4D00] sm:text-xs">
                Персонална оферта
              </div>
              <div className="truncate text-[11px] text-gray-500 sm:text-xs">{data.offer_number}</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wide text-gray-400 sm:text-[10px]">Общо</div>
              <div className="text-sm font-black tabular-nums text-[#FF4D00] sm:text-base">
                {money(totals.total, data.currency)}
              </div>
            </div>
            <a
              href={`tel:${company.phoneE164}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#111827] px-3 text-[11px] font-bold text-white active:scale-95 transition sm:h-10 sm:gap-2 sm:px-4 sm:text-xs"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden min-[380px]:inline">{company.phone}</span>
              <span className="min-[380px]:hidden">Обади се</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-8 lg:py-10">
        {/* Hero */}
        <section className="mb-5 overflow-hidden rounded-2xl bg-white shadow-sm sm:mb-8 sm:rounded-[2rem]">
          <div className="relative bg-gradient-to-br from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] px-5 py-7 text-white sm:px-10 sm:py-12">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="relative">
              <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold backdrop-blur-sm sm:text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Валидна до {fmtDate(data.valid_until)}</span>
              </div>
              <h1 className="font-outfit text-2xl font-black leading-[1.08] sm:text-4xl lg:text-5xl lg:max-w-2xl">
                {data.title || 'Оферта за климатизация'}
              </h1>
              {data.object_note && (
                <p className="mt-3 flex items-start gap-2 text-sm text-white/90 sm:items-center sm:text-base">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
                  <span>{data.object_note}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:gap-6 sm:px-10 sm:py-8 sm:grid-cols-3">
            {[
              { icon: Calendar, color: 'text-[#00B4D8]', bg: 'bg-[#F0F9FF]', label: 'Дата', value: fmtDate(data.created_at) },
              { icon: Clock, color: 'text-[#FF4D00]', bg: 'bg-[#FFF5ED]', label: 'Валидност', value: `до ${fmtDate(data.valid_until)}` },
              { icon: User, color: 'text-[#0077B6]', bg: 'bg-[#F0F9FF]', label: 'Клиент', value: data.client_name || '—' },
            ].map((meta) => (
              <div key={meta.label} className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color}`}>
                  <meta.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{meta.label}</div>
                  <div className="font-semibold text-gray-900 leading-snug break-words">{meta.value}</div>
                </div>
              </div>
            ))}
          </div>

          {data.intro_note && (
            <div className="border-t border-gray-100 px-5 pb-6 pt-2 sm:px-10 sm:pb-8">
              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line sm:text-base">{data.intro_note}</p>
            </div>
          )}
        </section>

        {/* Mobile: summary веднага след hero */}
        <div className="mb-5 lg:hidden">
          <OfferTotalsSummary data={data} totals={totals} compact />
        </div>

        {/* Trust badges */}
        <div className="mb-6 grid gap-3 sm:mb-10 sm:grid-cols-3 sm:gap-4">
          {trustBadges.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:gap-4 sm:p-4"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF5ED] text-[#FF4D00] sm:h-12 sm:w-12">
                <b.icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 sm:text-base">{b.label}</div>
                <div className="text-xs text-gray-500">{b.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start xl:grid-cols-[1fr_380px] lg:gap-8">
          {/* Products */}
          <section className="min-w-0 space-y-4 sm:space-y-5">
            <h2 className="font-outfit text-lg font-black sm:text-2xl">
              <span className="text-[#00B4D8]">Предложени</span>{' '}
              <span className="text-[#FF4D00]">климатици</span>
            </h2>

            {data.items.map((it) => {
              const showGroup = Boolean(it.group_label && it.group_label !== lastGroup);
              if (it.group_label) lastGroup = it.group_label;
              const specs = Array.isArray(it.specs) ? it.specs : [];

              return (
                <div key={it.id}>
                  {showGroup && (
                    <div className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#FF4D00] sm:mb-3 sm:mt-5 sm:text-xs">
                      {it.group_label}
                    </div>
                  )}
                  <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm sm:rounded-3xl sm:transition-shadow sm:hover:shadow-lg">
                    {/* Image — full width on mobile */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-[#F0F9FF] to-[#FFF5ED] px-4 py-5 sm:px-6">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={displayName(it)}
                          className="mx-auto h-36 w-full max-w-[280px] object-contain sm:h-44 sm:max-w-none"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-36 items-center justify-center text-gray-300 sm:h-44">
                          <FileText className="h-10 w-10 sm:h-12 sm:w-12" />
                        </div>
                      )}
                      {it.type_name && (
                        <div className="absolute left-3 top-3 rounded-full bg-[#111827]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white sm:left-4 sm:top-4">
                          {it.type_name}
                        </div>
                      )}
                    </div>

                    <div className="p-4 sm:p-6">
                      <h3 className="font-outfit text-base font-black leading-snug text-gray-900 sm:text-xl">
                        {displayName(it)}
                      </h3>
                      {it.description && (
                        <p className="mt-2 text-sm leading-relaxed text-gray-600">{it.description}</p>
                      )}

                      {specs.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {specs.slice(0, 6).map((sp, i) => (
                            <div key={i} className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                              <div className="text-[10px] text-gray-400 leading-tight">{sp.label}</div>
                              <div className="mt-0.5 text-xs font-bold text-gray-900 sm:text-sm">{sp.value}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <OfferItemPriceBreakdown item={it} currency={data.currency} />
                    </div>
                  </article>
                </div>
              );
            })}

            {/* Price table */}
            {data.items.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm sm:mt-8 sm:rounded-3xl">
                <div className="border-b border-gray-100 bg-[#FFF5ED] px-4 py-3.5 sm:px-6 sm:py-4">
                  <h2 className="font-outfit text-base font-black text-[#FF4D00] sm:text-lg">Ценова таблица</h2>
                </div>
                <div className="p-4 sm:p-6">
                  <OfferPriceTableMobile items={data.items} currency={data.currency} />
                  <OfferPriceTableDesktop items={data.items} currency={data.currency} />
                </div>
              </section>
            )}

            {/* Terms */}
            {data.terms_note && (() => {
              const { body, emphasis } = splitOfferTermsEmphasis(data.terms_note);
              return (
                <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:mt-8 sm:rounded-3xl sm:p-8">
                  <h2 className="font-outfit text-base font-black mb-3 sm:text-lg sm:mb-4">Условия на офертата</h2>
                  {body ? (
                    <div className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{body}</div>
                  ) : null}
                  {emphasis ? (
                    <p className="mt-4 whitespace-pre-line text-sm font-bold leading-relaxed text-gray-900">{emphasis}</p>
                  ) : null}
                </section>
              );
            })()}
          </section>

          {/* Desktop sidebar */}
          <aside className="hidden lg:block lg:sticky lg:top-[4.5rem] space-y-5">
            <OfferTotalsSummary data={data} totals={totals} />

            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="font-outfit text-sm font-black uppercase tracking-wide text-gray-900 mb-3">Обобщение</h3>
              <OfferPriceTableDesktop items={data.items} currency={data.currency} />
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-[#F0F9FF] to-[#E0F2FE] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-[#0077B6]" />
                <span className="text-sm font-black text-[#0077B6]">Нужна е помощ?</span>
              </div>
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                Обадете ни се, за да изберем най-доброто решение за вашия обект.
              </p>
              <a
                href={`tel:${company.phoneE164}`}
                className="inline-flex items-center gap-1 text-sm font-bold text-[#0077B6] active:underline"
              >
                {company.phone} <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </aside>
        </div>

        {/* Bottom CTA */}
        <section className="mt-8 overflow-hidden rounded-2xl border-2 border-gray-900 bg-white p-5 text-center sm:mt-10 sm:rounded-[2.5rem] sm:p-10">
          <h2 className="font-outfit text-xl font-black mb-2 text-gray-900 sm:text-4xl">Готови сме да монтираме</h2>
          <p className="text-sm text-gray-600 mb-5 max-w-lg mx-auto sm:text-base sm:mb-6">
            Потвърдете офертата по телефона и нашият екип ще се свърже с вас за уточняване на детайлите и удобна дата.
          </p>
          <a
            href={`tel:${company.phoneE164}`}
            className="inline-flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] px-6 text-sm font-bold text-white shadow-xl shadow-[#FF4D00]/20 active:scale-[0.98] transition sm:h-14 sm:w-auto sm:px-8 sm:text-base"
          >
            <Phone className="h-5 w-5 shrink-0" />
            {company.phone}
          </a>
        </section>

        <footer className="mt-8 border-t border-gray-200 pt-5 text-center text-[11px] text-gray-500 space-y-1.5 sm:mt-10 sm:pt-6 sm:text-xs">
          <div className="flex items-center justify-center gap-2 text-sm font-black text-gray-900">
            <span className="text-[#FF4D00]">СМОЛЯН</span>
            <span className="text-[#0077B6]">КЛИМА</span>
          </div>
          <div className="inline-flex items-start gap-1 justify-center px-2">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{company.tradeAddress}</span>
          </div>
          <div className="px-2 leading-relaxed">
            {company.legalName} · ЕИК {company.eik}
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> · </span>
            ДДС {company.vatNumber} · {company.website}
          </div>
        </footer>
      </main>

      {/* Mobile fixed bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(15,23,42,0.08)] lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Крайна цена</div>
            <div className="font-outfit text-xl font-black tabular-nums text-[#FF4D00]">
              {money(totals.total, data.currency)}
            </div>
          </div>
          <a
            href={`tel:${company.phoneE164}`}
            className="flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] px-5 text-sm font-bold text-white shadow-lg shadow-[#FF4D00]/25 active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" />
            Обади се
          </a>
        </div>
      </div>

      <style>{`
        @media print {
          .sticky, .fixed { position: static !important; }
          a[href^="tel"] { text-decoration: none; color: inherit; }
        }
      `}</style>
    </div>
  );
}
