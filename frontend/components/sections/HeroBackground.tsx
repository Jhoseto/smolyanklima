/** Статичен фон на hero — една оптимизирана PNG, без blur/animation. */
export const HERO_BG_URL = '/images/hero-back.png';

export function HeroBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${HERO_BG_URL}')` }}
      aria-hidden
    />
  );
}
