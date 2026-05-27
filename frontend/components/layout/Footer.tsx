import React from 'react';
import { Facebook, Instagram, Lock, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { LEGAL_COMPANY } from '../../data/legal/company';

function adminLoginHref(): string {
  const fromEnv = import.meta.env.VITE_ADMIN_ORIGIN?.trim().replace(/\/$/, '');
  if (fromEnv) return `${fromEnv}/login`;
  if (import.meta.env.DEV) return 'http://localhost:3001/login';
  return '/login';
}

export const Footer = () => {
  const c = LEGAL_COMPANY;
  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 mb-10">

          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center">
              <Logo isDark={true} size="md" />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Вашият доверен партньор за климатизация в Смолян и региона. Ние предлагаме качествени решения за вашия комфорт у дома и в офиса.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-[#FF4D00] hover:text-white transition-colors text-gray-400">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-[#FF4D00] hover:text-white transition-colors text-gray-400">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
            <a
              href={adminLoginHref()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-[#FF4D00] hover:text-[#FF4D00]"
            >
              <Lock className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Административен портал
            </a>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-lg font-bold mb-3">Бързи връзки</h3>
            <ul className="space-y-1.5">
              {[
                { name: 'Начало', href: '#home' },
                { name: 'Каталог', href: '/catalog' },
                { name: 'За нас', href: '/za-nas' },
                { name: 'Услуги', href: '#services' },
                { name: 'Проекти', href: '#projects' },
                { name: 'FAQ', href: '#faq' },
                { name: 'Контакти', href: '#contact-info' }
              ].map((item) => (
                <li key={item.name}>
                  <a href={item.href} className="text-gray-400 hover:text-[#FF4D00] transition-colors text-sm font-medium">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-bold mb-3">Услуги</h3>
            <ul className="space-y-1.5">
              {['Продажба на климатици', 'Професионален монтаж', 'Профилактика и почистване', 'Сервиз и ремонт', 'Оглед и консултация'].map((item) => (
                <li key={item}>
                  <a href="#services" className="text-gray-400 hover:text-[#FF4D00] transition-colors text-sm font-medium">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-bold mb-3">Контакти</h3>
            <ul className="space-y-2">
              <li className="flex gap-3 text-gray-400">
                <MapPin className="w-5 h-5 text-[#FF4D00] shrink-0" />
                <span className="text-sm">
                  {c.tradeAddress}
                  {c.postalCode.startsWith('[') ? null : (
                    <>
                      <br />
                      п.к. {c.postalCode}
                    </>
                  )}
                </span>
              </li>
              <li className="flex gap-3 text-gray-400">
                <Phone className="w-5 h-5 text-[#FF4D00] shrink-0 mt-0.5" />
                <a href={`tel:${c.phoneE164}`} className="text-sm hover:text-white transition-colors">
                  {c.phone}
                </a>
              </li>
              <li className="flex gap-3 text-gray-400">
                <Mail className="w-5 h-5 text-[#FF4D00] shrink-0 mt-0.5" />
                <a href={`mailto:${c.email}`} className="text-sm hover:text-white transition-colors">
                  {c.email}
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-6 border-t border-gray-800 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-500">
          <p className="shrink-0">© {new Date().getFullYear()} Смолян Клима. Всички права запазени.</p>
          <nav className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5" aria-label="Правни връзки">
            <a href="/politika-za-poveritelnost" className="hover:text-white transition-colors whitespace-nowrap">Политика за поверителност</a>
            <a href="/biskvitki" className="hover:text-white transition-colors whitespace-nowrap">Бисквитки</a>
            <a href="/obshti-usloviya" className="hover:text-white transition-colors whitespace-nowrap">Общи условия</a>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('sk-open-cookie-settings'))}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Управление на бисквитки
            </button>
            <a href="#" className="hover:text-white transition-colors whitespace-nowrap">Developed by K. Serezliev</a>
          </nav>
        </div>
      </div>
    </footer>
  );
};
