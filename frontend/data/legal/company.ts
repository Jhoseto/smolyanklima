import { SITE_DOMAIN, SITE_ORIGIN } from '../../lib/site';

/**
 * Реквизити на администратора на лични данни / доставчик.
 * Един източник на истина за правни страници, footer и контакти.
 */
export const LEGAL_COMPANY = {
  legalName: 'Смолян Клима ЕООД',
  tradeName: 'Смолян Клима',
  website: SITE_DOMAIN,
  websiteUrl: SITE_ORIGIN,

  eik: '204223522',
  vatNumber: 'BG204223522',

  registeredOffice: 'гр. Смолян, ул. „Елица" № 36',
  tradeAddress: 'гр. Смолян, ул. „Наталия" № 19, кв. Райково',
  postalCode: '4700',

  managingDirector: 'Атанас Георгиев',
  privacyContactName: 'Костадин Георгиев',

  email: 'smolyanklima@gmail.com',
  phone: '0888 58 58 16',
  phoneE164: '+359888585816',

  effectiveDate: '23 май 2026 г.',
  version: '1.0',
} as const;

export const LEGAL_AUTHORITY = {
  name: 'Комисия за защита на личните данни (КЗЛД)',
  address: 'гр. София 1592, ул. „Проф. Цветан Лазаров" № 2',
  website: 'https://www.cpdp.bg',
} as const;
