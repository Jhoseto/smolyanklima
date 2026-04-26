/**
 * Blog Authors Data
 */

export interface Author {
  id: string;
  slug: string;
  name: string;
  role: string;
  bio: string;
  avatar: string;
  email?: string;
  social?: {
    facebook?: string;
    linkedin?: string;
    twitter?: string;
  };
}

export const authors: Author[] = [
  {
    id: '1',
    slug: 'ivan-petrov',
    name: 'Иван Петров',
    role: 'Експерт по климатизация',
    bio: 'Иван Петров е сертифициран климатичен техник с над 15 години опит в монтажа и поддръжката на климатици в Смолян и региона. Специализира в инверторни технологии и енергийна ефективност.',
    avatar: '/images/authors/ivan-petrov.jpg',
    social: {
      facebook: 'https://facebook.com/ivan.petrov',
      linkedin: 'https://linkedin.com/in/ivan-petrov'
    }
  },
  {
    id: '2',
    slug: 'georgi-ivanov',
    name: 'Георги Иванов',
    role: 'Технически консултант',
    bio: 'Георги е технически експерт с дългогодишен опит в HVAC индустрията. Запалянко по новите технологии и интелигентните климатични системи.',
    avatar: '/images/authors/georgi-ivanov.jpg',
    social: {
      linkedin: 'https://linkedin.com/in/georgi-ivanov'
    }
  },
  {
    id: '3',
    slug: 'smolyan-klima-team',
    name: 'Екип Smolyan Klima',
    role: 'Маркетинг екип',
    bio: 'Екипът на Smolyan Klima споделя експертни съвети, новини и полезна информация за климатиците и климатизацията в Смолян.',
    avatar: '/images/authors/team.jpg'
  }
];

export function getAuthorBySlug(slug: string): Author | undefined {
  return authors.find(author => author.slug === slug);
}

export function getAllAuthors(): Author[] {
  return authors;
}
