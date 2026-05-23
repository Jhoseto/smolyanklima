import { GA_MEASUREMENT_ID } from '../../lib/analytics/gtag';
import { SITE_DOMAIN } from '../../lib/site';

const FIRST_PARTY = `Първа страна (${SITE_DOMAIN})`;

export type CookieCategory = 'Необходими' | 'Функционални' | 'Аналитични' | 'Маркетингови';

export interface CookieInventoryRow {
  name: string;
  type: string;
  category: CookieCategory;
  duration: string;
  provider: string;
  purpose: string;
}

export const COOKIE_INVENTORY: CookieInventoryRow[] = [
  {
    name: 'sk_cookie_consent_v1',
    type: 'localStorage',
    category: 'Необходими',
    duration: '12 месеца (деклариран срок)',
    provider: FIRST_PARTY,
    purpose: 'Запис на вашия избор относно категориите бисквитки и сходни технологии.',
  },
  {
    name: 'sk_rate_id',
    type: 'HTTP cookie (httpOnly, SameSite=Lax, Secure при HTTPS)',
    category: 'Необходими',
    duration: '1 година',
    provider: FIRST_PARTY,
    purpose: 'Псевдонимен идентификатор за предотвратяване на повторно гласуване при оценка на продукт.',
  },
  {
    name: 'sk_favorites',
    type: 'localStorage',
    category: 'Функционални',
    duration: 'До изтриване от потребителя или изчистване на данните на браузъра',
    provider: FIRST_PARTY,
    purpose: 'Списък с любими продукти в каталога.',
  },
  {
    name: 'sk_recently_viewed',
    type: 'localStorage',
    category: 'Функционални',
    duration: 'До изтриване (съхранява до 4 последни продукта)',
    provider: FIRST_PARTY,
    purpose: 'Наскоро разгледани продукти за подобряване на потребителското изживяване.',
  },
  {
    name: 'smolyan-klima-live-chat-v1',
    type: 'localStorage',
    category: 'Функционални',
    duration: 'До приключване на чат сесията или изтриване',
    provider: FIRST_PARTY,
    purpose: 'Идентификатор на live chat сесия и токен за достъп до съобщенията.',
  },
  {
    name: 'smolyan-klima-ai-chat-state-v1',
    type: 'localStorage',
    category: 'Функционални',
    duration: '7 дни',
    provider: FIRST_PARTY,
    purpose: 'Локално съхранение на историята на разговора с AI асистента (само в браузъра).',
  },
  {
    name: 'ai_chat_privacy_consent_v1',
    type: 'localStorage',
    category: 'Функционални',
    duration: 'До изтриване или оттегляне на съгласието',
    provider: FIRST_PARTY,
    purpose: 'Запис на съгласието за локално съхранение на данни от AI асистента.',
  },
  {
    name: 'smolyan-klima-ai-tab-id',
    type: 'sessionStorage',
    category: 'Функционални',
    duration: 'Сесия на таба в браузъра',
    provider: FIRST_PARTY,
    purpose: 'Синхронизация на AI чат между отворени табове на едно устройство.',
  },
  {
    name: 'pwa-ios-hint-dismiss',
    type: 'sessionStorage',
    category: 'Функционални',
    duration: 'Сесия на таба в браузъра (изчиства се при затваряне на таба)',
    provider: FIRST_PARTY,
    purpose: 'Запомняне дали потребителят е затворил подсказката за добавяне на сайта към началния екран (iOS). Не съхранява лични данни.',
  },
  {
    name: '_ga, _ga_*',
    type: 'HTTP cookie',
    category: 'Аналитични',
    duration: 'До 24 месеца (според настройките на Google)',
    provider: `Google LLC (Google Analytics 4, ID: ${GA_MEASUREMENT_ID})`,
    purpose: 'Статистика за посещаемост и поведение на сайта. Задават се само след съгласие за аналитични бисквитки.',
  },
  {
    name: 'NID, CONSENT и др. (Google Maps)',
    type: 'HTTP cookie (трета страна)',
    category: 'Маркетингови',
    duration: 'Според политиката на Google',
    provider: 'Google LLC (Google Maps embed)',
    purpose: 'Функциониране на интерактивната карта. Задават се само след съгласие за маркетингови бисквитки и зареждане на iframe.',
  },
];
