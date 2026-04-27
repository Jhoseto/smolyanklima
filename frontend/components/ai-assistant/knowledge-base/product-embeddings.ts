/**
 * Product Embeddings
 * Pre-computed semantic vectors for RAG search
 */

import type { Product } from '../types';

/**
 * Pre-computed embeddings for common product-related queries
 * These are simplified semantic vectors for demonstration
 * In production, use actual embeddings from OpenAI/Cohere API
 */
export const PRODUCT_EMBEDDINGS: Record<string, number[]> = {
  // Room type embeddings
  'spalnia': [0.9, 0.1, 0.0, 0.8, 0.2],
  'dnevna': [0.8, 0.2, 0.0, 0.7, 0.3],
  'ofis': [0.7, 0.3, 0.0, 0.6, 0.4],
  'kukhnya': [0.6, 0.4, 0.0, 0.5, 0.5],
  'hol': [0.5, 0.5, 0.0, 0.4, 0.6],
  'magazin': [0.4, 0.6, 0.0, 0.3, 0.7],
  
  // Size embeddings
  '20_kv_m': [0.3, 0.3, 0.4, 0.2, 0.8],
  '25_kv_m': [0.4, 0.4, 0.3, 0.3, 0.7],
  '30_kv_m': [0.5, 0.5, 0.2, 0.4, 0.6],
  '40_kv_m': [0.6, 0.6, 0.1, 0.5, 0.5],
  '50_kv_m': [0.7, 0.7, 0.0, 0.6, 0.4],
  
  // Price embeddings
  'evtin': [0.8, 0.1, 0.1, 0.7, 0.3],
  'budget': [0.7, 0.2, 0.1, 0.6, 0.4],
  'sredna': [0.5, 0.3, 0.2, 0.5, 0.5],
  'skapo': [0.3, 0.4, 0.3, 0.4, 0.6],
  'premium': [0.2, 0.5, 0.3, 0.3, 0.7],
  'luks': [0.1, 0.6, 0.3, 0.2, 0.8],
  
  // Feature embeddings
  'tich': [0.1, 0.1, 0.8, 0.2, 0.8],
  'tiha': [0.2, 0.2, 0.6, 0.3, 0.7],
  'energospestest': [0.3, 0.3, 0.4, 0.4, 0.6],
  'wifi': [0.4, 0.4, 0.2, 0.5, 0.5],
  'smart': [0.5, 0.5, 0.0, 0.6, 0.4],
  'plasma': [0.2, 0.2, 0.6, 0.3, 0.7],
  
  // Brand embeddings
  'daikin': [0.9, 0.1, 0.0, 0.8, 0.2],
  'mitsubishi': [0.85, 0.15, 0.0, 0.75, 0.25],
  'toshiba': [0.7, 0.3, 0.0, 0.6, 0.4],
  'gree': [0.6, 0.4, 0.0, 0.5, 0.5],
};

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generate embedding from text (simplified)
 * In production, use actual embedding API
 */
export function generateEmbedding(text: string): number[] {
  const lowerText = text.toLowerCase();
  const vector = [0, 0, 0, 0, 0];
  
  // Simple keyword matching
  const keywords = Object.keys(PRODUCT_EMBEDDINGS);
  for (const keyword of keywords) {
    if (lowerText.includes(keyword)) {
      const embedding = PRODUCT_EMBEDDINGS[keyword];
      for (let i = 0; i < vector.length; i++) {
        vector[i] += embedding[i];
      }
    }
  }
  
  // Normalize
  const sum = vector.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= sum;
    }
  }
  
  return vector;
}

/**
 * Find most similar products based on query
 */
export function findSimilarProducts(
  query: string,
  products: Product[],
  topK: number = 3
): Product[] {
  const queryEmbedding = generateEmbedding(query);
  
  const scored = products.map((product) => {
    const productText = `${product.name} ${product.brand} ${product.model} ${product.suitableFor.join(' ')}`.toLowerCase();
    const productEmbedding = generateEmbedding(productText);
    const similarity = cosineSimilarity(queryEmbedding, productEmbedding);
    
    return { product, similarity };
  });
  
  scored.sort((a, b) => b.similarity - a.similarity);
  
  return scored.slice(0, topK).map((s) => s.product);
}

/**
 * Pre-compute embeddings for all products
 */
export function precomputeProductEmbeddings(products: Product[]): Map<string, number[]> {
  const embeddings = new Map<string, number[]>();
  
  for (const product of products) {
    const text = `${product.name} ${product.brand} ${product.model} ${product.suitableFor.join(' ')}`;
    embeddings.set(product.id, generateEmbedding(text));
  }
  
  return embeddings;
}

export default PRODUCT_EMBEDDINGS;
