import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Link, Heart, HeartOff, X } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  icon?: string;
}

interface ToastSystemProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const ToastSystem = ({ toasts, onDismiss }: ToastSystemProps) => {
  return (
    <div className="fixed top-[72px] right-3 sm:top-6 sm:right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="pointer-events-auto flex items-center gap-3 bg-white border border-gray-100 shadow-2xl rounded-2xl px-4 py-3 min-w-[240px] max-w-[300px]"
          >
            <span className="text-lg leading-none">{toast.icon ?? '✅'}</span>
            <p className="text-sm font-semibold text-gray-800 flex-1">{toast.message}</p>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook за управление на toasts
export function useToasts() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((message: string, icon?: string, type: Toast['type'] = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, icon, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

// Hook за LocalStorage favorites
export function useFavorites() {
  const [favorites, setFavorites] = React.useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('sk_favorites') ?? '[]');
    } catch { return []; }
  });

  const toggle = React.useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('sk_favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = React.useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggle, isFavorite };
}
