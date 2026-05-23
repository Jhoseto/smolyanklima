import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteSeo } from '../components/seo/SiteSeo';

export default function NotFoundPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-4 pt-20">
      <SiteSeo
        config={{
          title: 'Страницата не е намерена | Смолян Клима',
          description: 'Търсената страница не съществува. Разгледайте каталога с климатици или се свържете с нас.',
          canonicalPath: '/404',
          noindex: true,
        }}
      />
      <h1 className="text-4xl font-black text-gray-900 mb-3">404</h1>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        Страницата не е намерена. Може да е премахната или адресът е грешен.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link to="/" className="px-6 py-3 rounded-full bg-[#00B4D8] text-white font-bold text-sm">
          Начало
        </Link>
        <Link to="/catalog" className="px-6 py-3 rounded-full border border-gray-200 bg-white text-gray-700 font-bold text-sm">
          Каталог климатици
        </Link>
        <Link to="/contact" className="px-6 py-3 rounded-full border border-gray-200 bg-white text-gray-700 font-bold text-sm">
          Контакти
        </Link>
      </div>
    </div>
  );
}
