import type { Product } from '../types';

const MAX_SECTION_CHARS = 21_000;
const MAX_DETAILED = 12;

export type QueryHints = {
  sqm?: number;
  budgetMax?: number;
  brand?: string;
  btu?: number;
  wantsQuiet?: boolean;
  wantsWifi?: boolean;
  wantsEfficiency?: boolean;
  wantsCheap?: boolean;
  keywords: string[];
};

export function extractQueryHints(query: string, history: string[] = []): QueryHints {
  const text = `${history.join(' ')} ${query}`.toLowerCase();
  const hints: QueryHints = { keywords: [] };

  const sqmMatch = text.match(/(\d{1,3})\s*(?:кв\.?\s*м|m²|m2|квадрат)/i);
  if (sqmMatch) hints.sqm = parseInt(sqmMatch[1], 10);

  const budgetMatch = text.match(/(?:до|макс\.?|бюджет)\s*(\d{3,5})\s*(?:€|eur|евро|лв)?/i);
  if (budgetMatch) hints.budgetMax = parseInt(budgetMatch[1], 10);

  const brands = [
    'daikin', 'mitsubishi heavy', 'mitsubishi electric', 'mitsubishi',
    'samsung', 'lg', 'fujitsu', 'gree', 'panasonic', 'hitachi', 'toshiba', 'carrier', 'midea', 'sharp',
  ];
  for (const b of brands) {
    if (text.includes(b)) {
      hints.brand = b;
      break;
    }
  }

  const btuMatch = text.match(/\b(7|9|12|14|18|22|24|30|36|45|48|54|60|72|90)\s*(?:000\s*)?btu/i)
    || text.match(/\b(9000|12000|18000|24000)\b/i);
  if (btuMatch) {
    const raw = parseInt(btuMatch[1], 10);
    hints.btu = raw >= 1000 ? Math.round(raw / 1000) : raw;
  }

  hints.wantsQuiet = /тих|шум|db|db\b|decibel/i.test(text);
  hints.wantsWifi = /wifi|wi-fi|интернет|приложение|app/i.test(text);
  hints.wantsEfficiency = /a\+\+|енерги|seer|scop|иконом/i.test(text);
  hints.wantsCheap = /евтин|бюджет|икономич|ниска\s*цена|до\s*\d{3}/i.test(text);

  return hints;
}

export function scoreProductForQuery(product: Product, hints: QueryHints): number {
  let score = 0;

  if (hints.sqm && product.specs.coverage > 0) {
    if (product.specs.coverage >= hints.sqm) score += 30;
    else if (product.specs.coverage >= hints.sqm * 0.85) score += 15;
    else score -= 10;
  }

  if (hints.budgetMax) {
    if (product.price <= hints.budgetMax) score += 25;
    else if (product.price <= hints.budgetMax * 1.12) score += 10;
    else score -= 15;
  }

  if (hints.brand && product.brand.toLowerCase().includes(hints.brand)) score += 20;

  if (hints.btu && product.specs.btu) {
    if (product.specs.btu === hints.btu) score += 25;
    else if (Math.abs(product.specs.btu - hints.btu) <= 2) score += 12;
  }

  if (hints.wantsQuiet && product.specs.noiseLevel > 0) {
    if (product.specs.noiseLevel <= 20) score += 15;
    else if (product.specs.noiseLevel <= 24) score += 8;
  }

  if (hints.wantsWifi && product.wifi) score += 12;

  if (hints.wantsEfficiency) {
    if (product.energyClass.includes('A+++')) score += 12;
    else if (product.energyClass.includes('A++')) score += 8;
    if (product.specs.seer >= 7) score += 5;
  }

  if (hints.wantsCheap) score += Math.max(0, 20 - product.price / 50);

  score += product.rating * 2;
  if (product.inStock) score += 5;

  return score;
}

function formatProductDetailed(product: Product, index: number): string {
  const wifi = product.wifi ? 'да' : product.wifi === false ? 'не' : '—';
  const mount = product.priceWithMount ? ` | с монтаж ~${product.priceWithMount}€` : '';
  const btu = product.specs.btu ? `${product.specs.btu}000 BTU` : '—';
  const scop = product.specs.scop > 0 ? product.specs.scop : '—';
  const seer = product.specs.seer > 0 ? product.specs.seer : '—';

  return [
    `${index}. [${product.slug ?? product.id}] ${product.name}`,
    `   Марка: ${product.brand} | Тип: ${product.type || '—'} | Състояние: ${product.condition === 'used' ? 'употребяван' : 'нов'}`,
    `   Цена: ${product.price}€${mount}`,
    `   Охлаждане: ${product.specs.power} | Отопление: ${product.specs.heatingCapacity || '—'} kW | BTU: ${btu}`,
    `   Площ: до ${product.specs.coverage || '—'} m² | Шум: ${product.specs.noiseLevel || '—'} dB`,
    `   SEER: ${seer} | SCOP: ${scop} | Енергия охл./отопл.: ${product.energyClass}/${product.energyClassHeat || '—'}`,
    `   Хладagent: ${product.refrigerant || '—'} | WiFi: ${wifi} | Гаранция: ${product.warranty.months} мес.`,
    product.dimensions ? `   Размери: ${product.dimensions}` : null,
    product.weights ? `   Тегло: ${product.weights}` : null,
    `   Функции: ${product.features.slice(0, 8).join(', ') || '—'}`,
    `   Рейтинг: ${product.rating}/5 (${product.reviewCount} отз.)`,
  ].filter(Boolean).join('\n');
}

function formatProductCompact(product: Product): string {
  const wifi = product.wifi ? 'да' : 'не';
  const cov = product.specs.coverage || '—';
  const db = product.specs.noiseLevel || '—';
  const seer = product.specs.seer > 0 ? product.specs.seer : '—';
  const btu = product.specs.btu || '—';
  const typeShort = (product.type ?? '—').replace(' климатик', '').slice(0, 12);
  const name = product.name.length > 48 ? `${product.name.slice(0, 45)}…` : product.name;
  return `${product.slug ?? product.id}|${product.brand}|${name}|${product.price}|${product.specs.power}|${cov}m²|${db}dB|SEER${seer}|${product.energyClass}|${wifi}|${typeShort}|BTU${btu}`;
}

export function buildCatalogContext(
  products: Product[],
  options: { userQuery?: string; history?: string[]; loadedAt?: number } = {},
): string {
  if (!products.length) {
    return [
      'ПУБЛИЧЕН КАТАЛОГ: празен или незареден.',
      'НЕ препоръчвай конкретни модели/цени. Кажи, че каталогът се зарежда и предложи телефон 0888 58 58 16.',
    ].join('\n');
  }

  const hints = extractQueryHints(options.userQuery ?? '', options.history ?? []);
  const ranked = [...products]
    .map((p) => ({ p, score: scoreProductForQuery(p, hints) }))
    .sort((a, b) => b.score - a.score || a.p.price - b.p.price);

  const topDetailed = ranked.slice(0, MAX_DETAILED).map((r) => r.p);

  const parts: string[] = [
    `ПУБЛИЧЕН КАТАЛОГ (жив синхрон, ${products.length} модела${options.loadedAt ? `, обновен ${new Date(options.loadedAt).toLocaleString('bg-BG')}` : ''})`,
    'Използвай САМО тези артикули и техните точни данни. НЕ измисляй модели, цени или характеристики.',
    'При препоръка цитирай ПЪЛНОТО име на модела от каталога (напр. както в [slug] блока).',
  ];

  if (options.userQuery?.trim()) {
    parts.push(`\nЗАЯВКА НА КЛИЕНТА (за контекст): "${options.userQuery.trim()}"`);
  }

  parts.push('\nТОП РЕЛЕВАНТНИ МОДЕЛИ (пълни технически данни):');
  topDetailed.forEach((p, i) => parts.push(formatProductDetailed(p, i + 1)));

  parts.push('\nПЪЛЕН ИНДЕКС НА КАТАЛОГА (всички модели, компактен формат):');
  parts.push('slug|марка|име|€|kW|m²|dB|SEER|енергия|wifi|тип|BTU');

  let used = parts.join('\n').length;
  let compactCount = 0;

  for (const { p } of ranked) {
    const line = formatProductCompact(p);
    if (used + line.length + 1 > MAX_SECTION_CHARS) break;
    parts.push(line);
    used += line.length + 1;
    compactCount += 1;
  }

  const remaining = products.length - compactCount;
  if (remaining > 0) {
    parts.push(`(+ още ${remaining} модела в каталога — при нужда попитай за мощност/бюджет/марка)`);
  }

  parts.push(
    '\nПРАВИЛА ЗА ПРЕПОРЪКА:',
    '- Избирай по: площ (m²), kW/BTU, шум (dB), SEER/SCOP, бюджет, марка, WiFi, тип (стенен/мульти/касетен).',
    '- Сравнявай само модели от този списък с реални числа от данните.',
    '- Ако няма точно съвпадение — предложи най-близките 2–3 от TOP/индекса и обясни защо.',
    '- Цена с монтаж: ползвай priceWithMount от детайлните блокове или кажи „ще изготвим оферта“.',
  );

  return parts.join('\n');
}

export function rankProductsForQuery(
  products: Product[],
  userQuery: string,
  history: string[] = [],
  limit = 6,
): Product[] {
  const hints = extractQueryHints(userQuery, history);
  return [...products]
    .map((p) => ({ p, score: scoreProductForQuery(p, hints) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.p);
}
