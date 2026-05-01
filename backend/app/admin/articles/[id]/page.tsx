"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HelpRow, InfoDot, SectionTitle, HelpCard, Card, Input, Textarea, Select, Button } from "../../ui";
import { Save, Trash2, Upload } from "lucide-react";

type BlogCategory = { slug: string; name: string };
type BlogAuthor = { slug: string; name: string };

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [seoTouched, setSeoTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setLoading(true);
      const [cRes, aRes, res] = await Promise.all([
        fetch("/api/admin/meta/blog-categories"),
        fetch("/api/admin/meta/blog-authors"),
        fetch(`/api/admin/articles/${id}`),
      ]);

      const cJson = await cRes.json();
      const aJson = await aRes.json();
      setCategories((cJson.data ?? []) as BlogCategory[]);
      setAuthors((aJson.data ?? []) as BlogAuthor[]);

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка при зареждане");
      setForm({
        slug: json.data.slug,
        title: json.data.title,
        excerpt: json.data.excerpt ?? "",
        content: json.data.content,
        categorySlug: json.data.category_slug,
        authorSlug: json.data.author_slug,
        featuredImage: json.data.featured_image,
        tags: Array.isArray(json.data.tags) ? json.data.tags.join(", ") : "",
        isPublished: Boolean(json.data.is_published),
        isFeatured: Boolean(json.data.is_featured),
        seoTitle: json.data.seo?.title ?? "",
        seoDescription: json.data.seo?.description ?? "",
        seoKeywords: Array.isArray(json.data.seo?.keywords) ? json.data.seo.keywords.join(", ") : "",
        seoOgImage: json.data.seo?.ogImage ?? "",
      });
    })()
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [id]);

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
    const folderSlug = form.slug.trim();
    if (folderSlug.length < 2) {
      setError("Попълнете slug (мин. 2 знака), за да се качи снимката в отделна папка в Cloudinary (smolyanklima/blog/{slug}/).");
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

  async function save() {
    setError(null);
    const res = await fetch(`/api/admin/articles/${id}`, {
      method: "PUT",
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
        isPublished: form.isPublished,
        isFeatured: form.isFeatured,
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
      }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Грешка при запис");
    return json;
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const res = await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Грешка при изтриване");
    else router.push("/admin/articles");
  }

  if (loading) return <div className="text-center py-12 text-slate-500 font-medium">Зареждане...</div>;

  return (
    <div className="w-full max-w-none space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-1 leading-tight">
          <SectionTitle title="Редакция на статия" hint="Промяна на съдържание, SEO и статус на публикация." />
        </h1>
      </div>

      <HelpCard>
        <HelpRow items={["Пази slug стабилен за SEO", "Променяй SEO само при нужда", "Изтрий премахва статията от сайта"]} />
      </HelpCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      )}

      <Card className="p-6">
        <div className="grid gap-3">
          <label className="block">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Slug</div>
            <div className="text-[11px] text-slate-500 mb-1.5">Частта от URL адреса на статията. Използвай кратък и ясен формат с тирета.</div>
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm({ ...form, slug: e.target.value });
              }}
            />
          </label>
          
          <label className="block">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Заглавие</div>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          
          <label className="block">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Кратко описание</div>
            <div className="text-[11px] text-slate-500 mb-1.5">Показва се в listing страниците и често се използва за SEO description.</div>
            <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={3} />
          </label>
          
          <label className="block">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Съдържание</div>
            <div className="text-[11px] text-slate-500 mb-1.5">Основният текст на статията (може да е markdown).</div>
            <Textarea 
              value={form.content} 
              onChange={(e) => setForm({ ...form, content: e.target.value })} 
              rows={14} 
              className="font-mono text-sm"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Категория</div>
              <Select value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Автор</div>
              <Select value={form.authorSlug} onChange={(e) => setForm({ ...form, authorSlug: e.target.value })}>
                {authors.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Основна снимка (URL)</div>
              <Input value={form.featuredImage} onChange={(e) => setForm({ ...form, featuredImage: e.target.value })} />
            </label>
            <label className="block">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Качи снимка (Cloudinary)</div>
              <div className="text-[11px] text-slate-500 mb-1.5">Папка: smolyanklima/blog/{"{slug}"}/</div>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    uploadFeaturedImage(f).catch((err) => setError(String(err?.message ?? err)));
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:border-sky-300 rounded-lg text-sm font-semibold transition-colors">
                  <Upload className="w-4 h-4" />
                  {uploading ? "Качване..." : "Кликни или пусни файл тук"}
                </div>
              </div>
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Тагове (разделени със запетая)</div>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </label>

          <div className="border-t border-slate-200 pt-6 mt-2">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-bold text-slate-900">SEO</h2>
              <InfoDot text="Настройва title/description/keywords/og:image за търсачки и споделяне." />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">SEO заглавие (title)</div>
                <div className="text-[11px] text-slate-500 mb-1.5">До ~60 символа. Ако е празно, ползва заглавието.</div>
                <Input
                  value={form.seoTitle}
                  onChange={(e) => {
                    setSeoTouched(true);
                    setForm({ ...form, seoTitle: e.target.value });
                  }}
                />
              </label>
              <label className="block">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">SEO описание (description)</div>
                <div className="text-[11px] text-slate-500 mb-1.5">До ~160 символа. Кратко и конкретно.</div>
                <Textarea
                  value={form.seoDescription}
                  onChange={(e) => {
                    setSeoTouched(true);
                    setForm({ ...form, seoDescription: e.target.value });
                  }}
                  rows={2}
                />
              </label>
              <label className="block">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">SEO ключови думи</div>
                <div className="text-[11px] text-slate-500 mb-1.5">По избор. Разделени със запетая.</div>
                <Input
                  value={form.seoKeywords}
                  onChange={(e) => {
                    setSeoTouched(true);
                    setForm({ ...form, seoKeywords: e.target.value });
                  }}
                />
              </label>
              <label className="block">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">OG снимка (og:image URL)</div>
                <div className="text-[11px] text-slate-500 mb-1.5">Снимка за споделяне в социални мрежи.</div>
                <Input
                  value={form.seoOgImage}
                  onChange={(e) => {
                    setSeoTouched(true);
                    setForm({ ...form, seoOgImage: e.target.value });
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-200">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              <span className="text-sm font-semibold text-slate-700">Публикувана</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
              <span className="text-sm font-semibold text-slate-700">Избрана</span>
            </label>
          </div>
        </div>
      </Card>

      <div className="flex justify-between items-center">
        <Button variant="danger" onClick={remove} className="gap-2">
          <Trash2 className="w-4 h-4" /> Изтрий статия
        </Button>
        <Button variant="primary" size="lg" onClick={save} className="gap-2 shadow-sm">
          <Save className="w-5 h-5" /> Запази промените
        </Button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-black text-slate-950">Изтриване на статия</div>
            <div className="mt-2 text-sm text-slate-500">Сигурни ли сте, че искате да изтриете тази статия?</div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Отказ</Button>
              <Button variant="danger" onClick={() => void remove()}>Изтрий</Button>
            </div>
          </div>
        </div>
      )}
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
