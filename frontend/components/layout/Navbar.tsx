import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';
import { Button } from '../ui/Button';
import { COMPANY_TEL_HREF, LEGAL_COMPANY } from '../../data/legal/company';
import { Logo } from '../ui/Logo';
import { useServiceRequestModal } from '../../context/ServiceRequestModalContext';
import { scrollToHomeSection, scrollToPageTop } from '../../lib/navigation/homeSections';

export const Navbar = () => {
  const headerRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const syncNavHeight = () => {
      const el = headerRef.current;
      if (el) {
        document.documentElement.style.setProperty('--navbar-height', `${el.offsetHeight}px`);
      }
    };
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      syncNavHeight();
    };
    syncNavHeight();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const syncHeight = () => {
      document.documentElement.style.setProperty('--navbar-height', `${el.offsetHeight}px`);
    };
    syncHeight();
    const ro = new ResizeObserver(syncHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isScrolled, mobileMenuOpen]);

  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const isCatalog = location.pathname === '/catalog';
  const { open: openServiceRequest } = useServiceRequestModal();

  const handleServiceRequestClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const contactEl = document.getElementById('contact');
    if (contactEl) {
      contactEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    openServiceRequest();
  };

  // Logo → full page reload (refreshes homepage)
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = '/';
  };

  // "Начало" → scroll to top if already on homepage, otherwise navigate
  const handleHomeClick = (e: React.MouseEvent) => {
    if (isHome) {
      e.preventDefault();
      scrollToPageTop('smooth');
    }
  };

  const handleCatalogClick = (e: React.MouseEvent) => {
    setMobileMenuOpen(false);

    if (location.pathname !== '/catalog') {
      return;
    }

    e.preventDefault();

    if (location.search) {
      navigate('/catalog', { replace: true });
      requestAnimationFrame(() => scrollToPageTop('auto'));
      return;
    }

    scrollToPageTop('smooth');
  };

  const handleHomeSectionClick = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (isHome) {
      scrollToHomeSection(sectionId, 'smooth');
      return;
    }
    navigate({ pathname: '/', hash: `#${sectionId}` });
  };

  type NavLink =
    | { name: string; kind: 'route'; href: string; onClick?: (e: React.MouseEvent) => void }
    | { name: string; kind: 'home-section'; sectionId: string };

  const navLinks: NavLink[] = [
    { name: 'Начало', kind: 'route', href: '/', onClick: handleHomeClick },
    { name: 'Каталог', kind: 'route', href: '/catalog', onClick: handleCatalogClick },
    { name: 'Услуги', kind: 'route', href: isHome ? '#services' : '/services' },
    { name: 'Проекти', kind: 'home-section', sectionId: 'projects' },
    { name: 'Блог', kind: 'route', href: '/blog' },
    { name: 'За нас', kind: 'route', href: '/za-nas' },
    { name: 'FAQ', kind: 'home-section', sectionId: 'faq' },
    { name: 'Контакти', kind: 'route', href: isHome ? '#contact-info' : '/contact' },
  ];

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-[200] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] isolation isolate transition-[background-color,box-shadow] duration-300 ${
        isScrolled
          ? isCatalog
            ? 'bg-white shadow-sm'
            : 'bg-white/98 md:bg-white/90 md:backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      }`}
      style={{
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${isCatalog && isScrolled ? 10 : isScrolled ? 10 : 16}px)`,
        paddingBottom: isCatalog && isScrolled ? 10 : isScrolled ? 10 : 16,
      }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4 w-full">

          {/* Logo — крайно вляво */}
          <a
            href="/"
            onClick={handleLogoClick}
            className="justify-self-start flex shrink-0 items-center cursor-pointer min-w-0"
          >
            <Logo size="sm" />
          </a>

          {/* Desktop Nav — центриран */}
          <nav className="hidden md:flex justify-self-center items-center gap-8 md:col-start-2 md:row-start-1">
            {navLinks.map((link) => {
              if (link.kind === 'home-section') {
                return (
                  <a
                    key={link.name}
                    href={`/#${link.sectionId}`}
                    onClick={(e) => handleHomeSectionClick(e, link.sectionId)}
                    className="text-sm font-semibold text-gray-700 hover:text-[#FF4D00] transition-colors whitespace-nowrap"
                  >
                    {link.name}
                  </a>
                );
              }

              const isHashOnHome = link.href.startsWith('#');
              if (isHashOnHome) {
                const sectionId = link.href.slice(1);
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => handleHomeSectionClick(e, sectionId)}
                    className="text-sm font-semibold text-gray-700 hover:text-[#FF4D00] transition-colors whitespace-nowrap"
                  >
                    {link.name}
                  </a>
                );
              }

              return (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={(e) => {
                    link.onClick?.(e);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-sm font-semibold transition-colors whitespace-nowrap ${
                    location.pathname === link.href
                      ? 'text-[#FF4D00]'
                      : 'text-gray-700 hover:text-[#FF4D00]'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Actions — крайно вдясно */}
          <div className="hidden md:flex justify-self-end items-center gap-4 md:col-start-3 md:row-start-1 shrink-0">
            <a
              href={COMPANY_TEL_HREF}
              className="hidden lg:flex items-center gap-2 text-gray-700 font-bold text-sm hover:text-[#FF4D00] transition-colors whitespace-nowrap"
            >
              <Phone className="w-4 h-4 text-[#FF4D00]" />
              {LEGAL_COMPANY.phone}
            </a>
            <Button size="sm" className="hidden lg:flex shrink-0" onClick={handleServiceRequestClick}>
              Заяви услуга
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Затвори меню' : 'Отвори меню'}
            className={`md:hidden justify-self-end col-start-2 row-start-1 shrink-0 p-2 rounded-xl transition-colors touch-manipulation ring-1 ring-black/5 ${isScrolled ? 'text-gray-800 hover:bg-gray-100 bg-transparent' : 'text-gray-800 hover:bg-black/5 shadow-sm bg-white/95'}`}
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
              {navLinks.map((link) => {
                if (link.kind === 'home-section') {
                  return (
                    <a
                      key={link.name}
                      href={`/#${link.sectionId}`}
                      onClick={(e) => handleHomeSectionClick(e, link.sectionId)}
                      className="block text-lg font-semibold text-gray-900 hover:text-[#FF4D00]"
                    >
                      {link.name}
                    </a>
                  );
                }

                const isHashOnHome = link.href.startsWith('#');
                if (isHashOnHome) {
                  const sectionId = link.href.slice(1);
                  return (
                    <a
                      key={link.name}
                      href={link.href}
                      onClick={(e) => handleHomeSectionClick(e, sectionId)}
                      className="block text-lg font-semibold text-gray-900 hover:text-[#FF4D00]"
                    >
                      {link.name}
                    </a>
                  );
                }

                return (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={(e) => {
                      link.onClick?.(e);
                      setMobileMenuOpen(false);
                    }}
                    className="block text-lg font-semibold text-gray-900 hover:text-[#FF4D00]"
                  >
                    {link.name}
                  </Link>
                );
              })}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <a
                  href={COMPANY_TEL_HREF}
                  className="flex items-center gap-2 text-gray-900 font-bold text-lg hover:text-[#FF4D00] transition-colors active:scale-95"
                >
                  <Phone className="w-5 h-5 text-[#FF4D00]" />
                  {LEGAL_COMPANY.phone}
                </a>
                <Button className="w-full" onClick={handleServiceRequestClick}>
                  Заяви услуга
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
