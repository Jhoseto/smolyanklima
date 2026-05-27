export type AboutCertificate = {
  id: string;
  image: string;
  title: string;
  holder: string;
  category: string;
  description: string;
  alt: string;
};

export const ABOUT_CERTIFICATES: AboutCertificate[] = [
  {
    id: 'kostadin-georgiev',
    image: '/images/certificates/cert-kostadin-georgiev.png',
    title: 'Документ за правоспособност',
    holder: 'Костадин Атанасов Георгиев',
    category: 'Първа категория',
    description: 'Проверка за течове, монтаж, поддръжка и сервиз на климатични и хладилни системи',
    alt: 'Сертификат за правоспособност — Костадин Атанасов Георгиев, първа категория',
  },
  {
    id: 'smolyan-klima',
    image: '/images/certificates/cert-smolyan-klima-eood.png',
    title: 'Документ за правоспособност',
    holder: '„Смолян Клима“ ЕООД',
    category: 'Фирмен сертификат',
    description: 'Монтаж, ремонт, поддръжка и обслужване на климатично и хладилно оборудване',
    alt: 'Сертификат за правоспособност на фирма Смолян Клима ЕООД',
  },
  {
    id: 'atanas-iliev',
    image: '/images/certificates/cert-atnans-georgiev-iliev.png',
    title: 'Документ за правоспособност',
    holder: 'Атанас Георгиев Илиев',
    category: 'Първа категория',
    description: 'Проверка за течове, монтаж, поддръжка и сервиз на климатични и хладилни системи',
    alt: 'Сертификат за правоспособност — Атанас Георгиев Илиев, първа категория',
  },
];
