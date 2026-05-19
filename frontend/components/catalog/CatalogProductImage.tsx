import React from 'react';
import { cn } from '../../lib/utils';

export type CatalogProductImageFade = 'default' | 'soft' | 'thumb';

const FADE_CLASS: Record<CatalogProductImageFade, string> = {
  default: 'catalog-product-image-fade',
  soft: 'catalog-product-image-fade-soft',
  thumb: 'catalog-product-image-fade-thumb',
};

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fade?: CatalogProductImageFade;
};

/** Снимка на климатик/аксесоар с плавен fade към фона на контейнера (без рязък бял правоъгълник). */
export function CatalogProductImage({ fade = 'default', className, alt = '', ...props }: Props) {
  return <img alt={alt} className={cn('object-contain', FADE_CLASS[fade], className)} {...props} />;
}
