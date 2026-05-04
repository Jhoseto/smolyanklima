import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Check, X } from 'lucide-react';
import { WizardFlow } from './WizardFlow';

interface SmartAdvisorSectionProps {
  onOpenChat?: () => void;
}

export const SmartAdvisorSection: React.FC<SmartAdvisorSectionProps> = ({ onOpenChat }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isResultsMode, setIsResultsMode] = useState(false);

  return (
    <section id="smart-advisor" className="py-12 relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#F0FDFE]/30 to-white pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Section header — same style as FeaturesSection */}
        <div className="text-center mb-10">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[11px] font-bold tracking-widest text-[#00B4D8] uppercase mb-4"
          >
            Намери своето решение
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-[2.5rem] font-bold text-gray-900 mb-4"
          >
            Климатик за{' '}
            <span className="text-[#FF4D00]">всяко пространство</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-600 text-sm md:text-base font-medium"
          >
            Отговорете на 9 кратки въпроса — ще намерим перфектния климатик за вашия дом или офис
          </motion.p>
        </div>

        {/* Entry CTA card */}
        <AnimatePresence initial={false}>
          {!isOpen && (
            <motion.div
              key="entry"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              className="max-w-3xl mx-auto rounded-[2rem] border border-[#00B4D8]/20 bg-gradient-to-br from-[#F0FDFE] via-white to-white p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 shadow-lg shadow-[#00B4D8]/5"
            >
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00B4D8]/10 to-[#0077B6]/10 flex items-center justify-center shrink-0">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles className="w-8 h-8 text-[#00B4D8]" strokeWidth={1.5} />
                </motion.div>
              </div>

              {/* Text */}
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Не знаете кой климатик е за вас?
                </h3>
                <p className="text-gray-500 text-sm font-light leading-relaxed">
                  Стартирайте безплатния помощник и за 2 минути ще получите 3 персонализирани препоръки.
                </p>

                {/* Trust signals */}
                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-3">
                  {['Безплатно', 'Без регистрация', '2 минути'].map(t => (
                    <span key={t} className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                      <Check className="w-3 h-3 text-[#00B4D8]" strokeWidth={2.5} />
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA button */}
              <motion.button
                type="button"
                onClick={() => setIsOpen(true)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="shrink-0 flex items-center gap-2 h-12 px-7 rounded-full bg-gradient-to-r from-[#00B4D8] to-[#0077B6] text-white font-bold text-sm shadow-lg shadow-[#00B4D8]/25 hover:shadow-xl hover:shadow-[#00B4D8]/30 transition-shadow"
              >
                Стартирай помощника
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wizard — expands inline */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="overflow-hidden"
            >
              <div className={[
                'mx-auto rounded-[2rem] border border-gray-100 bg-white shadow-2xl shadow-gray-100/60 p-6 md:p-10 transition-all duration-500',
                isResultsMode ? 'max-w-5xl' : 'max-w-2xl',
              ].join(' ')}>
                {/* Wizard header with close */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#00B4D8]" strokeWidth={1.5} />
                    <span className="text-sm font-bold text-gray-700">Умен Избор</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    aria-label="Затвори помощника"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>

                <WizardFlow
                  onOpenChat={onOpenChat}
                  onResultsMode={setIsResultsMode}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
};
