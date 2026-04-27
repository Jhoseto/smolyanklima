import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Phone, ArrowRight, CheckCircle2, Zap, ShieldCheck, BadgeCheck } from 'lucide-react';
import { BrandsSection } from './BrandsSection';

export const HeroSection = () => {
  return (
    <section id="home" className="relative pt-32 pb-12 lg:pt-40 lg:pb-16 overflow-hidden">
      {/* Background Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-50/80 rounded-full blur-[100px] pointer-events-none z-0" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center mb-16 lg:mb-24">

          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-[650px]"
          >
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFF5ED] border border-[#FFDCC2] rounded-full mb-8">
              <div className="w-2 h-2 rounded-full bg-[#FF5722]" />
              <span className="text-[#FF5722] text-sm font-semibold tracking-wide">№1 Доказан лидер на местния пазар</span>
            </div>

            {/* Headline */}
            <h1 className="text-[3rem] lg:text-[3.75rem] font-extrabold leading-[1.05] tracking-tight mb-8">
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 drop-shadow-sm">
                Климатици за
              </span> <br />
              <span className="relative inline-block my-1 whitespace-nowrap">
                <span className="absolute -inset-1 blur-lg bg-gradient-to-r from-[#FF4D00]/30 to-[#FF2A4D]/30 opacity-70"></span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] drop-shadow-sm">
                  Смолян и региона
                </span>
              </span> <br />
              <div className="whitespace-nowrap mt-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 drop-shadow-sm mr-3">
                  с монтаж
                </span>
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] drop-shadow-md">
                    и гаранция
                  </span>
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8] to-[#00B4D8]/0 opacity-50 rounded-full" />
                </span>
              </div>
            </h1>

            {/* Description */}
            <p className="text-[1.1rem] text-[#374151] mb-10 leading-relaxed font-medium">
              Продажба, монтаж и сервиз на климатици от водещи марки. Над 25 години опит, стотици доволни клиенти от цялата страна.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-12">
              <Link 
                to="/catalog"
                className="h-14 px-8 rounded-full bg-gradient-to-r from-[#FF5722] to-[#FF2A4D] text-white font-bold text-lg flex items-center gap-2 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.02] transition-all"
              >
                Разгледай продукти
                <ArrowRight className="w-5 h-5" />
              </Link>

              <button className="h-14 px-8 rounded-full bg-transparent border border-gray-200 text-[#111827] font-bold text-lg flex items-center gap-2 hover:bg-gray-50 transition-all">
                <Phone className="w-5 h-5 text-[#00B4D8]" />
                Безплатна консултация
              </button>
            </div>

            {/* Checkmarks */}
            <div className="flex flex-wrap items-center gap-6">
              {[
                { text: 'Безплатна консултация' },
                { text: 'Гаранция 2 години' },
                { text: 'Монтаж с гаранция' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  <span className="text-sm font-semibold text-[#4B5563]">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Image Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative lg:ml-auto w-full max-w-[600px]"
          >
            {/* Main Image */}
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl">
              <img
                src="/images/hero-ac.jpg"
                alt="Климатик в модерен интериор"
                className="w-full h-[550px] object-cover"
              />

              {/* Glass Stats Banner (Inside image at bottom) */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-md px-8 py-6 rounded-b-[2.5rem] border-t border-white/10">
                <div className="grid grid-cols-3 divide-x divide-white/20">
                  <div className="text-center">
                    <div className="text-white text-2xl font-black mb-1">1500+</div>
                    <div className="text-white/80 text-[11px] font-medium uppercase tracking-wider">Монтирани климатика</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white text-2xl font-black mb-1">25+</div>
                    <div className="text-white/80 text-[11px] font-medium uppercase tracking-wider">Години опит</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white text-2xl font-black mb-1">4.9★</div>
                    <div className="text-white/80 text-[11px] font-medium uppercase tracking-wider">Средна оценка</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badges */}
            <motion.div
              animate={{ y: [-5, 5, -5] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute top-8 -left-8 bg-white/95 backdrop-blur-sm shadow-xl rounded-full px-5 py-3 border border-gray-100 flex items-center gap-2"
            >
              <Zap className="w-5 h-5 text-[#FF5722] fill-[#FF5722]/20" />
              <span className="text-sm font-bold text-gray-800">Монтаж до 48ч</span>
            </motion.div>

            <motion.div
              animate={{ y: [5, -5, 5] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="absolute top-1/2 -right-8 -translate-y-1/2 bg-white/95 backdrop-blur-sm shadow-xl rounded-full px-5 py-3 border border-gray-100 flex items-center gap-2"
            >
              <ShieldCheck className="w-5 h-5 text-[#00B4D8]" />
              <span className="text-sm font-bold text-gray-800">2г. гаранция</span>
            </motion.div>

            <motion.div
              animate={{ y: [-5, 5, -5] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-28 -left-6 bg-white/95 backdrop-blur-sm shadow-xl rounded-full px-5 py-3 border border-gray-100 flex items-center gap-2"
            >
              <BadgeCheck className="w-5 h-5 text-[#00A8E8]" />
              <span className="text-sm font-bold text-gray-800">Сертифицирани</span>
            </motion.div>

          </motion.div>

        </div>
      </div>

      {/* Brands Carousel - извън контейнера за пълна ширина и прозрачен фон */}
      <div className="mt-0 lg:mt-[-20px] relative z-20 w-full bg-transparent">
        <BrandsSection />
      </div>
    </section>
  );
};
