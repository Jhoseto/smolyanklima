import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '../ui/Button';

import { Logo } from '../ui/Logo';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const location = useLocation();
  const isHome = location.pathname === '/';

  const navLinks = [
    { name: 'Начало', href: '/', isRouter: true },
    { name: 'Каталог', href: '/catalog', isRouter: true },
    { name: 'Блог', href: '/blog', isRouter: true },
    { name: 'Услуги', href: isHome ? '#services' : '/services', isRouter: !isHome },
    { name: 'Проекти', href: isHome ? '#projects' : '/#projects', isRouter: false },
    { name: 'FAQ', href: isHome ? '#faq' : '/#faq', isRouter: false },
    { name: 'Контакти', href: isHome ? '#contact-info' : '/contact', isRouter: !isHome },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[200] transition-all duration-300 pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] isolation isolate ${isScrolled ? 'bg-white/98 md:bg-white/90 md:backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 min-w-0 w-full">

          {/* Logo — flex-1 + min-w-0: стабилно оразмеряване в PWA (без 100vw, което чупи layout в standalone) */}
          <Link to="/" className="flex min-w-0 flex-1 md:flex-none items-center cursor-pointer overflow-hidden">
            <Logo size="sm" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.isRouter ? (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`text-sm font-semibold transition-colors ${
                    location.pathname === link.href
                      ? 'text-[#FF4D00]'
                      : 'text-gray-700 hover:text-[#FF4D00]'
                  }`}
                >
                  {link.name}
                </Link>
              ) : (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm font-semibold text-gray-700 hover:text-[#FF4D00] transition-colors"
                >
                  {link.name}
                </a>
              )
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="tel:+359888585816"
              className="hidden lg:flex items-center gap-2 text-gray-700 font-bold text-sm hover:text-[#FF4D00] transition-colors"
            >
              <Phone className="w-4 h-4 text-[#FF4D00]" />
              0888 58 58 16
            </a>
            <a href="#contact">
              <Button size="sm" className="hidden lg:flex">
                Заяви услуга
              </Button>
            </a>
          </div>

          {/* Mobile Menu Button — винаги видим и кликваем */}
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Затвори меню' : 'Отвори меню'}
            className={`md:hidden shrink-0 p-2 rounded-xl transition-colors touch-manipulation ring-1 ring-black/5 ${isScrolled ? 'text-gray-800 hover:bg-gray-100 bg-transparent' : 'text-gray-800 hover:bg-black/5 shadow-sm bg-white/95'}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" strokeWidth={2.25} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                link.isRouter ? (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-lg font-semibold text-gray-900 hover:text-[#FF4D00]"
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a
                    key={link.name}
                    href={link.href}
                    className="block text-lg font-semibold text-gray-900 hover:text-[#FF4D00]"
                  >
                    {link.name}
                  </a>
                )
              ))}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <a
                  href="tel:+359888585816"
                  className="flex items-center gap-2 text-gray-900 font-bold text-lg hover:text-[#FF4D00] transition-colors active:scale-95"
                >
                  <Phone className="w-5 h-5 text-[#FF4D00]" />
                  0888 58 58 16
                </a>
                <a href="#contact" className="block w-full">
                  <Button className="w-full" onClick={() => setMobileMenuOpen(false)}>
                    Заяви услуга
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
