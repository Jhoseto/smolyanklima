/**
 * Product Database
 * Чете от data/db.ts и предоставя продукти за AI Assistant
 */

import type { Product } from '../types';

/**
 * Mock products data - will be replaced with actual import from data/db.ts
 */
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'daikin-perfera-9000',
    name: 'Daikin Perfera FTXM35R',
    brand: 'Daikin',
    model: 'FTXM35R',
    price: 1299,
    oldPrice: 1499,
    image: '/images/products/daikin-perfera-9000.jpg',
    specs: {
      power: '2.5 kW',
      coolingCapacity: 9000,
      heatingCapacity: 10000,
      noiseLevel: 19,
      energyEfficiency: 8.5,
      seer: 8.5,
      coverage: 20,
    },
    features: ['Wi-Fi', 'Inverter', 'Plasma Ionizer', 'Quiet Mode'],
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
    suitableFor: ['bedroom', 'living', 'kids'],
    popularityScore: 95,
  },
  {
    id: 'daikin-perfera-12000',
    name: 'Daikin Perfera FTXM42R',
    brand: 'Daikin',
    model: 'FTXM42R',
    price: 1599,
    oldPrice: 1899,
    image: '/images/products/daikin-perfera-12000.jpg',
    specs: {
      power: '3.5 kW',
      coolingCapacity: 12000,
      heatingCapacity: 13000,
      noiseLevel: 21,
      energyEfficiency: 8.2,
      seer: 8.2,
      coverage: 25,
    },
    features: ['Wi-Fi', 'Inverter', 'Plasma Ionizer', 'Smart Control'],
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
    popularityScore: 92,
  },
  {
    id: 'mitsubishi-msz-ln-9000',
    name: 'Mitsubishi Electric MSZ-LN25VG',
    brand: 'Mitsubishi',
    model: 'MSZ-LN25VG',
    price: 1499,
    oldPrice: 1699,
    image: '/images/products/mitsubishi-msz-ln-9000.jpg',
    specs: {
      power: '2.5 kW',
      coolingCapacity: 9000,
      heatingCapacity: 10000,
      noiseLevel: 21,
      energyEfficiency: 9.2,
      seer: 9.2,
      coverage: 20,
    },
    features: ['Wi-Fi', 'Inverter', 'Hyper Heating', '3D Auto'],
    inStock: true,
    rating: 4.9,
    reviewCount: 178,
    energyClass: 'A+++',
    warranty: {
      years: 36,
      compressor: 60,
      parts: 36,
      labor: 36,
    },
    suitableFor: ['bedroom', 'living', 'office'],
    popularityScore: 88,
  },
  {
    id: 'mitsubishi-msz-ln-12000',
    name: 'Mitsubishi Electric MSZ-LN35VG',
    brand: 'Mitsubishi',
    model: 'MSZ-LN35VG',
    price: 1799,
    oldPrice: 1999,
    image: '/images/products/mitsubishi-msz-ln-12000.jpg',
    specs: {
      power: '3.5 kW',
      coolingCapacity: 12000,
      heatingCapacity: 14000,
      noiseLevel: 22,
      energyEfficiency: 9.0,
      seer: 9.0,
      coverage: 25,
    },
    features: ['Wi-Fi', 'Inverter', 'Hyper Heating', 'Air Purification'],
    inStock: true,
    rating: 4.8,
    reviewCount: 145,
    energyClass: 'A+++',
    warranty: {
      years: 36,
      compressor: 60,
      parts: 36,
      labor: 36,
    },
    suitableFor: ['living', 'office', 'kitchen'],
    popularityScore: 85,
  },
  {
    id: 'gree-fairy-9000',
    name: 'Gree Fairy GWH09ACC',
    brand: 'Gree',
    model: 'GWH09ACC',
    price: 899,
    oldPrice: 1099,
    image: '/images/products/gree-fairy-9000.jpg',
    specs: {
      power: '2.6 kW',
      coolingCapacity: 9000,
      heatingCapacity: 10000,
      noiseLevel: 26,
      energyEfficiency: 6.5,
      seer: 6.5,
      coverage: 20,
    },
    features: ['Wi-Fi', 'Inverter', 'Sleep Mode'],
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
    popularityScore: 82,
  },
  {
    id: 'gree-fairy-12000',
    name: 'Gree Fairy GWH12ACC',
    brand: 'Gree',
    model: 'GWH12ACC',
    price: 1099,
    oldPrice: 1299,
    image: '/images/products/gree-fairy-12000.jpg',
    specs: {
      power: '3.5 kW',
      coolingCapacity: 12000,
      heatingCapacity: 13000,
      noiseLevel: 28,
      energyEfficiency: 6.2,
      seer: 6.2,
      coverage: 25,
    },
    features: ['Wi-Fi', 'Inverter', 'Sleep Mode', 'Timer'],
    inStock: true,
    rating: 4.4,
    reviewCount: 87,
    energyClass: 'A+',
    warranty: {
      years: 24,
      compressor: 36,
      parts: 24,
      labor: 24,
    },
    suitableFor: ['living', 'office'],
    popularityScore: 78,
  },
  {
    id: 'toshiba-shorai-edge-9000',
    name: 'Toshiba Shorai Edge RAS-B10J2KVSG-E',
    brand: 'Toshiba',
    model: 'RAS-B10J2KVSG-E',
    price: 1199,
    oldPrice: 1399,
    image: '/images/products/toshiba-shorai-edge-9000.jpg',
    specs: {
      power: '2.6 kW',
      coolingCapacity: 9000,
      heatingCapacity: 10000,
      noiseLevel: 23,
      energyEfficiency: 7.5,
      seer: 7.5,
      coverage: 20,
    },
    features: ['Wi-Fi', 'Inverter', 'Air Purification', 'Ultra Quiet'],
    inStock: true,
    rating: 4.6,
    reviewCount: 112,
    energyClass: 'A++',
    warranty: {
      years: 24,
      compressor: 36,
      parts: 24,
      labor: 24,
    },
    suitableFor: ['bedroom', 'living'],
    popularityScore: 75,
  },
  {
    id: 'toshiba-shorai-edge-12000',
    name: 'Toshiba Shorai Edge RAS-B13J2KVSG-E',
    brand: 'Toshiba',
    model: 'RAS-B13J2KVSG-E',
    price: 1399,
    oldPrice: 1599,
    image: '/images/products/toshiba-shorai-edge-12000.jpg',
    specs: {
      power: '3.6 kW',
      coolingCapacity: 12000,
      heatingCapacity: 13000,
      noiseLevel: 25,
      energyEfficiency: 7.2,
      seer: 7.2,
      coverage: 25,
    },
    features: ['Wi-Fi', 'Inverter', 'Air Purification', 'Self-Cleaning'],
    inStock: true,
    rating: 4.7,
    reviewCount: 89,
    energyClass: 'A++',
    warranty: {
      years: 24,
      compressor: 36,
      parts: 24,
      labor: 24,
    },
    suitableFor: ['living', 'office'],
    popularityScore: 72,
  },
];

/**
 * Get all products
 */
export function getAllProducts(): Product[] {
  return MOCK_PRODUCTS;
}

/**
 * Get product by ID
 */
export function getProductById(id: string): Product | undefined {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}

/**
 * Get products by brand
 */
export function getProductsByBrand(brand: string): Product[] {
  return MOCK_PRODUCTS.filter((p) => p.brand.toLowerCase() === brand.toLowerCase());
}

/**
 * Get products by room type
 */
export function getProductsByRoomType(roomType: string): Product[] {
  return MOCK_PRODUCTS.filter((p) => p.suitableFor.includes(roomType as any));
}

/**
 * Get products by coverage area
 */
export function getProductsByCoverage(maxCoverage: number): Product[] {
  return MOCK_PRODUCTS.filter((p) => p.specs.coverage <= maxCoverage);
}

/**
 * Get products by budget
 */
export function getProductsByBudget(maxPrice: number): Product[] {
  return MOCK_PRODUCTS.filter((p) => p.price <= maxPrice);
}

/**
 * Search products by query
 */
export function searchProducts(query: string): Product[] {
  const lowerQuery = query.toLowerCase();
  return MOCK_PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.brand.toLowerCase().includes(lowerQuery) ||
      p.model.toLowerCase().includes(lowerQuery) ||
      p.features.some((f) => f.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get popular products
 */
export function getPopularProducts(limit: number = 5): Product[] {
  return [...MOCK_PRODUCTS].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, limit);
}

/**
 * Get products on sale
 */
export function getProductsOnSale(): Product[] {
  return MOCK_PRODUCTS.filter((p) => p.oldPrice && p.oldPrice > p.price);
}

export default {
  getAllProducts,
  getProductById,
  getProductsByBrand,
  getProductsByRoomType,
  getProductsByCoverage,
  getProductsByBudget,
  searchProducts,
  getPopularProducts,
  getProductsOnSale,
};
