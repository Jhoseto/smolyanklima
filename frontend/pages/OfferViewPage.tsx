import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Phone, MapPin, Calendar, Clock, ShieldCheck, Truck, BadgeCheck, CheckCircle2, FileText, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { SiteSeo } from '../components/seo/SiteSeo';

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
  return Number(it.quantity) * (Number(it.unit_price) + (Number(it.install_price) || 0));
}

function displayName(it: OfferItem) {
  return [it.brand_name, it.model_code || it.name].filter(Boolean).join(' ') || it.name;
}

const trustBadges = [
  { icon: ShieldCheck, label: '2 г. гаранция', sub: 'Фабрична + монтаж' },
  { icon: Truck, label: 'Безплатен транспорт', sub: 'За Смолян и областта' },
  { icon: BadgeCheck, label: 'Лицензиран монтаж', sub: 'Опитен екип' },
];

export default function OfferViewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<OfferData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-[#FF4D00]/30 border-t-[#FF4D00] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col items-center justify-center px-4 text-center">
        <FileText className="h-12 w-12 text-slate-300 mb-4" />
        <h1 className="font-outfit text-2xl font-bold text-gray-900 mb-2">Офертата не е налична</h1>
        <p className="text-gray-500 mb-6 max-w-md">{error || 'Линкът е невалиден или офертата е деактивирана.'}</p>
        <Link to="/">
          <Button variant="primary">Към началната страница</Button>
        </Link>
      </div>
    );
  }

  const company = data.company;
  let lastGroup: string | null = null;

  return (
    <div className="min-h-screen bg-[#F4F6F8] font-sans text-[#111827]">
      <SiteSeo
        config={{
          title: `${data.title || 'Оферта'} ${data.offer_number} | ${company.tradeName}`,
          description: data.intro_note || `Оферта ${data.offer_number} от ${company.tradeName}`,
          canonicalPath: `/oferta/${token}`,
          noindex: true,
        }}
      />

      {/* Floating top bar */}
      <div
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-[#F4F6F8]'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF4D00] to-[#FF2A4D] text-white font-black text-sm">
              СК
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF4D00]">Персонална оферта</div>
              <div className="text-xs text-gray-500">{data.offer_number}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {totals && (
              <div className="text-right hidden sm:block">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Крайна цена</div>
                <div className="text-sm font-black text-[#FF4D00]">{money(totals.total, data.currency)}</div>
              </div>
            )}
            <a
              href={`tel:${company.phoneE164}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-xs font-bold text-white hover:bg-gray-800 transition"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{company.phone}</span>
              <span className="sm:hidden">Позвъни</span>
            </a>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Hero / Offer intro */}
        <section className="mb-8 overflow-hidden rounded-[2rem] bg-white shadow-sm">
          <div className="relative bg-gradient-to-br from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] px-6 py-8 sm:px-10 sm:py-12 text-white">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Валидна до {fmtDate(data.valid_until)}
              </div>
              <h1 className="font-outfit text-3xl sm:text-5xl font-black leading-[1.05] max-w-2xl">
                {data.title || 'Оферта за климатизация'}
              </h1>
              {data.object_note && (
                <p className="mt-3 flex items-center gap-2 text-white/90 text-sm sm:text-base">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {data.object_note}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-10 sm:py-8 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F9FF] text-[#00B4D8]">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Дата на офертата</div>
                <div className="font-semibold text-gray-900">{fmtDate(data.created_at)}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF5ED] text-[#FF4D00]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Валидност</div>
                <div className="font-semibold text-gray-900">до {fmtDate(data.valid_until)}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F9FF] text-[#0077B6]">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Клиент</div>
                <div className="font-semibold text-gray-900">{data.client_name || '—'}</div>
              </div>
            </div>
          </div>

          {data.intro_note && (
            <div className="border-t border-gray-100 px-6 pb-8 pt-2 sm:px-10">
              <p className="max-w-3xl text-gray-600 leading-relaxed whitespace-pre-line">{data.intro_note}</p>
            </div>
          )}
        </section>

        {/* Trust badges */}
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {trustBadges.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF5ED] text-[#FF4D00]">
                <b.icon className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-gray-900">{b.label}</div>
                <div className="text-xs text-gray-500">{b.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* Product cards */}
          <section className="space-y-5">
            <h2 className="font-outfit text-xl font-black sm:text-2xl">
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
                    <div className="mb-3 mt-5 text-xs font-black uppercase tracking-[0.2em] text-[#FF4D00]">
                      {it.group_label}
                    </div>
                  )}
                  <article className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg">
                    <div className="flex flex-col md:flex-row">
                      {/* Image */}
                      <div className="relative md:w-56 shrink-0 overflow-hidden bg-gradient-to-br from-[#F0F9FF] to-[#FFF5ED] p-5">
                        {it.image_url ? (
                          <img
                            src={it.image_url}
                            alt={displayName(it)}
                            className="mx-auto h-44 w-full object-contain transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-44 items-center justify-center text-gray-300">
                            <FileText className="h-12 w-12" />
                          </div>
                        )}
                        {it.type_name && (
                          <div className="absolute left-4 top-4 rounded-full bg-[#111827]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                            {it.type_name}
                          </div>
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex flex-1 flex-col p-5 md:p-6">
                        <div className="flex flex-1 flex-col">
                          <h3 className="font-outfit text-lg font-black leading-snug text-gray-900 md:text-xl">
                            {displayName(it)}
                          </h3>
                          {it.description && (
                            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600 md:line-clamp-none">
                              {it.description}
                            </p>
                          )}

                          {specs.length > 0 && (
                            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {specs.slice(0, 6).map((sp, i) => (
                                <div
                                  key={i}
                                  className="rounded-xl bg-[#F8FAFC] px-3 py-2 text-xs"
                                >
                                  <div className="text-gray-400">{sp.label}</div>
                                  <div className="font-bold text-gray-900">{sp.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Price breakdown */}
                        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
                          <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Бройки</div>
                            <div className="font-bold text-gray-900">{it.quantity}</div>
                          </div>
                          <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Ед. цена</div>
                            <div className="font-bold text-gray-900">{money(it.unit_price, data.currency)}</div>
                          </div>
                          {it.install_price != null && (
                            <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Монтаж</div>
                              <div className="font-bold text-gray-900">{money(it.install_price, data.currency)}</div>
                            </div>
                          )}
                          <div className="rounded-xl bg-[#FFF5ED] px-3 py-2">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-[#FF4D00]">Общо</div>
                            <div className="font-bold text-[#FF4D00]">{money(lineTotal(it), data.currency)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}

            {/* Terms */}
            {data.terms_note && (
              <section className="mt-8 rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm">
                <h2 className="font-outfit text-lg font-black mb-4">Условия на офертата</h2>
                <div className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{data.terms_note}</div>
              </section>
            )}
          </section>

          {/* Sticky summary */}
          <aside className="lg:sticky lg:top-24 space-y-5">
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-lg">
              <div className="bg-[#111827] px-6 py-5 text-white">
                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Крайна цена</div>
                <div className="mt-1 font-outfit text-3xl font-black text-[#FF4D00]">
                  {totals && money(totals.total, data.currency)}
                </div>
                <div className="mt-1 text-xs text-gray-400">с включен ДДС {data.vat_rate}%</div>
              </div>

              <div className="space-y-3 px-6 py-5">
                {totals && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Междинна сума</span>
                      <span className="font-bold tabular-nums">{money(totals.subtotal, data.currency)}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Отстъпка</span>
                        <span className="font-bold tabular-nums text-red-600">
                          −{money(totals.discount, data.currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Без ДДС</span>
                      <span className="font-bold tabular-nums">{money(totals.base, data.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">ДДС ({data.vat_rate}%)</span>
                      <span className="font-bold tabular-nums">{money(totals.vat, data.currency)}</span>
                    </div>
                  </>
                )}

                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between">
                    <span className="font-black text-gray-900">Крайна цена</span>
                    <span className="font-outfit text-xl font-black text-[#FF4D00]">
                      {totals && money(totals.total, data.currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <a
                  href={`tel:${company.phoneE164}`}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] font-bold text-white shadow-lg shadow-[#FF4D00]/20 hover:opacity-95 transition"
                >
                  <Phone className="h-4 w-4" />
                  Потвърди офертата по телефона
                </a>
              </div>
            </div>

            {/* Mini price table */}
            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="font-outfit text-sm font-black uppercase tracking-wide text-gray-900 mb-3">Ценова таблица</h3>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[300px] text-xs">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      <th className="pb-2 text-left">Артикул</th>
                      <th className="pb-2 text-right">Бр.</th>
                      <th className="pb-2 text-right">Общо</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.items.map((it) => (
                      <tr key={`sum-${it.id}`}>
                        <td className="py-2 font-semibold text-gray-900">{displayName(it)}</td>
                        <td className="py-2 text-right tabular-nums text-gray-500">{it.quantity}</td>
                        <td className="py-2 text-right font-bold tabular-nums text-[#FF4D00]">
                          {money(lineTotal(it), data.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CTA card */}
            <div className="rounded-3xl bg-gradient-to-br from-[#F0F9FF] to-[#E0F2FE] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-[#0077B6]" />
                <span className="text-sm font-black text-[#0077B6]">Нужна е помощ?</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Обадете ни се, за да изберем най-доброто решение за вашия обект.
              </p>
              <a
                href={`tel:${company.phoneE164}`}
                className="inline-flex items-center gap-1 text-sm font-bold text-[#0077B6] hover:underline"
              >
                {company.phone} <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </aside>
        </div>

        {/* Bottom CTA banner */}
        <section className="mt-10 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#111827] via-[#1a1a1a] to-[#111827] p-6 sm:p-10 text-white text-center">
          <h2 className="font-outfit text-2xl sm:text-4xl font-black mb-2">
            Готови сме да монтираме
          </h2>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            Потвърдете офертата по телефона и нашият екип ще се свърже с вас за уточняване на детайлите и удобна дата.
          </p>
          <div className="flex items-center justify-center">
            <a
              href={`tel:${company.phoneE164}`}
              className="inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] px-8 font-bold text-white shadow-xl shadow-[#FF4D00]/20 hover:scale-[1.02] transition"
            >
              <Phone className="h-5 w-5" />
              {company.phone}
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-gray-500 space-y-1">
          <div className="flex items-center justify-center gap-2 text-sm font-black text-gray-900">
            <span className="text-[#FF4D00]">СМОЛЯН</span>
            <span className="text-[#0077B6]">КЛИМА</span>
          </div>
          <div className="inline-flex items-center gap-1 justify-center">
            <MapPin className="h-3 w-3" />
            {company.tradeAddress}
          </div>
          <div>
            {company.legalName} · ЕИК {company.eik} · ДДС {company.vatNumber} · {company.website}
          </div>
        </footer>
      </main>

      <style>{`
        @media print {
          .sticky { position: static !important; }
          a[href^="tel"] { text-decoration: none; color: inherit; }
        }
      `}</style>
    </div>
  );
}
