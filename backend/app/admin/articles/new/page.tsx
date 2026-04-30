"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type BlogCategory = { slug: string; name: string; description?: string; color?: string };
type BlogAuthor = { slug: string; name: string; role?: string };

export default function NewArticlePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [seoTouched, setSeoTouched] = useState(false);

  const [form, setForm] = useState({
    slug: "",
    title: "",
    excerpt: "",
    content: "",
    categorySlug: "",
    authorSlug: "",
    featuredImage: "",
    tags: "",
    isPublished: false,
    isFeatured: false,
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    seoOgImage: "",
  });

  useEffect(() => {
    (async () => {
      const [cRes, aRes] = await Promise.all([fetch("/api/admin/meta/blog-categories"), fetch("/api/admin/meta/blog-authors")]);
      const cJson = await cRes.json();
      const aJson = await aRes.json();
      const c = (cJson.data ?? []) as BlogCategory[];
      const a = (aJson.data ?? []) as BlogAuthor[];
      setCategories(c);
      setAuthors(a);
      setForm((prev) => ({
        ...prev,
        categorySlug: prev.categorySlug || (c[0]?.slug ?? "novini"),
        authorSlug: prev.authorSlug || (a[0]?.slug ?? "smolyan-klima-team"),
        featuredImage: prev.featuredImage || "/images/blog/og-blog-home.jpg",
        seoOgImage: prev.seoOgImage || "/images/blog/og-blog-home.jpg",
      }));
    })().catch((e) => setError(String(e?.message ?? e)));
  }, []);

  // Auto slug + auto SEO (until user edits them manually)
  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev };

      if (!slugTouched) {
        const derivedSlug = slugifyBg(prev.title);
        if (derivedSlug && derivedSlug !== prev.slug) next.slug = derivedSlug;
      }

      if (!seoTouched) {
        const seo = deriveSeo({
          title: prev.title,
          excerpt: prev.excerpt,
          content: prev.content,
          tags: prev.tags,
          featuredImage: prev.featuredImage,
        });
        if (!prev.seoTitle) next.seoTitle = seo.title;
        if (!prev.seoDescription) next.seoDescription = seo.description;
        if (!prev.seoKeywords) next.seoKeywords = seo.keywords;
        if (!prev.seoOgImage) next.seoOgImage = seo.ogImage;
      }

      return next;
    });
  }, [form.title, form.excerpt, form.content, form.tags, form.featuredImage, slugTouched, seoTouched]);

  async function uploadFeaturedImage(file: File) {
    const folderSlug = form.slug.trim() || slugifyBg(form.title);
    if (folderSlug.length < 2) {
      setError("Попълнете заглавие или slug (мин. 2 знака), за да се качи снимката в отделна папка в Cloudinary.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "blog");
      fd.append("slug", folderSlug);
      const res = await fetch("/api/admin/uploads/image", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка при качване");
      setForm((prev) => ({
        ...prev,
        featuredImage: json.data.url,
        seoOgImage: seoTouched ? prev.seoOgImage : prev.seoOgImage || json.data.url,
      }));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    const res = await fetch("/api/admin/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.slug,
        title: form.title,
        excerpt: form.excerpt || null,
        content: form.content,
        categorySlug: form.categorySlug,
        authorSlug: form.authorSlug,
        featuredImage: form.featuredImage,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        seo: form.seoTitle || form.seoDescription || form.seoKeywords || form.seoOgImage
          ? {
              title: form.seoTitle || form.title,
              description: form.seoDescription || form.excerpt || form.title,
              keywords: form.seoKeywords
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean),
              ogImage: form.seoOgImage || form.featuredImage,
            }
          : undefined,
        isPublished: form.isPublished,
        isFeatured: form.isFeatured,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Грешка при създаване");
      return;
    }
    router.push(`/admin/articles/${json.data.id}`);
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Нова статия</h1>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Slug</div>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setForm({ ...form, slug: e.target.value });
            }}
            style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Заглавие</div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </label>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Кратко описание</div>
          <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={3} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </label>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Съдържание</div>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={14} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Категория</div>
            <select value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Автор</div>
            <select value={form.authorSlug} onChange={(e) => setForm({ ...form, authorSlug: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}>
              {authors.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Основна снимка (URL)</div>
          <input value={form.featuredImage} onChange={(e) => setForm({ ...form, featuredImage: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </label>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Качи снимка от компютъра (Cloudinary)</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Папка: smolyanklima/blog/{"{slug}"}/ (отделна папка за всяка статия; вътре — снимките).</div>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              uploadFeaturedImage(f).catch((err) => setError(String(err?.message ?? err)));
            }}
          />
          {uploading && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>Качване...</div>}
        </label>
        <label>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Тагове (разделени със запетая)</div>
          <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }} />
        </label>

        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10, marginTop: 4 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>SEO</div>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>SEO заглавие (title)</div>
              <input
                value={form.seoTitle}
                onChange={(e) => {
                  setSeoTouched(true);
                  setForm({ ...form, seoTitle: e.target.value });
                }}
                style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>SEO описание (description)</div>
              <textarea
                value={form.seoDescription}
                onChange={(e) => {
                  setSeoTouched(true);
                  setForm({ ...form, seoDescription: e.target.value });
                }}
                rows={2}
                style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>SEO ключови думи (keywords, със запетая)</div>
              <input
                value={form.seoKeywords}
                onChange={(e) => {
                  setSeoTouched(true);
                  setForm({ ...form, seoKeywords: e.target.value });
                }}
                style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>OG снимка (og:image URL)</div>
              <input
                value={form.seoOgImage}
                onChange={(e) => {
                  setSeoTouched(true);
                  setForm({ ...form, seoOgImage: e.target.value });
                }}
                style={{ width: "100%", padding: 10, border: "1px solid #e5e7eb", borderRadius: 12 }}
              />
            </label>
          </div>
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
          Публикувана
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
          Избрана
        </label>

        <button onClick={submit} style={{ padding: "8px 12px", borderRadius: 10, background: "#0ea5e9", color: "white", fontWeight: 700, border: "1px solid #0ea5e9", fontSize: 12 }}>
          Създай
        </button>
      </div>
    </div>
  );
}

function slugifyBg(input: string) {
  const s = (input || "").trim().toLowerCase();
  if (!s) return "";
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "", ю: "yu", я: "ya",
  };
  const latin = s
    .split("")
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join("");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
}

function stripMarkdown(md: string) {
  return (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/[*_~>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveSeo(input: { title: string; excerpt: string; content: string; tags: string; featuredImage: string }) {
  const title = (input.title || "").trim();
  const baseTitle = title ? `${title} | Smolyan Klima` : "Smolyan Klima";

  const descSource = (input.excerpt || "").trim() || stripMarkdown(input.content || "");
  const description = (descSource || title).slice(0, 160).trim();

  const tagKeywords = (input.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const titleKeywords = title
    .toLowerCase()
    .split(/[^a-zа-я0-9]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
    .filter((w) => !["kak", "koi", "koga", "zashto", "kade", "koiato", "kato", "za", "na", "pri", "sus", "i", "ili", "ot", "do", "v", "s"].includes(w))
    .slice(0, 8);

  const keywords = Array.from(new Set([...tagKeywords, ...titleKeywords])).slice(0, 12).join(", ");
  const ogImage = input.featuredImage || "/images/blog/og-blog-home.jpg";
  return { title: baseTitle, description, keywords, ogImage };
}

