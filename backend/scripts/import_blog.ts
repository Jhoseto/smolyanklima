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
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRole);

  const frontendBlogIndexPath = path.resolve(__dirname, "../../frontend/data/blog/index.ts");
  const mod = (await import(pathToFileURL(frontendBlogIndexPath).toString())) as { articles: FrontendArticle[] };
  const articles = mod.articles ?? [];

  for (const a of articles) {
    const isPublished = true;
    const publishedAt = a.publishedAt ? new Date(a.publishedAt).toISOString() : null;
    const modifiedAt = a.modifiedAt ? new Date(a.modifiedAt).toISOString() : null;

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
          images: a.images ?? [],
          seo: a.seo ?? { title: a.title, description: a.excerpt ?? "", keywords: a.tags ?? [], ogImage: a.featuredImage },
          schema:
            a.schema ??
            ({
              headline: a.title,
              description: a.excerpt ?? "",
              image: [a.featuredImage].filter(Boolean),
              datePublished: publishedAt ?? new Date().toISOString(),
              dateModified: modifiedAt ?? new Date().toISOString(),
              author: { name: a.author, url: "" },
            } satisfies ArticleSchema),
          is_published: isPublished,
          published_at: publishedAt,
          modified_at: modifiedAt,
          reading_time: a.readingTime ?? null,
          view_count: a.viewCount ?? 0,
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

