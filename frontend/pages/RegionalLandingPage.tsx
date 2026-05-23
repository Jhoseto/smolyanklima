import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Phone, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SiteSeo } from '../components/seo/SiteSeo';
import { LANDING_PAGE_SEO } from '../lib/seo/config';
import { breadcrumbSchema, localBusinessSchema, serviceSchema } from '../lib/seo/jsonLd';
import { LEGAL_COMPANY } from '../data/legal/company';

type Props = { slug: keyof typeof LANDING_PAGE_SEO };

const HIGHLIGHTS = [
  'Безплатен оглед и консултация',
  'Монтаж до 48 часа',
  'Официална гаранция 3–5 години',
  'Оторизиран сервиз',
  'Изплащане до 36 месеца',
];

export default function RegionalLandingPage({ slug }: Props) {
  const seo = LANDING_PAGE_SEO[slug];
  const isMontaj = slug === 'montaj-smolyan';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!seo) return null;

  const cityLabel = seo.cityName ?? 'Смолян';

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pt-20">
      <SiteSeo
        config={seo}
        schemas={[
          localBusinessSchema(),
          ...(isMontaj ? [serviceSchema()] : []),
          breadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: seo.title.split('|')[0].trim(), path: seo.canonicalPath },
          ]),
        ]}
      />

      <section className="relative overflow-hidden bg-gradient-to-br from-[#EBF5FF] via-white to-[#FFF4ED] py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6 leading-tight"
          >
            {seo.h1}
          </motion.h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 font-light">{seo.lead}</p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#00B4D8] to-[#0077B6] text-white font-bold text-sm shadow-lg"
            >
              Каталог климатици <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href={`tel:${LEGAL_COMPANY.phoneE164}`}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full border-2 border-gray-200 bg-white text-gray-800 font-bold text-sm"
            >
              <Phone className="w-4 h-4 text-[#00B4D8]" /> {LEGAL_COMPANY.phone}
            </a>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-600">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {h}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="prose prose-gray max-w-none">
          {seo.sections.map((block) => (
            <div key={block.title} className="mb-10">
              <h2 className="text-xl font-bold text-gray-900 mb-3">{block.title}</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{block.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[#00B4D8]/20 bg-[#EBF5FF]/50 p-8 text-center">
          <MapPin className="w-8 h-8 text-[#00B4D8] mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Обслужваме {cityLabel} и региона</h3>
          <p className="text-sm text-gray-600 mb-4">{LEGAL_COMPANY.tradeAddress}</p>
          <Link to="/contact" className="text-[#0077B6] font-semibold text-sm hover:underline">
            Виж контакти и карта →
          </Link>
        </div>

        {seo.relatedLinks && seo.relatedLinks.length > 0 && (
          <div className="mt-10 pt-8 border-t border-gray-100">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Също в региона</p>
            <div className="flex flex-wrap gap-2">
              {seo.relatedLinks.map((l) => (
                <Link
                  key={l.path}
                  to={l.path}
                  className="px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-[#00B4D8] hover:text-[#0077B6]"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
