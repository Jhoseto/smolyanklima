import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock,
  Info,
  Wrench,
  X,
} from 'lucide-react';
import { HeroBackground } from '../components/sections/HeroBackground';
import { SiteSeo } from '../components/seo/SiteSeo';
import { PAGE_SEO } from '../lib/seo/config';
import { breadcrumbSchema, localBusinessSchema } from '../lib/seo/jsonLd';
import { Button } from '../components/ui/Button';
import { CompanyPhoneLink } from '../components/ui/PhoneLink';
import { LEGAL_COMPANY } from '../data/legal/company';
import {
  EXTRA_SERVICES_AND_MATERIALS,
  MOUNT_PRICING_UPDATED,
  MOUNT_WORKING_HOURS,
  STANDARD_MOUNT_EXCLUDES,
  STANDARD_MOUNT_INCLUDES,
  STANDARD_MOUNT_PACKAGES,
} from '../data/mount/pricing';
import { useServiceRequestModal } from '../context/ServiceRequestModalContext';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-[#FF4D00] mb-3">
      {children}
    </span>
  );
}

function PackageCard({
  pkg,
  index,
}: {
  pkg: (typeof STANDARD_MOUNT_PACKAGES)[number];
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.06, duration: 0.45 }}
      className="relative flex flex-col rounded-[1.75rem] border border-gray-100 bg-white p-6 sm:p-7 shadow-sm hover:shadow-xl hover:shadow-gray-200/60 transition-shadow duration-500"
    >
      <div
        className="absolute top-0 left-6 right-6 h-1 rounded-b-full"
        style={{ backgroundColor: pkg.accent }}
      />
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-2">{pkg.title}</p>
      <p className="mt-2 font-outfit text-lg font-bold text-gray-900 leading-snug">{pkg.btu}</p>
      <div className="mt-auto pt-6 flex items-end justify-between gap-4">
        <p className="font-outfit text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
          {pkg.priceEur}
        </p>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${pkg.accent}18`, color: pkg.accent }}
        >
          с ДДС
        </span>
      </div>
    </motion.article>
  );
}

export default function MountPage() {
  const { open: openServiceRequest } = useServiceRequestModal();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#FF4D00]/20 selection:text-[#FF4D00]">
      <SiteSeo
        config={PAGE_SEO.mount}
        schemas={[
          localBusinessSchema(),
          breadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: 'Монтаж', path: '/montaz' },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="relative min-h-[380px] sm:min-h-[440px] overflow-hidden">
        <HeroBackground />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <SectionLabel>Цени и условия</SectionLabel>
            <h1 className="font-outfit text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.05]">
              Професионален{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D]">
                монтаж
              </span>{' '}
              на климатици
            </h1>
            <p className="mt-5 text-lg text-gray-600 leading-relaxed max-w-2xl">
              Прозрачен ценоразпис за стандартен монтаж, допълнителни материали и услуги. Сертифициран
              екип, гаранция за изработката и ясни условия преди започване на работа.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => openServiceRequest({ serviceType: 'installation' })}
              >
                <Wrench className="w-5 h-5" />
                Заяви монтаж
              </Button>
              <CompanyPhoneLink
                showIcon
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border-2 border-gray-200 bg-white font-bold text-gray-800 hover:border-[#FF4D00] hover:text-[#FF4D00] transition-colors"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Standard packages */}
      <section className="py-16 sm:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <SectionLabel>Стандартен монтаж</SectionLabel>
            <h2 className="font-outfit text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Пакетни цени по мощност
            </h2>
            <p className="mt-3 text-gray-600 leading-relaxed">
              Еднократно посещение на адреса — без оглед, предварително полагане на тръби или работа със
              скеле/вишка. Всички цени са в евро (€), с включено ДДС.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {STANDARD_MOUNT_PACKAGES.map((pkg, i) => (
              <PackageCard key={pkg.id} pkg={pkg} index={i} />
            ))}
          </div>
          <p className="mt-8 flex items-start gap-2 text-sm text-gray-500 max-w-3xl">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#00B4D8]" />
            Фирмата си запазва правото за промяна при необходимост. Последна корекция:{' '}
            <strong className="text-gray-700">{MOUNT_PRICING_UPDATED}</strong>
          </p>
        </div>
      </section>

      {/* Includes / Excludes */}
      <section className="py-16 sm:py-20 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <SectionLabel>Условия</SectionLabel>
            <h2 className="font-outfit text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Какво включва стандартният монтаж
            </h2>
          </div>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-10">
            <div className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-6 sm:p-8">
              <h3 className="flex items-center gap-2 font-outfit text-xl font-bold text-gray-900 mb-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Check className="w-5 h-5" />
                </span>
                Включено
              </h3>
              <ul className="space-y-3">
                {STANDARD_MOUNT_INCLUDES.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[2rem] border border-amber-100 bg-gradient-to-br from-amber-50/60 to-white p-6 sm:p-8">
              <h3 className="flex items-center gap-2 font-outfit text-xl font-bold text-gray-900 mb-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <X className="w-5 h-5" />
                </span>
                Не е включено
              </h3>
              <ul className="space-y-3">
                {STANDARD_MOUNT_EXCLUDES.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                    <CircleAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Extra services table */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10 sm:mb-12">
            <SectionLabel>Допълнително</SectionLabel>
            <h2 className="font-outfit text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Материали и допълнителни услуги
            </h2>
            <p className="mt-3 text-gray-600 leading-relaxed">
              Най-често влаганите позиции извън стандартния пакет — заплащат се отделно по този
              ценоразпис.
            </p>
          </div>

          <div className="hidden lg:block overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 font-bold text-gray-900">Услуга / материал</th>
                  <th className="px-4 py-4 font-bold text-gray-900 w-24">Мярка</th>
                  <th className="px-6 py-4 font-bold text-gray-900 w-36">Цена (€)</th>
                </tr>
              </thead>
              <tbody>
                {EXTRA_SERVICES_AND_MATERIALS.map((row, i) => (
                  <tr
                    key={row.service}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  >
                    <td className="px-6 py-4 text-gray-700 leading-snug">{row.service}</td>
                    <td className="px-4 py-4 text-gray-500 font-medium whitespace-nowrap">{row.unit}</td>
                    <td className="px-6 py-4 font-semibold text-[#00B4D8] whitespace-nowrap">{row.priceEur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {EXTRA_SERVICES_AND_MATERIALS.map((row) => (
              <div
                key={row.service}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-gray-900 leading-snug">{row.service}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-gray-100 px-2 py-1 font-bold text-gray-600">{row.unit}</span>
                  <span className="font-bold text-[#00B4D8]">{row.priceEur}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] bg-gray-900 text-white p-8 sm:p-10 lg:p-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div>
              <h2 className="font-outfit text-2xl sm:text-3xl font-extrabold tracking-tight">
                {LEGAL_COMPANY.legalName}
              </h2>
              <div className="mt-4 flex items-center gap-2 text-gray-300">
                <Clock className="w-5 h-5 text-[#FF4D00]" />
                <div className="text-sm">
                  <p>{MOUNT_WORKING_HOURS.weekdays}</p>
                  <p className="text-gray-400">{MOUNT_WORKING_HOURS.weekend}</p>
                </div>
              </div>
              <CompanyPhoneLink
                showIcon
                className="mt-4 inline-flex items-center gap-2 text-lg font-bold hover:text-[#FF4D00] transition-colors"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Button size="lg" className="gap-2" onClick={() => openServiceRequest({ serviceType: 'installation' })}>
                Заяви оглед / монтаж
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-gray-600 font-bold text-white hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors text-center"
              >
                Каталог климатици
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
