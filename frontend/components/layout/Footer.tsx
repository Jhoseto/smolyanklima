import React from 'react';
import { Facebook, Instagram, Lock, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from '../ui/Logo';

function adminLoginHref(): string {
  const fromEnv = import.meta.env.VITE_ADMIN_ORIGIN?.trim().replace(/\/$/, '');
  if (fromEnv) return `${fromEnv}/login`;
  if (import.meta.env.DEV) return 'http://localhost:3001/login';
  return '/login';
}

export const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white pt-20 pb-10 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center mb-2">
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
            <h3 className="text-lg font-bold mb-6">Бързи връзки</h3>
            <ul className="space-y-4">
              {[
                { name: 'Начало', href: '#home' },
                { name: 'Каталог', href: '/catalog' },
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
            <h3 className="text-lg font-bold mb-6">Услуги</h3>
            <ul className="space-y-4">
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
            <h3 className="text-lg font-bold mb-6">Контакти</h3>
            <ul className="space-y-4">
              <li className="flex gap-3 text-gray-400">
                <MapPin className="w-5 h-5 text-[#FF4D00] shrink-0" />
                <span className="text-sm">гр. Смолян, п.к. 4700<br />ул. Примерна 1</span>
              </li>
              <li className="flex gap-3 text-gray-400">
                <Phone className="w-5 h-5 text-[#FF4D00] shrink-0 mt-0.5" />
                <a href="tel:+359888585816" className="text-sm hover:text-white transition-colors">
                  0888 58 58 16
                </a>
              </li>
              <li className="flex gap-3 text-gray-400">
                <Mail className="w-5 h-5 text-[#FF4D00] shrink-0 mt-0.5" />
                <a href="mailto:office@smolyanklima.bg" className="text-sm hover:text-white transition-colors">
                  office@smolyanklima.bg
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-gray-800 text-center md:flex justify-between items-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Смолян Клима. Всички права запазени.</p>
          <div className="flex gap-4 mt-4 md:mt-0 justify-center">
            <a href="#" className="hover:text-white transition-colors">Политика за поверителност</a>
            <a href="#" className="hover:text-white transition-colors">Общи условия</a>
            <a href="#" className="hover:text-white transition-colors">Developed by K. Serezliev</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
