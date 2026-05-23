import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getProductById } from '../../data/productService';
import type { CatalogProduct } from '../../data/types/product';
import { extractProductSlugs, splitArticleContent } from '../../lib/blog/parseProductEmbeds';
import {
  BlogProductEmbed,
  BlogProductEmbedMissing,
  BlogProductEmbedSkeleton,
} from './BlogProductEmbed';

interface ArticleContentProps {
  content: string;
}

function isSafeHref(href: string): boolean {
  try {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith('//')) return false;
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

const markdownClassName =
  'prose prose-lg max-w-none overflow-x-auto prose-headings:text-gray-900 prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-gray-900 prose-strong:font-semibold prose-a:text-[#FF4D00] prose-a:no-underline hover:prose-a:underline prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6 prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6 prose-li:text-gray-600 prose-li:mb-2 prose-table:border-collapse prose-table:w-full prose-table:my-6 prose-th:bg-gray-100 prose-th:text-gray-900 prose-th:font-semibold prose-th:p-3 prose-th:text-left prose-td:border prose-td:border-gray-200 prose-td:p-3 prose-td:text-gray-600 prose-blockquote:border-l-4 prose-blockquote:border-[#FF4D00] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 prose-img:rounded-xl prose-img:shadow-lg prose-hr:border-gray-200';

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className={markdownClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (!href || !isSafeHref(href)) return <span>{children}</span>;
            const external = /^https?:/i.test(href);
            return (
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const ArticleContent: React.FC<ArticleContentProps> = ({ content }) => {
  const segments = useMemo(() => splitArticleContent(content), [content]);
  const slugs = useMemo(() => extractProductSlugs(content), [content]);
  const [products, setProducts] = useState<Record<string, CatalogProduct | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slugs.length) {
      setProducts({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const entries = await Promise.all(
        slugs.map(async (slug) => {
          const product = await getProductById(slug);
          return [slug, product ?? null] as const;
        }),
      );
      if (cancelled) return;
      setProducts(Object.fromEntries(entries));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slugs.join('|')]);

  const hasEmbeds = segments.some((s) => s.type === 'product');

  if (!hasEmbeds) {
    return <MarkdownBlock content={content} />;
  }

  return (
    <div>
      {segments.map((segment, index) => {
        if (segment.type === 'markdown') {
          return <MarkdownBlock key={`md-${index}`} content={segment.content} />;
        }

        const product = products[segment.slug];
        if (loading && product === undefined) {
          return <BlogProductEmbedSkeleton key={`product-${segment.slug}-${index}`} />;
        }
        if (!product) {
          return <BlogProductEmbedMissing key={`product-${segment.slug}-${index}`} slug={segment.slug} />;
        }
        return (
          <BlogProductEmbed
            key={`product-${segment.slug}-${index}`}
            product={product}
            label={segment.label}
          />
        );
      })}
    </div>
  );
};
