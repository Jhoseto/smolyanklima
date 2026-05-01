import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, MessageCircle, X } from 'lucide-react';

export const FloatingHelp = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-[400] flex flex-col items-start gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 w-64"
          >
            <p className="text-sm font-bold text-gray-800 mb-1">Нужна ви е помощ?</p>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Нашите специалисти са на ваше разположение за безплатна консултация.
            </p>
            <a
              href="tel:+359888585816"
              className="flex items-center gap-3 w-full py-3 px-4 bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-orange-500/30 transition-all mb-2"
            >
              <Phone className="w-4 h-4" />
              Обади се сега
            </a>
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 w-full py-3 px-4 bg-[#EBF5FF] text-[#00B4D8] rounded-xl font-bold text-sm hover:bg-[#00B4D8] hover:text-white transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Направи запитване
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative w-14 h-14 bg-gradient-to-br from-[#FF4D00] to-[#FF2A4D] rounded-full shadow-xl shadow-orange-500/40 flex items-center justify-center text-white"
        aria-label="Помощ"
      >
        {/* Pulse ring */}
        {!open && (
          <span className="absolute inset-0 rounded-full bg-[#FF4D00]/40 animate-ping" />
        )}
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span key="phone" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Phone className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};
