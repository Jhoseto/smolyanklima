import { useCallback, useEffect, useRef, useState } from 'react';
import { HERO_SLIDE_IMAGES, pickRandomSlideIndex } from '../../lib/heroSlides';
import { useReducedMotion } from '../ai-assistant/utils/accessibility';

const ROTATE_MS = 9500;

type Props = {
  className?: string;
  alt?: string;
};

type LayerState = {
  active: 0 | 1;
  indices: [number, number];
};

function createInitialState(): LayerState {
  const first = Math.floor(Math.random() * HERO_SLIDE_IMAGES.length);
  const second = pickRandomSlideIndex(first);
  return { active: 0, indices: [first, second] };
}

export function HeroImageRotator({
  className = '',
  alt = 'Климатик в модерен интериор',
}: Props) {
  const reducedMotion = useReducedMotion();
  const [layers, setLayers] = useState<LayerState>(createInitialState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setLayers((prev) => {
      const nextActive = prev.active === 0 ? 1 : 0;
      const currentIdx = prev.indices[prev.active];
      const nextIdx = pickRandomSlideIndex(currentIdx);
      const nextIndices: [number, number] = [...prev.indices];
      nextIndices[nextActive] = nextIdx;
      return { active: nextActive, indices: nextIndices };
    });
  }, []);

  useEffect(() => {
    const preload = () => {
      for (const src of HERO_SLIDE_IMAGES) {
        const img = new Image();
        img.src = src;
      }
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preload, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }

    const timeout = window.setTimeout(preload, 400);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (reducedMotion || HERO_SLIDE_IMAGES.length <= 1) return;

    const start = () => {
      if (timerRef.current) return;
      timerRef.current = window.setInterval(() => {
        if (document.hidden) return;
        advance();
      }, ROTATE_MS);
    };

    const stop = () => {
      if (!timerRef.current) return;
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [advance, reducedMotion]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {([0, 1] as const).map((layer) => {
        const isActive = layer === layers.active;
        return (
          <img
            key={layer}
            src={HERO_SLIDE_IMAGES[layers.indices[layer]]}
            alt={isActive ? alt : ''}
            aria-hidden={!isActive}
            width={1024}
            height={680}
            decoding="async"
            fetchPriority={layer === 0 ? 'high' : 'low'}
            draggable={false}
            className={`hero-slide-layer absolute inset-0 block h-full w-full object-cover object-center ${
              isActive ? 'is-active z-[1]' : 'is-idle z-0'
            }`}
          />
        );
      })}
    </div>
  );
}
