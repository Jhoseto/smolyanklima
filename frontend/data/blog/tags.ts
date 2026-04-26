/**
 * Blog Tags Data
 */

export interface Tag {
  slug: string;
  name: string;
  count: number;
}

// Popular tags extracted from articles
export const popularTags: Tag[] = [
  { slug: 'daikin', name: 'Daikin', count: 15 },
  { slug: 'mitsubishi', name: 'Mitsubishi', count: 12 },
  { slug: 'gree', name: 'Gree', count: 8 },
  { slug: 'fujitsu', name: 'Fujitsu', count: 6 },
  { slug: 'lg', name: 'LG', count: 5 },
  { slug: 'samsung', name: 'Samsung', count: 4 },
  { slug: 'toshiba', name: 'Toshiba', count: 3 },
  { slug: '9000-btu', name: '9000 BTU', count: 10 },
  { slug: '12000-btu', name: '12000 BTU', count: 12 },
  { slug: '18000-btu', name: '18000 BTU', count: 8 },
  { slug: '24000-btu', name: '24000 BTU', count: 5 },
  { slug: 'invertoren', name: 'Инверторен', count: 20 },
  { slug: 'smolyan', name: 'Смолян', count: 18 },
  { slug: 'montaj', name: 'Монтаж', count: 14 },
  { slug: 'ceni', name: 'Цени', count: 16 },
  { slug: 'otoplenie', name: 'Отопление', count: 11 },
  { slug: 'ohlazhdane', name: 'Охлаждане', count: 9 },
  { slug: 'profilaktika', name: 'Профилактика', count: 7 },
  { slug: 'remont', name: 'Ремонт', count: 6 },
  { slug: 'energiya', name: 'Енергийна ефективност', count: 8 },
  { slug: 'spalnya', name: 'Спалня', count: 5 },
  { slug: 'hol', name: 'Хол', count: 4 },
  { slug: 'ofis', name: 'Офис', count: 3 },
  { slug: 'wifi', name: 'Wi-Fi', count: 6 },
  { slug: 'filtr', name: 'Филтър', count: 4 }
];

export function getTagBySlug(slug: string): Tag | undefined {
  return popularTags.find(tag => tag.slug === slug);
}

export function getAllTags(): Tag[] {
  return popularTags.sort((a, b) => b.count - a.count);
}

export function getTopTags(count: number = 10): Tag[] {
  return popularTags.slice(0, count);
}
