import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { ServiceRequestContent, type ServiceType } from './ServiceRequestContent';

interface ServiceRequestModalProps {
  open: boolean;
  onClose: () => void;
  initialServiceType?: ServiceType;
}

export function ServiceRequestModal({ open, onClose, initialServiceType = 'consultation' }: ServiceRequestModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto p-4 sm:p-6 md:items-center">
          <motion.button
            type="button"
            aria-label="Затвори"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-request-modal-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative z-10 w-full max-w-[1400px] my-4 sm:my-8 bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hidden md:block absolute top-0 right-0 w-[400px] h-[400px] bg-orange-50 rounded-full blur-[100px] opacity-50 translate-x-1/3 -translate-y-1/2 pointer-events-none" />
            <div className="hidden md:block absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50 rounded-full blur-[100px] opacity-50 -translate-x-1/3 translate-y-1/2 pointer-events-none" />

            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/90 border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-white transition-colors"
              aria-label="Затвори"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-10 p-4 sm:p-6 md:p-10 lg:p-12 max-h-[min(90vh,calc(100dvh-2rem))] overflow-y-auto">
              <div id="service-request-modal-title" className="sr-only">
                Заявете услуга
              </div>
              <ServiceRequestContent
                key={initialServiceType}
                showTitle
                formIdPrefix="sr-modal"
                animateOnMount
                initialServiceType={initialServiceType}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
