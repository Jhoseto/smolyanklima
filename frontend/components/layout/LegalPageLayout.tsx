import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

interface LegalPageLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, subtitle, children }: LegalPageLayoutProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pt-[calc(var(--navbar-height)+2rem)] pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="text-sm text-gray-500 mb-6">
          <Link to="/" className="hover:text-[#FF4D00] transition-colors">
            Начало
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{title}</span>
        </nav>

        <header className="mb-10">
          {subtitle && (
            <p className="text-[#FF4D00] text-xs font-bold tracking-[0.2em] uppercase mb-3">
              {subtitle}
            </p>
          )}
          <h1 className="font-outfit text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {title}
          </h1>
        </header>

        <article className="prose prose-gray max-w-none prose-headings:font-outfit prose-a:text-[#00B4D8] prose-a:no-underline hover:prose-a:underline">
          {children}
        </article>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('sk-open-cookie-settings'))}
            className="text-sm font-medium text-[#00B4D8] hover:underline"
          >
            Управление на бисквитки
          </button>
        </div>
      </div>
    </div>
  );
}
