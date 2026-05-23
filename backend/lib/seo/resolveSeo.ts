import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { applyPublicCatalogFilter } from '@/lib/catalog/publicProductVisibility';
import {
  localBusinessSchema,
  productSeoFromRow,
  resolveStaticPage,
  webSiteSchema,
  type SeoPage,
} from './pages';
import { productSchema } from './pages';
import { HOME_FAQS } from './faqs';

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function faqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export async function resolveSeoForPath(pathname: string): Promise<{ page: SeoPage; schemas: Record<string, unknown>[] }> {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  const schemas: Record<string, unknown>[] = [localBusinessSchema()];

  const staticPage = resolveStaticPage(path);
  if (staticPage) {
    if (path === '/') schemas.push(webSiteSchema(), faqSchema());
    return { page: staticPage, schemas };
  }

  const productMatch = path.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const slug = decodeURIComponent(productMatch[1]);
    const supabase = createSupabaseServiceRoleClient();
    const base = applyPublicCatalogFilter(
      supabase.from('products').select('id,slug,name,price,meta_title,meta_description,brand_id,type_id,rating,reviews_count'),
    );
    let { data: p } = await base.eq('slug', slug).maybeSingle();
    if (!p) {
      ({ data: p } = await applyPublicCatalogFilter(
        supabase.from('products').select('id,slug,name,price,meta_title,meta_description,brand_id,type_id,rating,reviews_count'),
      ).eq('id', slug).maybeSingle());
    }
    if (p) {
      const row = p as {
        slug: string; name: string; price: number; brand_id?: string; type_id?: string;
        meta_title?: string | null; meta_description?: string | null;
        rating?: number | null; reviews_count?: number | null;
      };
      const [bRes, tRes] = await Promise.all([
        row.brand_id ? supabase.from('brands').select('name').eq('id', row.brand_id).maybeSingle() : Promise.resolve({ data: null }),
        row.type_id ? supabase.from('product_types').select('name').eq('id', row.type_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const enriched = {
        ...row,
        brands: bRes.data as { name?: string } | null,
        product_types: tRes.data as { name?: string } | null,
      };
      const brandName = (bRes.data as { name?: string } | null)?.name ?? '—';
      const page = productSeoFromRow(enriched);
      schemas.push(productSchema({
        name: row.name,
        brand: brandName,
        price: Number(row.price),
        description: page.description,
        slug: row.slug,
        rating: row.rating != null ? Number(row.rating) : undefined,
        reviews: row.reviews_count != null ? Number(row.reviews_count) : undefined,
      }));
      return { page, schemas };
    }
    return {
      page: {
        title: 'Продукт не е намерен | Смолян Клима',
        description: 'Търсеният климатик не е наличен в каталога.',
        canonicalPath: path,
        noindex: true,
      },
      schemas,
    };
  }

  const blogMatch = path.match(/^\/blog\/([^/]+)$/);
  if (blogMatch && !['kategoria', 'tag', 'tursi'].includes(blogMatch[1])) {
    const slug = decodeURIComponent(blogMatch[1]);
    const supabase = createSupabaseServiceRoleClient();
    const { data } = await supabase
      .from('articles')
      .select('slug,title,excerpt,seo,featured_image')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    if (data) {
      const seo = (data.seo ?? {}) as { title?: string; description?: string; keywords?: string[] };
      const page: SeoPage = {
        title: seo.title || `${data.title} | Smolyan Klima`,
        description: seo.description || String(data.excerpt ?? ''),
        keywords: seo.keywords,
        canonicalPath: `/blog/${data.slug}`,
        ogImage: data.featured_image ? String(data.featured_image) : '/images/hero-new.jpg',
        bodyHtml: `<article><h1>${data.title}</h1><p>${data.excerpt ?? ''}</p></article>`,
      };
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: data.title,
        description: page.description,
        url: `https://smolyanklima.com/blog/${data.slug}`,
      });
      return { page, schemas };
    }
  }

  const accessoryMatch = path.match(/^\/aksesoar\/([^/]+)$/);
  if (accessoryMatch) {
    const id = decodeURIComponent(accessoryMatch[1]);
    const supabase = createSupabaseServiceRoleClient();
    let { data } = await supabase
      .from('accessories')
      .select('id,slug,name,price,description,brands:brand_id(name)')
      .eq('is_active', true)
      .eq('id', id)
      .maybeSingle();
    if (!data) {
      ({ data } = await supabase
        .from('accessories')
        .select('id,slug,name,price,description,brands:brand_id(name)')
        .eq('is_active', true)
        .eq('slug', id)
        .maybeSingle());
    }
    if (data) {
      const row = data as {
        id: string;
        slug?: string | null;
        name: string;
        price: number;
        description?: string | null;
        brands?: { name?: string } | null;
      };
      const brand = row.brands?.name ?? '—';
      const slug = row.slug ?? row.id;
      const page: SeoPage = {
        title: `${row.name} | Аксесоар — Смолян Клима`,
        description: stripHtml(String(row.description ?? '')).slice(0, 160)
          || `${row.name} (${brand}) — аксесоар за климатици. Цена €${row.price}. Смолян Klima.`,
        canonicalPath: `/aksesoar/${slug}`,
        bodyHtml: `<h1>${row.name}</h1><p>${brand} · €${row.price}</p>`,
      };
      schemas.push(productSchema({
        name: row.name,
        brand,
        price: Number(row.price),
        description: page.description,
        slug,
      }));
      return { page, schemas };
    }
    return {
      page: {
        title: 'Аксесоарът не е намерен | Смолян Клима',
        description: 'Търсеният аксесоар не е наличен в каталога.',
        canonicalPath: path,
        noindex: true,
      },
      schemas,
    };
  }

  return {
    page: {
      title: 'Страницата не е намерена | Смолян Клима',
      description: 'Търсената страница не съществува на smolyanklima.com.',
      canonicalPath: path,
      noindex: true,
    },
    schemas,
  };
}
