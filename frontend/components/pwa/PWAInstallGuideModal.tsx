import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, PlusSquare, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PWAInstallGuideModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="pwa-install-backdrop"
            type="button"
            aria-label="Затвори"
            className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="pwa-install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            className="fixed left-4 right-4 bottom-6 sm:left-auto sm:right-6 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:w-[min(420px,calc(100vw-3rem))] z-[101] rounded-3xl bg-white shadow-2xl shadow-gray-900/20 border border-gray-100 overflow-hidden"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <p id="pwa-install-title" className="text-lg font-black text-gray-900 leading-tight">
                  Добавяне към началния екран
                </p>
                <p className="text-sm text-gray-500 mt-1 leading-snug">
                  След това „Смолян Клима“ се отваря като приложение на цял екран.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                aria-label="Затвори"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <ol className="px-5 py-4 space-y-4 text-[15px] text-gray-800">
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF5ED] text-[#FF4D00] font-black text-sm">
                  1
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="font-bold text-gray-900 mb-1 flex items-center gap-2 flex-wrap">
                    Докоснете{' '}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-800 text-sm font-semibold">
                      <Share2 className="w-4 h-4" strokeWidth={2} />
                      Споделяне
                    </span>
                  </p>
                  <p className="text-gray-600 leading-relaxed">
                    Иконата е в долната лента на Safari (квадрат със стрелка нагоре). В Chrome за iPhone е в долното меню.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF5ED] text-[#FF4D00] font-black text-sm">
                  2
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="font-bold text-gray-900 mb-1 flex items-center gap-2 flex-wrap">
                    Изберете{' '}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-800 text-sm font-semibold">
                      <PlusSquare className="w-4 h-4" strokeWidth={2} />
                      Добавяне към началния екран
                    </span>
                  </p>
                  <p className="text-gray-600 leading-relaxed">
                    Може да се наложи да плъзнете реда нагоре, за да видите опцията.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF5ED] text-[#FF4D00] font-black text-sm">
                  3
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="font-bold text-gray-900 mb-1">Потвърдете „Добавяне“</p>
                  <p className="text-gray-600 leading-relaxed">
                    Иконата ще се появи на началния екран — отваря се без адресна лента.
                  </p>
                </div>
              </li>
            </ol>

            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#FF5722] to-[#FF2A4D] text-white font-bold text-base shadow-md shadow-orange-500/25 active:scale-[0.98] transition-transform"
              >
                Разбрах
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
