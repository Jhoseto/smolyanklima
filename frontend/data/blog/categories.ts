/**
 * Blog Categories Configuration
 */

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  icon?: string;
}

export const categories: Category[] = [
  {
    id: '1',
    slug: 'saveti-pri-izbor',
    name: 'Съвети при избор',
    description: 'Как да изберете перфектния климатик за вашето помещение - мощност, марки, функции',
    color: '#00B4D8'
  },
  {
    id: '2',
    slug: 'sravneniya',
    name: 'Сравнения',
    description: 'Детайлни сравнения между марки и модели климатици',
    color: '#FF4D00'
  },
  {
    id: '3',
    slug: 'montaj',
    name: 'Монтаж',
    description: 'Всичко за монтажа на климатици - цени, процес, съвети',
    color: '#27AE60'
  },
  {
    id: '4',
    slug: 'profilaktika',
    name: 'Профилактика',
    description: 'Поддръжка, почистване и профилактика на климатични системи',
    color: '#9B59B6'
  },
  {
    id: '5',
    slug: 'remont',
    name: 'Ремонт',
    description: 'Често срещани проблеми и тяхното отстраняване',
    color: '#E74C3C'
  },
  {
    id: '6',
    slug: 'energiya',
    name: 'Енергийна ефективност',
    description: 'Икономия на ток, енергийни класове, ефективност',
    color: '#F39C12'
  },
  {
    id: '7',
    slug: 'novini',
    name: 'Новини',
    description: 'Нови модели, промоции и актуалности от света на климатизацията',
    color: '#1ABC9C'
  },
  {
    id: '8',
    slug: 'regionalni',
    name: 'Регионални',
    description: 'Специализирани съвети за Смолян и планинските региони',
    color: '#34495E'
  }
];

export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find(cat => cat.slug === slug);
}

export function getAllCategories(): Category[] {
  return categories;
}
