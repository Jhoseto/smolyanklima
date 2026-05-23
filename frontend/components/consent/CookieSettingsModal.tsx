import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { ConsentPreferences } from '../../lib/consent/types';

interface CookieSettingsModalProps {
  initial: ConsentPreferences;
  onSave: (prefs: ConsentPreferences) => void;
  onClose: () => void;
}

const CATEGORIES = [
  {
    key: 'necessary' as const,
    label: 'Необходими',
    description: 'Задължителни за работа на сайта — съхранение на избора ви и предотвратяване на дублирани оценки.',
    locked: true,
  },
  {
    key: 'functional' as const,
    label: 'Функционални',
    description: 'AI асистент, live chat, любими продукти и наскоро разгледани.',
    locked: false,
  },
  {
    key: 'analytics' as const,
    label: 'Аналитични',
    description: 'Google Analytics — анонимна статистика за посещения и поведение на сайта.',
    locked: false,
  },
  {
    key: 'marketing' as const,
    label: 'Маркетингови',
    description: 'Google Maps embed и бъдещи рекламни инструменти.',
    locked: false,
  },
];

export function CookieSettingsModal({ initial, onSave, onClose }: CookieSettingsModalProps) {
  const [prefs, setPrefs] = useState<ConsentPreferences>(initial);

  const toggle = (key: keyof ConsentPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        aria-label="Затвори"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="cookie-settings-title"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 id="cookie-settings-title" className="font-outfit font-bold text-lg text-gray-900">
            Настройки за бисквитки
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Затвори"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Управлявайте категориите бисквитки. Подробности в{' '}
            <Link to="/biskvitki" className="text-[#00B4D8] hover:underline">
              Политиката за бисквитки
            </Link>
            .
          </p>

          {CATEGORIES.map((cat) => {
            const isNecessary = cat.key === 'necessary';
            const checked = isNecessary ? true : prefs[cat.key as keyof ConsentPreferences];

            return (
              <div
                key={cat.key}
                className="flex gap-4 items-start p-4 rounded-xl border border-gray-100 bg-gray-50/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{cat.label}</span>
                    {isNecessary && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Винаги активни
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{cat.description}</p>
                </div>
                <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={cat.locked}
                    onChange={() => {
                      if (!isNecessary && cat.key !== 'necessary') {
                        toggle(cat.key as keyof ConsentPreferences);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <span
                    aria-hidden
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      checked ? 'bg-[#00B4D8]' : 'bg-gray-300'
                    } ${cat.locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        checked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex flex-col sm:flex-row gap-2 rounded-b-2xl">
          <button
            type="button"
            onClick={() => onSave({ functional: true, analytics: true, marketing: true })}
            className="flex-1 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white text-sm font-bold"
          >
            Приемам всички
          </button>
          <button
            type="button"
            onClick={() => onSave(prefs)}
            className="flex-1 px-4 py-2.5 rounded-full border border-[#00B4D8] text-[#00B4D8] text-sm font-bold hover:bg-[#00B4D8]/5"
          >
            Запази избора
          </button>
        </div>
      </div>
    </div>
  );
}
