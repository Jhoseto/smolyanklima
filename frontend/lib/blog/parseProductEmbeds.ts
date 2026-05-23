/** Split article markdown around [[product:slug-or-id]] or [[product:slug|label]] tokens. */
export type ArticleContentSegment =
  | { type: 'markdown'; content: string }
  | { type: 'product'; slug: string; label?: string };

const PRODUCT_EMBED_RE = /\[\[product:([^\]|]+)(?:\|([^\]]*))?\]\]/g;

export function splitArticleContent(content: string): ArticleContentSegment[] {
  const segments: ArticleContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  PRODUCT_EMBED_RE.lastIndex = 0;
  while ((match = PRODUCT_EMBED_RE.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before) segments.push({ type: 'markdown', content: before });

    const slug = match[1].trim();
    const label = match[2]?.trim();
    if (slug) segments.push({ type: 'product', slug, label: label || undefined });

    lastIndex = match.index + match[0].length;
  }

  const tail = content.slice(lastIndex);
  if (tail) segments.push({ type: 'markdown', content: tail });

  return segments.length ? segments : [{ type: 'markdown', content }];
}

export function extractProductSlugs(content: string): string[] {
  const slugs: string[] = [];
  PRODUCT_EMBED_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PRODUCT_EMBED_RE.exec(content)) !== null) {
    const slug = match[1]?.trim();
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}
