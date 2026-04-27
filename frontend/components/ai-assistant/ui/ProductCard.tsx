/**
 * Product Card Component
 * Display product information in chat
 */

import React from 'react';
import { Star, ShoppingCart, ChevronRight, Zap, Volume2 } from 'lucide-react';
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  primaryColor: string;
  onAddToCart?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  primaryColor,
  onAddToCart,
  onViewDetails,
}) => {
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)
    : 0;

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        maxWidth: 280,
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 140, backgroundColor: '#f8fafc' }}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: 12,
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: 14,
            }}
          >
            Няма изображение
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: '#ef4444',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            -{discountPercent}%
          </div>
        )}

        {/* Stock Badge */}
        {!product.inStock && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: '#64748b',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            Изчерпано
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: 12 }}>
        {/* Brand & Name */}
        <div style={{ fontSize: 11, color: primaryColor, fontWeight: 600, marginBottom: 4 }}>
          {product.brand}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#1e293b',
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        >
          {product.name}
        </div>

        {/* Rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          <Star size={12} fill="#fbbf24" color="#fbbf24" />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {product.rating} ({product.reviewCount})
          </span>
        </div>

        {/* Specs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} color={primaryColor} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{product.specs.power}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Volume2 size={12} color={primaryColor} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{product.specs.noiseLevel}dB</span>
          </div>
        </div>

        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: product.inStock ? '#1e293b' : '#94a3b8',
            }}
          >
            {product.price} лв
          </span>
          {hasDiscount && (
            <span
              style={{
                fontSize: 13,
                color: '#94a3b8',
                textDecoration: 'line-through',
              }}
            >
              {product.oldPrice} лв
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onViewDetails?.(product)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: `1px solid ${primaryColor}`,
              color: primaryColor,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = primaryColor;
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = primaryColor;
            }}
          >
            Детайли
            <ChevronRight size={14} />
          </button>

          {product.inStock && (
            <button
              onClick={() => onAddToCart?.(product)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                backgroundColor: primaryColor,
                border: 'none',
                color: 'white',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0284c7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = primaryColor;
              }}
            >
              <ShoppingCart size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
