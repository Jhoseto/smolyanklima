/**
 * Vector Search Service
 * RAG (Retrieval Augmented Generation) implementation
 * Semantic product search using cosine similarity
 */

import type { Product, VectorSearchResult, SemanticQuery, ProductFilters } from '../types';

interface EmbeddingCache {
  [key: string]: number[];
}

class VectorSearchService {
  private products: Product[];
  private embeddings: Map<string, number[]>;
  private cache: EmbeddingCache;

  constructor(products: Product[] = []) {
    this.products = products;
    this.embeddings = new Map();
    this.cache = {};
    
    // Pre-compute embeddings for all products
    this.precomputeEmbeddings();
  }

  /**
   * Search products by semantic similarity
   */
  search(query: string, filters?: ProductFilters, topK: number = 5): VectorSearchResult[] {
    // Preprocess query
    const processedQuery = this.preprocessText(query);
    
    // Generate query embedding
    const queryEmbedding = this.generateEmbedding(processedQuery);
    
    // Score all products
    const results: VectorSearchResult[] = [];
    
    for (const product of this.products) {
      // Apply filters
      if (!this.matchesFilters(product, filters)) {
        continue;
      }
      
      // Get product embedding
      const productEmbedding = this.embeddings.get(product.id);
      if (!productEmbedding) continue;
      
      // Calculate similarity
      const similarity = this.cosineSimilarity(queryEmbedding, productEmbedding);
      
      // Extract matched terms
      const matchedTerms = this.extractMatchedTerms(processedQuery, product);
      
      results.push({
        product,
        score: similarity,
        matchedTerms,
      });
    }
    
    // Sort by score and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Semantic search with multiple keywords
   */
  searchMultiKeywords(keywords: string[], filters?: ProductFilters, topK: number = 5): VectorSearchResult[] {
    const allResults: Map<string, VectorSearchResult> = new Map();
    
    for (const keyword of keywords) {
      const results = this.search(keyword, filters, topK);
      
      for (const result of results) {
        const existing = allResults.get(result.product.id);
        if (existing) {
          // Combine scores
          existing.score = Math.max(existing.score, result.score);
          existing.matchedTerms = [...new Set([...existing.matchedTerms, ...result.matchedTerms])];
        } else {
          allResults.set(result.product.id, result);
        }
      }
    }
    
    return Array.from(allResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Find similar products to a given product
   */
  findSimilar(productId: string, topK: number = 3): VectorSearchResult[] {
    const product = this.products.find(p => p.id === productId);
    if (!product) return [];
    
    const productEmbedding = this.embeddings.get(productId);
    if (!productEmbedding) return [];
    
    const results: VectorSearchResult[] = [];
    
    for (const otherProduct of this.products) {
      if (otherProduct.id === productId) continue;
      
      const otherEmbedding = this.embeddings.get(otherProduct.id);
      if (!otherEmbedding) continue;
      
      const similarity = this.cosineSimilarity(productEmbedding, otherEmbedding);
      
      results.push({
        product: otherProduct,
        score: similarity,
        matchedTerms: [],
      });
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Update product catalog
   */
  updateProducts(products: Product[]): void {
    this.products = products;
    this.precomputeEmbeddings();
  }

  /**
   * Get search statistics
   */
  getStats(): {
    totalProducts: number;
    withEmbeddings: number;
    averageEmbeddingSize: number;
  } {
    let totalSize = 0;
    let count = 0;
    
    for (const embedding of this.embeddings.values()) {
      totalSize += embedding.length;
      count++;
    }
    
    return {
      totalProducts: this.products.length,
      withEmbeddings: count,
      averageEmbeddingSize: count > 0 ? totalSize / count : 0,
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Pre-compute embeddings for all products
   */
  private precomputeEmbeddings(): void {
    for (const product of this.products) {
      const text = this.productToText(product);
      const embedding = this.generateEmbedding(text);
      this.embeddings.set(product.id, embedding);
    }
  }

  /**
   * Convert product to searchable text
   */
  private productToText(product: Product): string {
    const parts = [
      product.name,
      product.brand,
      product.model,
      product.specs.power,
      product.specs.coverage.toString(),
      ...product.features,
      `energy class ${product.energyClass}`,
      `${product.specs.noiseLevel}db quiet`,
      `price ${product.price}`,
    ];
    
    return parts.join(' ').toLowerCase();
  }

  /**
   * Preprocess text for embedding
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate simple bag-of-words embedding
   * In production, this would use a proper embedding model
   */
  private generateEmbedding(text: string): number[] {
    // Check cache
    if (this.cache[text]) {
      return this.cache[text];
    }
    
    // Define vocabulary (top HVAC keywords)
    const vocabulary = [
      // Brands
      'daikin', 'mitsubishi', 'lg', 'fujitsu', 'panasonic', 'toshiba',
      // Room types
      'спалня', 'bedroom', 'всекидневна', 'living', 'детска', 'kids', 'офис', 'office', 'кухня', 'kitchen',
      // Features
      'тих', 'quiet', 'silen', 'икономичен', 'efficient', 'енергиен', 'energy',
      'wi-fi', 'smart', 'inverter', 'инвертор',
      // Specs
      'btu', '9000', '12000', '18000', '24000',
      'кв.м', 'kvm', 'square', 'метра',
      'db', 'децибел', 'noise', 'шум',
      // Price indicators
      'евтин', 'cheap', 'скъп', 'expensive', 'budget', 'премиум', 'premium',
      // Quality
      'качествен', 'quality', 'гаранция', 'warranty', 'надежден', 'reliable',
    ];
    
    // Create bag-of-words vector
    const embedding = vocabulary.map(word => {
      const count = (text.match(new RegExp(word, 'gi')) || []).length;
      return count > 0 ? 1 : 0;
    });
    
    // Add TF-IDF weighting
    const tfIdfEmbedding = this.applyTfIdf(embedding, text, vocabulary);
    
    // Normalize
    const normalized = this.normalizeVector(tfIdfEmbedding);
    
    // Cache result
    this.cache[text] = normalized;
    
    return normalized;
  }

  /**
   * Apply TF-IDF weighting
   */
  private applyTfIdf(embedding: number[], text: string, vocabulary: string[]): number[] {
    const words = text.split(' ');
    const wordCount = words.length;
    
    return embedding.map((count, idx) => {
      if (count === 0) return 0;
      
      // Term Frequency
      const tf = count / wordCount;
      
      // Inverse Document Frequency (simplified)
      const idf = Math.log(1 + (this.products.length / (count + 1)));
      
      return tf * idf;
    });
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) {
      return vector;
    }
    
    return vector.map(val => val / magnitude);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }

  /**
   * Check if product matches filters
   */
  private matchesFilters(product: Product, filters?: ProductFilters): boolean {
    if (!filters) return true;
    
    if (filters.brand && filters.brand.length > 0) {
      if (!filters.brand.includes(product.brand)) return false;
    }
    
    if (filters.priceRange) {
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) {
        return false;
      }
    }
    
    if (filters.energyClass && filters.energyClass.length > 0) {
      if (!filters.energyClass.includes(product.energyClass)) return false;
    }
    
    if (filters.inStock !== undefined) {
      if (product.inStock !== filters.inStock) return false;
    }
    
    if (filters.roomType) {
      if (!product.suitableFor.includes(filters.roomType)) return false;
    }
    
    return true;
  }

  /**
   * Extract which terms from query matched the product
   */
  private extractMatchedTerms(query: string, product: Product): string[] {
    const productText = this.productToText(product);
    const queryWords = query.split(' ');
    const matchedTerms: string[] = [];
    
    for (const word of queryWords) {
      if (word.length < 3) continue;
      
      if (productText.includes(word)) {
        matchedTerms.push(word);
      }
    }
    
    return matchedTerms;
  }
}

// Export singleton
let vectorSearchInstance: VectorSearchService | null = null;

export function getVectorSearchService(products?: Product[]): VectorSearchService {
  if (!vectorSearchInstance) {
    vectorSearchInstance = new VectorSearchService(products || []);
  }
  return vectorSearchInstance;
}

export function resetVectorSearchService(): void {
  vectorSearchInstance = null;
}

export { VectorSearchService };
export type { EmbeddingCache };
