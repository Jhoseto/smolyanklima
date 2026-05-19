export type CatalogProductImageFade = "default" | "soft" | "thumb";

const FADE_CLASS: Record<CatalogProductImageFade, string> = {
  default: "catalog-product-image-fade",
  soft: "catalog-product-image-fade-soft",
  thumb: "catalog-product-image-fade-thumb",
};

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fade?: CatalogProductImageFade;
};

export function CatalogProductImage({ fade = "default", className = "", alt = "", ...props }: Props) {
  const classes = ["object-contain", FADE_CLASS[fade], className].filter(Boolean).join(" ");
  return <img alt={alt} className={classes} {...props} />;
}
