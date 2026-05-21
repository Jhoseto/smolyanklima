/** Статичен фон на hero — една оптимизирана PNG, без blur/animation. */
import type { CSSProperties } from 'react';

export const HERO_BG_URL = '/images/hero-back.png';

type HeroBackgroundProps = {
  className?: string;
  style?: CSSProperties;
};

export function HeroBackground({ className = '', style }: HeroBackgroundProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url('${HERO_BG_URL}')`, ...style }}
      aria-hidden
    />
  );
}
