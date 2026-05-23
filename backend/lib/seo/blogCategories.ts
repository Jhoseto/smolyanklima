/** Blog categories — keep in sync with frontend/data/blog/categories.ts */
export const BLOG_CATEGORIES = [
  { slug: 'saveti-pri-izbor', name: 'Съвети при избор', description: 'Как да изберете перфектния климатик — мощност, марки, функции.' },
  { slug: 'sravneniya', name: 'Сравнения', description: 'Детайлни сравнения между марки и модели климатици.' },
  { slug: 'montaj', name: 'Монтаж', description: 'Всичко за монтажа на климатици — цени, процес, съвети за Смолян и региона.' },
  { slug: 'profilaktika', name: 'Профилактика', description: 'Поддръжка, почистване и профилактика на климатични системи.' },
  { slug: 'remont', name: 'Ремонт', description: 'Често срещани проблеми с климатици и бързи решения.' },
  { slug: 'energiya', name: 'Енергийна ефективност', description: 'Икономия на ток, енергийни класове и ефективност на климатици.' },
  { slug: 'novini', name: 'Новини', description: 'Нови модели, промоции и актуалности от света на климатизацията.' },
  { slug: 'regionalni', name: 'Регионални', description: 'Специализирани съвети за климатици в Смолян, Родопите и региона.' },
] as const;

export function blogCategorySeo(slug: string) {
  const cat = BLOG_CATEGORIES.find((c) => c.slug === slug);
  if (!cat) return null;
  const regional = slug === 'regionalni' ? ' Смолян, Рудозем, Девин.' : '';
  return {
    title: `${cat.name} — Блог за климатици${slug === 'regionalni' ? ' Смолян' : ''} | Смолян Клима`,
    description: `${cat.description}${regional} Експертни статии от Смолян Клима.`,
    keywords: ['блог климатик', cat.name.toLowerCase(), 'смолян климатици', 'монтаж климатик'],
    canonicalPath: `/blog/kategoria/${cat.slug}`,
  };
}
