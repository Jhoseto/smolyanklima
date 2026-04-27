/**
 * Hallucination Guard
 * Validates AI responses against real product data to prevent fabrication
 */

import type { Product, FactCheckResult, FactViolation } from '../types';

interface GuardConfig {
  strictMode: boolean;
  logViolations: boolean;
  autoCorrect: boolean;
}

class HallucinationGuard {
  private products: Product[];
  private config: GuardConfig;
  private violations: FactViolation[];

  constructor(products: Product[], config: GuardConfig = { strictMode: true, logViolations: true, autoCorrect: true }) {
    this.products = products;
    this.config = config;
    this.violations = [];
  }

  /**
   * Validate AI response against real product data
   */
  validateResponse(response: string): FactCheckResult {
    this.violations = [];

    // Check for price hallucinations
    this.checkPrices(response);

    // Check for product hallucinations
    this.checkProducts(response);

    // Check for warranty hallucinations
    this.checkWarranties(response);

    // Check for feature hallucinations
    this.checkFeatures(response);

    // Check for brand hallucinations
    this.checkBrands(response);

    const isValid = this.violations.length === 0;
    let correctedContent: string | undefined;

    if (!isValid && this.config.autoCorrect) {
      correctedContent = this.correctResponse(response);
    }

    // Log violations if enabled
    if (!isValid && this.config.logViolations) {
      console.warn('[HallucinationGuard] Violations detected:', this.violations);
    }

    return {
      isValid,
      violations: this.violations,
      correctedContent,
      confidence: isValid ? 1 : Math.max(0, 1 - this.violations.length * 0.2),
    };
  }

  /**
   * Check for fabricated prices
   */
  private checkPrices(response: string): void {
    // Extract price mentions
    const priceMatches = response.matchAll(/(\d{3,5})\s*(лв|lv|лева|лев)/gi);

    for (const match of priceMatches) {
      const price = parseInt(match[1], 10);
      const priceContext = this.getPriceContext(response, match.index || 0);

      // Check if price matches any real product
      const matchingProducts = this.products.filter(
        (p) => Math.abs(p.price - price) < 50 // Allow 50lv tolerance
      );

      // Check for old/discount prices
      const matchingOldPrices = this.products.filter(
        (p) => p.oldPrice && Math.abs(p.oldPrice - price) < 50
      );

      if (matchingProducts.length === 0 && matchingOldPrices.length === 0) {
        // Check if it's a reasonable installation price
        if (price >= 300 && price <= 800 && priceContext.includes('монтаж')) {
          continue; // Acceptable installation price range
        }

        this.violations.push({
          type: 'price_mismatch',
          field: 'price',
          claimed: `${price} lv`,
          actual: 'No matching product found',
          severity: 'error',
        });
      }
    }
  }

  /**
   * Check for non-existent products
   */
  private checkProducts(response: string): void {
    // Check for product mentions that don't exist
    const productNamePatterns = [
      /Daikin\s+([A-Z][a-z]+)/gi,
      /Mitsubishi\s+([A-Z][a-z]+)/gi,
      /LG\s+([A-Z][0-9]+)/gi,
      /Fujitsu\s+([A-Z][a-z]+)/gi,
      /Panasonic\s+([A-Z][a-z]+)/gi,
    ];

    for (const pattern of productNamePatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        const fullName = match[0];
        const exists = this.products.some(
          (p) =>
            p.name.toLowerCase().includes(fullName.toLowerCase()) ||
            p.model.toLowerCase().includes(fullName.toLowerCase())
        );

        if (!exists) {
          this.violations.push({
            type: 'product_not_found',
            field: 'product',
            claimed: fullName,
            actual: 'Product not in catalog',
            severity: 'error',
          });
        }
      }
    }
  }

  /**
   * Check for incorrect warranty claims
   */
  private checkWarranties(response: string): void {
    const warrantyPatterns = [
      /(\d+)\s*години?\s*гаранция/gi,
      /гаранция\s*(\d+)\s*години?/gi,
    ];

    const validWarranties = [24, 36, 60]; // 2, 3, 5 years in months

    for (const pattern of warrantyPatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        const years = parseInt(match[1], 10);
        const months = years * 12;

        if (!validWarranties.includes(months)) {
          this.violations.push({
            type: 'warranty_incorrect',
            field: 'warranty',
            claimed: `${years} years`,
            actual: 'Valid: 24 or 36 months',
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Check for invented features
   */
  private checkFeatures(response: string): void {
    const suspiciousClaims = [
      /wifi[\s-]?control/gi,
      /smart[\s-]?home/gi,
      /app[\s-]?control/gi,
      /самопочистване/gi,
      /ionizer/gi,
    ];

    for (const pattern of suspiciousClaims) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        const claimed = match[0];
        const idx = match.index ?? 0;
        const context = this.getContextAround(response, idx, 60);
        const productContext = this.getProductFromContext(context);

        if (productContext && !this.productHasFeature(productContext, claimed)) {
          this.violations.push({
            type: 'feature_invented',
            field: 'feature',
            claimed,
            actual: 'Feature not verified for this product',
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Check for incorrect brand mentions
   */
  private checkBrands(response: string): void {
    const validBrands = ['daikin', 'mitsubishi', 'lg', 'fujitsu', 'panasonic', 'toshiba', 'carrier', 'hitachi'];

    const brandMatches = response.matchAll(/([A-Z][a-z]+)/g);
    const responseLower = response.toLowerCase();

    for (const match of brandMatches) {
      const brand = match[0].toLowerCase();
      if (!validBrands.includes(brand)) {
        // Check if it looks like an HVAC brand (followed by model number)
        const context = this.getContextAround(response, match.index || 0, 20);
        if (/\d/.test(context)) {
          // Likely a product mention, check if in catalog
          const exists = this.products.some((p) => p.brand.toLowerCase() === brand);
          if (!exists) {
            this.violations.push({
              type: 'product_not_found',
              field: 'brand',
              claimed: match[0],
              actual: 'Brand not in catalog',
              severity: 'warning',
            });
          }
        }
      }
    }
  }

  /**
   * Correct hallucinated content
   */
  private correctResponse(response: string): string {
    let corrected = response;

    this.violations.forEach((violation) => {
      switch (violation.type) {
        case 'price_mismatch':
          // Replace fabricated price with "ще проверя"
          corrected = corrected.replace(this.escapeRegExp(violation.claimed), '[цена ще бъде потвърдена]');
          break;

        case 'product_not_found':
          // Mark as needs verification
          corrected = corrected.replace(
            violation.claimed,
            `${violation.claimed} (ще потвърдя наличността)`
          );
          break;

        case 'warranty_incorrect':
          // Replace with correct warranty
          corrected = corrected.replace(
            /\d+\s*години?\s*гаранция/gi,
            '36 месеца гаранция'
          );
          break;

        default:
          break;
      }
    });

    return corrected;
  }

  private escapeRegExp(text: string): RegExp {
    // Escape string to be used in a new RegExp() constructor.
    // Using a helper avoids accidental double escaping and keeps behavior consistent.
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'gi');
  }

  /**
   * Get context around a position in text
   */
  private getContextAround(text: string, position: number, radius: number): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    return text.substring(start, end);
  }

  /**
   * Get price context
   */
  private getPriceContext(text: string, pricePosition: number): string {
    return this.getContextAround(text, pricePosition, 100).toLowerCase();
  }

  /**
   * Extract product from context
   */
  private getProductFromContext(context: string): Product | null {
    for (const product of this.products) {
      if (context.toLowerCase().includes(product.name.toLowerCase())) {
        return product;
      }
    }
    return null;
  }

  /**
   * Check if product has a specific feature
   */
  private productHasFeature(product: Product, feature: string): boolean {
    const featureLower = feature.toLowerCase();
    return product.features.some((f) => f.toLowerCase().includes(featureLower));
  }

  /**
   * Update product database
   */
  updateProducts(products: Product[]): void {
    this.products = products;
  }

  /**
   * Get recent violations
   */
  getRecentViolations(): FactViolation[] {
    return this.violations;
  }

  /**
   * Validate single price against catalog
   */
  validatePrice(price: number, productName?: string): boolean {
    if (productName) {
      const product = this.products.find(
        (p) =>
          p.name.toLowerCase().includes(productName.toLowerCase()) ||
          p.model.toLowerCase().includes(productName.toLowerCase())
      );
      if (product) {
        return Math.abs(product.price - price) < 50;
      }
    }

    return this.products.some((p) => Math.abs(p.price - price) < 50);
  }

  /**
   * Validate product exists
   */
  validateProduct(productName: string): boolean {
    return this.products.some(
      (p) =>
        p.name.toLowerCase().includes(productName.toLowerCase()) ||
        p.model.toLowerCase().includes(productName.toLowerCase()) ||
        p.brand.toLowerCase() === productName.toLowerCase()
    );
  }
}

// Export factory function
export function createHallucinationGuard(
  products: Product[],
  config?: Partial<GuardConfig>
): HallucinationGuard {
  return new HallucinationGuard(products, {
    strictMode: config?.strictMode ?? true,
    logViolations: config?.logViolations ?? true,
    autoCorrect: config?.autoCorrect ?? true,
  });
}

export { HallucinationGuard };
export type { GuardConfig };
