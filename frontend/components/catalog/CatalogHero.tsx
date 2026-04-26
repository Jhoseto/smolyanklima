import React, { useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ScrambleText } from './ScrambleText';

// ── Animated Counter ─────────────────────────────────
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 60, damping: 15 });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, motionValue, value]);

  useEffect(() => {
    return spring.on('change', (v) => {
      if (ref.current) ref.current.textContent = Math.round(v) + suffix;
    });
  }, [spring, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

const stats = [
  { value: 50, suffix: '+', label: 'Модела' },
  { value: 10, suffix: '+', label: 'Водещи марки' },
  { value: 24, suffix: 'ч', label: 'Монтаж' },
];

export const CatalogHero = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Parallax transforms
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "80%"]);
  const statsY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  return (
    <section ref={containerRef} className="relative pt-24 pb-8 lg:pt-28 lg:pb-12 overflow-hidden bg-white flex items-center min-h-[300px] lg:min-h-[350px]">
      
      {/* ── Background Image & Overlays ─────────────── */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-90"
        style={{ backgroundImage: `url('/images/hero-new.jpg')` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent opacity-90" />

      {/* ── Animated background blobs (subtle) ──────── */}
      <motion.div
        style={{ y: bgY }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
        className="absolute top-0 left-0 w-[400px] h-[400px] bg-gradient-to-br from-[#FF4D00] to-[#FF2A4D] rounded-full blur-[120px] pointer-events-none z-0"
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
          
          <div className="flex-1">
            {/* ── Breadcrumb ──────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 text-xs text-gray-500 mb-4 lg:mb-6"
            >
              <Link to="/" className="hover:text-gray-900 transition-colors">Начало</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-800 font-medium">Каталог</span>
            </motion.div>

            {/* ── Title ───────────────────────────────── */}
            <motion.div
              style={{ y: textY }}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-left"
            >
              <h1 className="font-outfit leading-[1.0] tracking-tighter cursor-default flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                <span className="text-[2rem] md:text-[3rem] lg:text-[3.5rem] text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] font-extralight mb-1">
                  Нашият
                </span>
                <span className="relative inline-block">
                  <span className="absolute -inset-4 blur-2xl bg-gradient-to-r from-[#FF4D00]/40 to-[#FF2A4D]/40 rounded-full opacity-60" />
                  <span className="relative text-[3rem] md:text-[4rem] lg:text-[5rem] text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase tracking-tight">
                    <ScrambleText text="КАТАЛОГ" scrambleSpeed={50} />
                  </span>
                </span>
              </h1>
              <p className="mt-4 text-gray-600 font-medium text-sm md:text-base max-w-lg leading-relaxed">
                Климатици от водещи световни марки – с монтаж, гаранция и сервиз в Смолян и региона.
              </p>
            </motion.div>
          </div>

          {/* ── Stats ───────────────────────────────── */}
          <motion.div
            style={{ y: statsY }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex gap-3 md:gap-4 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0"
          >
            {stats.map((stat, i) => (
              <div
                key={i}
                className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl px-5 py-3 text-center min-w-[90px] flex-1 lg:flex-none shadow-sm"
              >
                <div className="text-xl md:text-2xl font-black text-gray-900 mb-0.5">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">{stat.label}</div>
              </div>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
};
