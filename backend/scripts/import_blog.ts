/**
 * Импорт на статии от frontend/data/blog/index.ts → Supabase.
 * Идемпотентен: upsert по slug; при съществуваща статия се запазва view_count от базата.
 *
 * Usage: cd backend && npm run import:blog
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

type ArticleSEO = { title: string; description: string; keywords: string[]; ogImage: string };
type ArticleSchema = {
  headline: string;
  description: string;
  image: string[];
  datePublished: string;
  dateModified: string;
  author: { name: string; url: string };
};
type FrontendArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  featuredImage: string;
  images?: string[];
  seo: ArticleSEO;
  schema: ArticleSchema;
  publishedAt: string;
  modifiedAt: string;
  readingTime: number;
  viewCount: number;
  featured?: boolean;
};

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`import_blog.ts — Upsert статии от frontend/data/blog/index.ts
Usage: npm run import:blog [--dry-run]

--dry-run   Брой статии от източника, без запис в Supabase`);
    return;
  }

  const dryRun = process.argv.includes("--dry-run");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

  const frontendBlogIndexPath = path.resolve(__dirname, "../../frontend/data/blog/index.ts");
  const mod = (await import(pathToFileURL(frontendBlogIndexPath).toString())) as { articles: FrontendArticle[] };
  const articles = mod.articles ?? [];

  if (dryRun) {
    console.log(`[dry-run] Статии в източника: ${articles.length}`);
    return;
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRole);

  for (const a of articles) {
    const isPublished = true;
    const publishedAt = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
    const modifiedAt = a.modifiedAt ? new Date(a.modifiedAt).toISOString() : null;

    const { data: existing } = await supabase.from("articles").select("view_count").eq("slug", a.slug).maybeSingle();
    const viewCount =
      existing && typeof (existing as { view_count?: number }).view_count === "number"
        ? (existing as { view_count: number }).view_count
        : (a.viewCount ?? 0);

    const baseSchema: ArticleSchema =
      a.schema ??
      ({
        headline: a.title,
        description: a.excerpt ?? "",
        image: [a.featuredImage].filter(Boolean),
        datePublished: publishedAt ?? new Date().toISOString(),
        dateModified: modifiedAt ?? new Date().toISOString(),
        author: { name: a.author, url: "" },
      } satisfies ArticleSchema);
    const schema: ArticleSchema = {
      ...baseSchema,
      image: [a.featuredImage].filter(Boolean),
    };

    const { error } = await supabase
      .from("articles")
      .upsert(
        {
          slug: a.slug,
          title: a.title,
          excerpt: a.excerpt ?? null,
          content: a.content,
          category_slug: a.category,
          tags: a.tags ?? [],
          author_slug: a.author,
          featured_image: a.featuredImage,
          images: [],
          seo: a.seo ?? { title: a.title, description: a.excerpt ?? "", keywords: a.tags ?? [], ogImage: a.featuredImage },
          schema,
          is_published: isPublished,
          published_at: publishedAt,
          modified_at: modifiedAt,
          reading_time: a.readingTime ?? null,
          view_count: viewCount,
          is_featured: Boolean(a.featured),
        },
        { onConflict: "slug" },
      );

    if (error) throw error;
  }

  console.log(`Imported/updated articles: ${articles.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

