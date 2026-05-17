import { inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";

export type SimilarProductSpecs = {
  coverage_m2?: number | null;
  noise_db?: number | null;
  cooling_power_kw?: number | null;
  heating_power_kw?: number | null;
  energy_class_cool?: string | null;
  energy_class_heat?: string | null;
  wifi?: boolean | null;
};

export type SimilarProductRow = {
  id: string;
  slug: string;
  brand_id?: string | null;
  type_id?: string | null;
  model_code?: string | null;
  price?: number | null;
  product_condition?: string | null;
  stock_status?: string | null;
  brands?: { name?: string } | null;
  product_specs?: SimilarProductSpecs[];
};

function energyClassRank(ec: string | null | undefined): number {
  const m = String(ec ?? "").match(/A\+*/i);
  if (!m) return 0;
  return m[0].length;
}

function firstSpec(row: SimilarProductRow): SimilarProductSpecs | undefined {
  return row.product_specs?.[0];
}

/** Score how well `candidate` matches `source` (higher = better). */
export function scoreSimilarProduct(source: SimilarProductRow, candidate: SimilarProductRow): number {
  if (source.id === candidate.id) return -1000;

  if (source.type_id && candidate.type_id && source.type_id !== candidate.type_id) {
    return -1000;
  }

  const srcSpec = firstSpec(source);
  const candSpec = firstSpec(candidate);
  const srcKw = srcSpec?.cooling_power_kw ?? null;
  const candKw = candSpec?.cooling_power_kw ?? null;

  let score = 0;

  if (srcKw != null && candKw != null) {
    const diff = Math.abs(candKw - srcKw);
    if (diff <= 0.3) score += 28;
    else if (diff <= 0.7) score += 22;
    else if (diff <= 1.2) score += 14;
    else if (diff <= 1.8) score += 6;
    else score -= 8;

    const srcBtu = inferBtuFromCoolingKw(srcKw);
    const candBtu = inferBtuFromCoolingKw(candKw);
    if (srcBtu != null && candBtu != null && srcBtu === candBtu) score += 6;
  }

  const srcPrice = Number(source.price) || 0;
  const candPrice = Number(candidate.price) || 0;
  if (srcPrice > 0 && candPrice > 0) {
    const pct = Math.abs(candPrice - srcPrice) / srcPrice;
    if (pct <= 0.15) score += 20;
    else if (pct <= 0.25) score += 16;
    else if (pct <= 0.35) score += 10;
    else if (pct <= 0.45) score += 4;
  }

  const srcCov = srcSpec?.coverage_m2 ?? null;
  const candCov = candSpec?.coverage_m2 ?? null;
  if (srcCov != null && candCov != null) {
    const diff = Math.abs(candCov - srcCov);
    if (diff <= 5) score += 12;
    else if (diff <= 10) score += 8;
    else if (diff <= 20) score += 4;
  }

  if (source.brand_id && candidate.brand_id) {
    if (source.brand_id === candidate.brand_id) {
      score += 6;
      if (srcKw != null && candKw != null && candKw > srcKw && candKw - srcKw <= 1.5) score += 4;
    } else {
      score += 3;
    }
  }

  if (srcSpec?.energy_class_cool && candSpec?.energy_class_cool) {
    if (srcSpec.energy_class_cool === candSpec.energy_class_cool) score += 5;
    else if (
      Math.abs(energyClassRank(srcSpec.energy_class_cool) - energyClassRank(candSpec.energy_class_cool)) <= 1
    ) {
      score += 2;
    }
  }

  if (srcSpec?.noise_db != null && candSpec?.noise_db != null) {
    const diff = Math.abs(candSpec.noise_db - srcSpec.noise_db);
    if (diff <= 3) score += 4;
    else if (diff <= 6) score += 2;
  }

  if ((source.product_condition ?? "new") === (candidate.product_condition ?? "new")) score += 3;

  if (srcSpec?.wifi != null && candSpec?.wifi != null && srcSpec.wifi === candSpec.wifi) score += 2;

  if (candidate.stock_status === "in_stock") score += 3;

  return score;
}

type PriceTier = "lower" | "mid" | "higher";

type ScoredCandidate = { c: SimilarProductRow; score: number };

function productPrice(row: SimilarProductRow): number {
  return Number(row.price) || 0;
}

/** Ценови сегмент спрямо отворения продукт. */
export function priceTierForProduct(sourcePrice: number, candidatePrice: number): PriceTier {
  if (sourcePrice <= 0 || candidatePrice <= 0) return "mid";
  const ratio = candidatePrice / sourcePrice;
  if (ratio < 0.92) return "lower";
  if (ratio > 1.08) return "higher";
  return "mid";
}

function sortByScoreDesc(items: ScoredCandidate[]): ScoredCandidate[] {
  return [...items].sort((a, b) => b.score - a.score);
}

function bestInTier(list: ScoredCandidate[], tier: PriceTier, sourcePrice: number): SimilarProductRow | null {
  const inTier = list.filter((x) => priceTierForProduct(sourcePrice, productPrice(x.c)) === tier);
  return inTier[0]?.c ?? null;
}

function bestSameBrandInDirection(
  list: ScoredCandidate[],
  sourcePrice: number,
  direction: "below" | "above",
): SimilarProductRow | null {
  const filtered =
    direction === "below"
      ? list.filter((x) => productPrice(x.c) < sourcePrice * 0.98)
      : list.filter((x) => productPrice(x.c) > sourcePrice * 1.02);
  return filtered[0]?.c ?? null;
}

/**
 * Три предложения: 3 ценови диапазона (по-евтин / близък / по-скъп),
 * като 2 са от същата марка и 1 от друга (ако има достатъчно кандидати).
 */
export function pickTopSimilarProducts(
  source: SimilarProductRow,
  candidates: SimilarProductRow[],
  limit = 3,
): SimilarProductRow[] {
  const sourcePrice = productPrice(source);
  const sourceBrandId = source.brand_id ?? null;

  const scored = sortByScoreDesc(
    candidates
      .map((c) => ({ c, score: scoreSimilarProduct(source, c) }))
      .filter((x) => x.score > 0),
  );

  if (scored.length === 0) return [];

  const picked: SimilarProductRow[] = [];
  const used = new Set<string>();

  const add = (row: SimilarProductRow | null | undefined): boolean => {
    if (!row || used.has(row.id)) return false;
    picked.push(row);
    used.add(row.id);
    return true;
  };

  if (!sourceBrandId) {
    for (const tier of ["lower", "mid", "higher"] as PriceTier[]) {
      add(bestInTier(scored, tier, sourcePrice));
      if (picked.length >= limit) break;
    }
    for (const { c } of scored) {
      if (picked.length >= limit) break;
      add(c);
    }
    const fallback = picked.slice(0, limit);
    fallback.sort((a, b) => productPrice(a) - productPrice(b));
    return fallback;
  }

  const sameBrand = scored.filter((x) => x.c.brand_id === sourceBrandId);
  const otherBrand = scored.filter((x) => x.c.brand_id !== sourceBrandId);

  // 1–2: същата марка — по-евтин и по-скъп вариант (или mid, ако липсват краищата).
  if (sameBrand.length > 0) {
    add(
      bestSameBrandInDirection(sameBrand, sourcePrice, "below") ??
        bestInTier(sameBrand, "lower", sourcePrice) ??
        sameBrand.find((x) => priceTierForProduct(sourcePrice, productPrice(x.c)) !== "higher")?.c ??
        sameBrand[0]?.c,
    );
    add(
      bestSameBrandInDirection(sameBrand, sourcePrice, "above") ??
        bestInTier(sameBrand, "higher", sourcePrice) ??
        sameBrand.find((x) => !used.has(x.c.id))?.c,
    );
    if (picked.filter((p) => p.brand_id === sourceBrandId).length < 2) {
      for (const { c } of sameBrand) {
        if (picked.filter((p) => p.brand_id === sourceBrandId).length >= 2) break;
        add(c);
      }
    }
  }

  // 3: друга марка — попълва липсващ ценови сегмент (mid → lower → higher).
  if (otherBrand.length > 0) {
    const tiersUsed = new Set(picked.map((p) => priceTierForProduct(sourcePrice, productPrice(p))));
    const tierPriority: PriceTier[] = ["mid", "lower", "higher"];
    let addedOther = false;
    for (const tier of tierPriority) {
      if (tiersUsed.has(tier)) continue;
      if (add(bestInTier(otherBrand, tier, sourcePrice))) {
        addedOther = true;
        break;
      }
    }
    if (!addedOther) add(otherBrand[0]?.c);
  }

  // Резервно попълване до limit.
  for (const { c } of scored) {
    if (picked.length >= limit) break;
    add(c);
  }

  const result = picked.slice(0, limit);
  result.sort((a, b) => productPrice(a) - productPrice(b));
  return result;
}

/** One representative per model (brand + model_code), preferring in-stock units. */
export function dedupeProductRowsByModel<T extends SimilarProductRow>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const brand = String(row.brand_id ?? "");
    const model = String(row.model_code ?? "").trim().toLowerCase();
    const key = brand && model ? `${brand}:${model}` : `__instance:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
