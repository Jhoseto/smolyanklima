/**
 * Инлайн SVG марка за transactional имейли (същата графика като навбара на сайта).
 * Уникални gradient id с префикс emSk — избягва конфликти при повторно включване.
 */
export const EMAIL_BRAND_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 5 73 90" width="56" height="68" style="display:block" role="img" aria-label="Смолян Клима">
  <defs>
    <linearGradient id="emSkOrange" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF4D00"/>
      <stop offset="50%" stop-color="#FF6A00"/>
      <stop offset="100%" stop-color="#FF2A4D"/>
    </linearGradient>
    <linearGradient id="emSkBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00B4D8"/>
      <stop offset="100%" stop-color="#0077B6"/>
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="5" stroke="url(#emSkOrange)" stroke-width="3" fill="none"/>
  <path d="M 70 15.4 A 40 40 0 0 0 10.1 47 L 28.2 47 A 22 22 0 0 1 61 30.9 Z" fill="url(#emSkOrange)"/>
  <path d="M 10.1 53 A 40 40 0 0 0 70 84.6 L 61 69.1 A 22 22 0 0 1 28.2 53 Z" fill="url(#emSkBlue)"/>
  <path d="M 62.6 47 A 13 13 0 0 0 37.4 47 Z" fill="url(#emSkOrange)"/>
  <path d="M 37.4 53 A 13 13 0 0 0 62.6 53 Z" fill="url(#emSkBlue)"/>
</svg>
`.trim();
