import React from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';

interface CookieBannerProps {
  onAcceptAll: () => void;
  onReject: () => void;
  onOpenSettings: () => void;
}

export function CookieBanner({ onAcceptAll, onReject, onOpenSettings }: CookieBannerProps) {
  return (
    <div
      role="dialog"
      aria-label="Съгласие за бисквитки"
      className="fixed inset-x-0 bottom-0 z-[10001] p-4 sm:p-6 pointer-events-none"
    >
      <div className="max-w-4xl mx-auto pointer-events-auto bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 p-5 sm:p-6">
        <div className="flex gap-4">
          <div className="hidden sm:flex w-11 h-11 rounded-full bg-[#FF4D00]/10 items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-[#FF4D00]" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-outfit font-bold text-gray-900 text-base sm:text-lg mb-2">
              Бисквитки и поверителност
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Използваме бисквитки за основна функционалност, подобряване на услугите и анализ на
              посещаемостта. Можете да приемете всички, да откажете незадължителните или да
              персонализирате избора си. Повече в{' '}
              <Link to="/biskvitki" className="text-[#00B4D8] hover:underline font-medium">
                Политиката за бисквитки
              </Link>
              .
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onAcceptAll}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white text-sm font-bold hover:shadow-lg transition-shadow"
              >
                Приемам всички
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full border border-gray-200 text-gray-700 text-sm font-bold hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors"
              >
                Настройки
              </button>
              <button
                type="button"
                onClick={onReject}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full text-gray-500 text-sm font-medium hover:text-gray-800 transition-colors"
              >
                Само необходими
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
