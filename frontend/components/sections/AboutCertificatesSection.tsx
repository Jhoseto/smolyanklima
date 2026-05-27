import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, X, ZoomIn } from 'lucide-react';
import { HeroBackground } from './HeroBackground';
import { ABOUT_CERTIFICATES, type AboutCertificate } from '../../data/about/certificates';

export function AboutCertificatesSection() {
  const [selected, setSelected] = useState<AboutCertificate | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [selected]);

  return (
    <section className="py-20 lg:py-28 bg-[#FAFAFA] relative overflow-hidden">
      <div className="absolute inset-0 opacity-35 pointer-events-none">
        <HeroBackground />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFF5ED] to-white border border-[#FFDCC2] mb-5">
            <ShieldCheck className="w-6 h-6 text-[#FF5722]" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#00B4D8] mb-3">
            Сертификации
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            Официална правоспособност
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Сертификати от Българската браншова камара — машиностроене за монтаж, поддръжка и
            сервиз на климатични и хладилни системи с флуорирани парникови газове.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {ABOUT_CERTIFICATES.map((cert, i) => (
            <motion.article
              key={cert.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className={`group relative flex flex-col rounded-2xl border border-gray-100 bg-white/95 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden ${
                cert.id === 'smolyan-klima' ? 'md:-mt-1 md:shadow-md ring-1 ring-[#FFDCC2]/60' : ''
              }`}
            >
              <div className="h-1.5 bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#00B4D8]" />

              <button
                type="button"
                onClick={() => setSelected(cert)}
                className="relative flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4D8] focus-visible:ring-offset-2"
                aria-label={`Разгледай сертификата на ${cert.holder}`}
              >
                <div className="relative mx-4 mt-4 mb-3 rounded-xl overflow-hidden bg-gradient-to-br from-[#F8F6F3] via-white to-[#F0FAFC] border border-gray-200/80 shadow-inner">
                  <div className="relative h-[220px] sm:h-[240px] lg:h-[260px] p-3 flex items-center justify-center">
                    <img
                      src={cert.image}
                      alt={cert.alt}
                      loading="lazy"
                      decoding="async"
                      className="max-h-full max-w-full object-contain drop-shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-md opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                      <ZoomIn className="w-3.5 h-3.5 text-[#00B4D8]" />
                      Разгледай
                    </span>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#FF5722] bg-[#FFF5ED] px-2.5 py-1 rounded-full mb-3">
                    {cert.category}
                  </span>
                  <h3 className="font-bold text-gray-900 leading-snug mb-1">{cert.holder}</h3>
                  <p className="text-sm text-gray-500 mb-2">{cert.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{cert.description}</p>
                </div>
              </button>
            </motion.article>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Издадени от ББК — машиностроене в съответствие с европейското законодателство за
          флуорирани парникови газове. Документите удостоверяват квалификацията на екипа и
          фирмата за безопасна работа с климатично и хладилно оборудване.
        </p>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10"
            role="dialog"
            aria-modal="true"
            aria-label={`Сертификат — ${selected.holder}`}
          >
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-md"
              aria-label="Затвори"
            />

            <motion.div
              initial={{ scale: 0.94, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 16, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="relative z-10 w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl md:rounded-3xl bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] border border-white/80 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#FFF5ED]/40 to-[#EBF5FF]/40">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#FF5722] mb-1">
                    {selected.category}
                  </p>
                  <h3 className="font-bold text-gray-900 truncate">{selected.holder}</h3>
                  <p className="text-sm text-gray-500">{selected.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="shrink-0 w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
                  aria-label="Затвори"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-auto bg-[#F8F6F3] p-4 sm:p-6 flex-1 flex items-center justify-center">
                <img
                  src={selected.image}
                  alt={selected.alt}
                  className="max-w-full max-h-[min(72vh,820px)] object-contain drop-shadow-lg"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
