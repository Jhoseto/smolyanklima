/** Hero carousel — AC lifestyle renders (public/images/hero-slides). */
export const HERO_SLIDE_IMAGES = [
  '/images/hero-slides/hero-01.png',
  '/images/hero-slides/hero-02.png',
  '/images/hero-slides/hero-03.png',
  '/images/hero-slides/hero-04.png',
  '/images/hero-slides/hero-05.png',
  '/images/hero-slides/hero-06.png',
  '/images/hero-slides/hero-07.png',
  '/images/hero-slides/hero-08.png',
  '/images/hero-slides/hero-09.png',
  '/images/hero-slides/hero-10.png',
  '/images/hero-slides/hero-11.png',
  '/images/hero-slides/hero-12.png',
  '/images/hero-slides/hero-13.png',
] as const;

export function pickRandomSlideIndex(exclude: number, length = HERO_SLIDE_IMAGES.length): number {
  if (length <= 1) return 0;
  let idx = exclude;
  while (idx === exclude) {
    idx = Math.floor(Math.random() * length);
  }
  return idx;
}
