import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';
import { CatalogProductImage } from '../catalog/CatalogProductImage';

interface BlogProductEmbedProps {
  product: CatalogProduct;
  label?: string;
}

export const BlogProductEmbed: React.FC<BlogProductEmbedProps> = ({ product, label }) => {
  return (
    <aside className="not-prose my-8 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-40 h-40 sm:h-auto bg-gray-50 shrink-0 flex items-center justify-center p-4">
          <CatalogProductImage
            src={product.image}
            alt={product.name}
            className="w-full h-full max-h-32 object-contain"
          />
        </div>
        <div className="flex-1 p-5 flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#00B4D8] mb-1">
            Препоръчан модел
          </p>
          <p className="text-xs font-semibold text-gray-500 mb-0.5">{product.brand}</p>
          <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug">
            {label || product.name}
          </h3>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-2xl font-black bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] bg-clip-text text-transparent">
              €{product.price.toLocaleString('bg-BG')}
            </span>
            {product.energyClass ? (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-bold text-gray-700">
                {product.energyClass}
              </span>
            ) : null}
            {product.area ? (
              <span className="text-xs text-gray-500">{product.area}</span>
            ) : null}
          </div>
          <Link
            to={`/product/${product.id}`}
            className="inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white text-sm font-bold hover:shadow-lg hover:scale-[1.02] transition-all"
          >
            Виж в каталога
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
};

export const BlogProductEmbedSkeleton: React.FC = () => (
  <div className="not-prose my-8 rounded-2xl border border-gray-100 bg-white p-5 animate-pulse">
    <div className="flex gap-4">
      <div className="w-24 h-24 bg-gray-200 rounded-xl shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-8 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  </div>
);

export const BlogProductEmbedMissing: React.FC<{ slug: string }> = ({ slug }) => (
  <div className="not-prose my-6 flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
    <Package className="w-4 h-4 shrink-0" />
    <span>
      Продуктът <code className="text-xs bg-white px-1 py-0.5 rounded">{slug}</code> не е намерен в каталога.
    </span>
  </div>
);
