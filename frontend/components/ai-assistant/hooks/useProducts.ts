/**
 * useProducts Hook
 * Access to product database from data/db.ts
 */

import { useState, useEffect, useMemo } from 'react';
import type { Product } from '../types';

// This would normally import from data/db.ts
// For now, we'll use a mock implementation
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'daikin-9000',
    name: 'Daikin Perfera FTXF35B',
    brand: 'Daikin',
    model: 'FTXF35B',
    price: 1299,
    oldPrice: 1499,
    image: '/images/daikin-perfera.jpg',
    specs: {
      power: '2.5 kW',
      coolingCapacity: 9000,
      heatingCapacity: 10000,
      noiseLevel: 19,
      energyEfficiency: 8.5,
      coverage: 20,
    },
    features: ['Wi-Fi', 'Inverter', 'Plasma Ionizer'],
    inStock: true,
    rating: 4.8,
    reviewCount: 156,
    energyClass: 'A+++',
    warranty: {
      years: 36,
      compressor: 60,
      parts: 36,
      labor: 36,
    },
    suitableFor: ['bedroom', 'living'],
    popularityScore: 95,
  },
  {
    id: 'mitsubishi-12000',
    name: 'Mitsubishi Electric MSZ-LN',
    brand: 'Mitsubishi',
    model: 'MSZ-LN25VGB',
    price: 1599,
    oldPrice: 1799,
    image: '/images/mitsubishi-msz-ln.jpg',
    specs: {
      power: '3.5 kW',
      coolingCapacity: 12000,
      heatingCapacity: 13500,
      noiseLevel: 21,
      energyEfficiency: 9.2,
      coverage: 25,
    },
    features: ['Wi-Fi', 'Inverter', 'Hyper Heating'],
    inStock: true,
    rating: 4.9,
    reviewCount: 203,
    energyClass: 'A+++',
    warranty: {
      years: 36,
      compressor: 60,
      parts: 36,
      labor: 36,
    },
    suitableFor: ['living', 'office'],
    popularityScore: 90,
  },
  {
    id: 'gree-9000',
    name: 'Gree Fairy GWH12ACC',
    brand: 'Gree',
    model: 'GWH12ACC',
    price: 899,
    oldPrice: 1099,
    image: '/images/gree-fairy.jpg',
    specs: {
      power: '2.2 kW',
      coolingCapacity: 9000,
      heatingCapacity: 10000,
      noiseLevel: 26,
      energyEfficiency: 6.5,
      coverage: 20,
    },
    features: ['Wi-Fi', 'Inverter'],
    inStock: true,
    rating: 4.5,
    reviewCount: 98,
    energyClass: 'A+',
    warranty: {
      years: 24,
      compressor: 36,
      parts: 24,
      labor: 24,
    },
    suitableFor: ['bedroom', 'kids'],
    popularityScore: 85,
  },
];

interface UseProductsOptions {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  roomType?: 'bedroom' | 'living' | 'kids' | 'office' | 'kitchen' | 'other';
  minSquareMeters?: number;
  maxSquareMeters?: number;
}

interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  getProductById: (id: string) => Product | undefined;
  searchProducts: (query: string) => Product[];
}

export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load products (simulated)
  const loadProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      // In production, this would import from data/db.ts
      // const { products } = await import('../../../data/db');
      
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      setProducts(MOCK_PRODUCTS);
    } catch (err) {
      setError('Failed to load products');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Filter products based on options
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (options.brand && product.brand !== options.brand) return false;
      if (options.minPrice && product.price < options.minPrice) return false;
      if (options.maxPrice && product.price > options.maxPrice) return false;
      if (options.roomType && !product.suitableFor.includes(options.roomType)) return false;
      if (options.minSquareMeters && product.specs.coverage < options.minSquareMeters) return false;
      if (options.maxSquareMeters && product.specs.coverage > options.maxSquareMeters) return false;
      return true;
    });
  }, [products, options]);

  const getProductById = (id: string): Product | undefined => {
    return products.find((p) => p.id === id);
  };

  const searchProducts = (query: string): Product[] => {
    const lowerQuery = query.toLowerCase();
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(lowerQuery) ||
        product.brand.toLowerCase().includes(lowerQuery) ||
        product.model.toLowerCase().includes(lowerQuery) ||
        product.features.some((f) => f.toLowerCase().includes(lowerQuery))
      );
    });
  };

  return {
    products: filteredProducts,
    loading,
    error,
    refresh: loadProducts,
    getProductById,
    searchProducts,
  };
}

export default useProducts;
