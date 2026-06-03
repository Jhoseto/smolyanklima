import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Phone, ArrowRight, Zap, ShieldCheck, BadgeCheck, Smartphone, Download, X } from 'lucide-react';
import { BrandsSection } from './BrandsSection';
import { usePWAInstall } from '../../lib/usePWAInstall';
import { HeroImageRotator } from './HeroImageRotator';
import { PWAInstallGuideModal } from '../pwa/PWAInstallGuideModal';

export interface HeroSectionProps {
  /** Отваря прозореца на AI асистента (напр. от бутона „Безплатна консултация“) */
  onFreeConsultationClick?: () => void;
}

export const HeroSection = ({ onFreeConsultationClick }: HeroSectionProps) => {
  const {
    showHeroBanner,
    heroUsesChromiumPrompt,
    iosGuideOpen,
    dismissIosBanner,
    closeIosGuide,
    onHeroBannerActivate,
  } = usePWAInstall();

  return (
    <section
      id="home"
      className="relative flex min-h-[100dvh] flex-col pt-[calc(var(--navbar-height)+0.25rem)] overflow-hidden"
    >
      <div className="flex flex-1 items-center w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 -translate-y-5 sm:-translate-y-6 lg:-translate-y-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center w-full">

          {/* Left Content */}
          <div className="w-full min-w-0 lg:max-w-[650px]">
            {/* PWA — Android: инсталация; iPhone: същият банер → модал със стъпки „Добавяне към началния екран“ */}
            <AnimatePresence>
              {showHeroBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="md:hidden relative w-full mb-5"
                >
                  {!heroUsesChromiumPrompt && (
                    <button
                      type="button"
                      onClick={dismissIosBanner}
                      className="absolute -top-1 -right-1 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-white/95 border border-gray-200 text-gray-500 shadow-sm active:scale-95"
                      aria-label="Скрий напомнянето"
                    >
                      <X className="w-4 h-4" strokeWidth={2} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onHeroBannerActivate}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#FF4D00]/25 bg-gradient-to-r from-[#FFF5ED] to-white shadow-md shadow-orange-100/60 active:scale-[0.97] transition-transform text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF4D00] to-[#FF2A4D] flex items-center justify-center shadow-sm shrink-0">
                      <Smartphone className="w-5 h-5 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="text-left flex-1 min-w-0 pr-2">
                      <p className="text-[10px] font-bold text-[#FF4D00] uppercase tracking-widest leading-none mb-0.5">
                        Безплатно приложение
                      </p>
                      <p className="text-sm font-black text-gray-900 leading-tight">
                        {heroUsesChromiumPrompt ? 'Инсталирай на телефона' : 'Добави към началния екран'}
                      </p>
                      {!heroUsesChromiumPrompt && (
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                          Цял екран като приложение · докосни за стъпки
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Download className="w-4 h-4 text-[#FF4D00]" strokeWidth={2} />
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFF5ED] border border-[#FFDCC2] rounded-full mb-5">
              <div className="w-2 h-2 rounded-full bg-[#FF5722]" />
              <span className="text-[#FF5722] text-sm font-semibold tracking-wide">№1 Доказан лидер на местния пазар</span>
            </div>

            {/* Headline */}
            <h1 className="text-[2.5rem] sm:text-[3rem] lg:text-[3.75rem] font-extrabold leading-[1.05] tracking-tight mb-5">
              <span className="font-light text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 drop-shadow-sm">
                Климатици за
              </span> <br />
              <span className="relative inline-block my-1">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D]">
                  Смолян и региона
                </span>
              </span> <br />
              <span className="font-light text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 drop-shadow-sm mr-3">
                с монтаж
              </span>
              <span className="relative inline-block mt-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] drop-shadow-md">
                  и гаранция
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-50 rounded-full" aria-hidden="true" />
              </span>
            </h1>

            {/* Description */}
            <p className="text-[1.1rem] text-[#374151] mb-6 leading-relaxed font-light">
              Продажба, монтаж и сервиз на климатици от водещи марки. <br />
              Над 25 години опит, стотици доволни клиенти от цялата страна.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Link 
                to="/catalog"
                className="h-14 px-8 rounded-full bg-gradient-to-r from-[#FF5722] to-[#FF2A4D] text-white font-bold text-lg flex items-center gap-2 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.02] transition-all"
              >
                Разгледай каталога
                <ArrowRight className="w-5 h-5" />
              </Link>

              {onFreeConsultationClick ? (
                <button
                  type="button"
                  onClick={onFreeConsultationClick}
                  className="h-14 px-8 rounded-full bg-transparent border border-gray-200 text-[#111827] font-bold text-lg flex items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  <Phone className="w-5 h-5 text-[#00B4D8]" />
                  Безплатна консултация
                </button>
              ) : (
                <a
                  href="tel:+359888585816"
                  className="h-14 px-8 rounded-full bg-transparent border border-gray-200 text-[#111827] font-bold text-lg flex items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all"
                >
                  <Phone className="w-5 h-5 text-[#00B4D8]" />
                  Безплатна консултация
                </a>
              )}
            </div>

          </div>

          {/* Right Image Content — по-голям панел, прозрачни ръбове към фона */}
          <div className="relative w-full min-w-0 max-w-[720px] mx-auto lg:mx-0 lg:ml-auto xl:max-w-[780px]">
            <div className="relative overflow-hidden rounded-[2.5rem]">
              <div
                className="relative"
                style={{
                  WebkitMaskImage:
                    'linear-gradient(to bottom, transparent 0%, #000 24%), linear-gradient(to right, transparent 0%, #000 34%), linear-gradient(to left, transparent 0%, #000 34%)',
                  maskImage:
                    'linear-gradient(to bottom, transparent 0%, #000 24%), linear-gradient(to right, transparent 0%, #000 34%), linear-gradient(to left, transparent 0%, #000 34%)',
                  WebkitMaskComposite: 'source-in',
                  maskComposite: 'intersect',
                }}
              >
                <HeroImageRotator className="h-[340px] sm:h-[440px] lg:h-[clamp(480px,calc(100dvh-var(--navbar-height)-180px),620px)]" />
              </div>

              <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 bg-[#1a1a1a]/75 px-8 py-6 border-t border-white/10">
                <div className="grid grid-cols-3 divide-x divide-white/20">
                  <div className="text-center">
                    <div className="text-white text-2xl font-black mb-1">10000+</div>
                    <div className="text-white/80 text-[11px] font-medium uppercase tracking-wider">Монтирани климатика</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white text-2xl font-black mb-1">25+</div>
                    <div className="text-white/80 text-[11px] font-medium uppercase tracking-wider">Години опит</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white text-2xl font-black mb-1">4.8/5 ★</div>
                    <div className="text-white/80 text-[11px] font-medium uppercase tracking-wider">Средна оценка</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex absolute top-8 -left-8 bg-white shadow-lg rounded-full px-5 py-3 border border-gray-100 items-center gap-2">
              <Zap className="w-5 h-5 text-[#FF5722] fill-[#FF5722]/20" />
              <span className="text-sm font-bold text-gray-800">Монтаж до 48ч</span>
            </div>

            <div className="hidden lg:flex absolute top-1/2 -right-8 -translate-y-1/2 bg-white shadow-lg rounded-full px-5 py-3 border border-gray-100 items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#00B4D8]" />
              <span className="text-sm font-bold text-gray-800">3г. гаранция</span>
            </div>

            <div className="hidden lg:flex absolute bottom-28 -left-6 bg-white shadow-lg rounded-full px-5 py-3 border border-gray-100 items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-[#00A8E8]" />
              <span className="text-sm font-bold text-gray-800">Сертифициран сервиз</span>
            </div>
          </div>

        </div>
      </div>

      {/* Brands Carousel — долу в hero, до края на екрана */}
      <div className="relative z-20 w-full shrink-0 pb-3 sm:pb-4 bg-transparent -mt-6 sm:-mt-8 lg:-mt-10">
        <BrandsSection />
      </div>

      <PWAInstallGuideModal open={iosGuideOpen} onClose={closeIosGuide} />
    </section>
  );
};
