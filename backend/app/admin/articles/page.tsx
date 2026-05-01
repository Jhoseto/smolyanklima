import Link from "next/link";
import { adminDb } from "@/lib/admin/db";
import { SectionTitle, Table, Th, Td, Button } from "../ui";
import { Plus, Edit } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("articles")
    .select("id,slug,title,category_slug,author_slug,is_published,is_featured,created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Статии" hint="Управление на блог съдържание, SEO и публикуване." />
        </h1>
        <Link href="/admin/articles/new" className="inline-flex items-center gap-2 bg-sky-600 text-white px-3 py-2 rounded-xl font-semibold hover:bg-sky-700 active:bg-sky-800 transition-colors shadow-sm text-sm">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Нова статия</span>
          <span className="sm:hidden">Нова</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">
          <strong>Грешка в базата:</strong> {error.message}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Заглавие</Th>
              <Th>Категория</Th>
              <Th>Автор</Th>
              <Th>Публ.</Th>
              <Th>Избр.</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                <Td className="font-bold text-slate-900">{a.title}</Td>
                <Td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{a.category_slug}</span></Td>
                <Td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{a.author_slug}</span></Td>
                <Td><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${a.is_published ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{a.is_published ? "Да" : "Не"}</span></Td>
                <Td><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${a.is_featured ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{a.is_featured ? "Да" : "Не"}</span></Td>
                <Td>
                  <Link href={`/admin/articles/${a.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-lg text-xs font-bold transition-colors shadow-sm">
                    <Edit className="w-3.5 h-3.5" /> Редакция
                  </Link>
                </Td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><Td colSpan={6} className="text-center py-8 text-slate-500">Няма намерени статии.</Td></tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {(data ?? []).length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени статии.</div>
        )}
        {(data ?? []).map((a) => (
          <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="font-bold text-slate-900 text-sm leading-snug mb-2">{a.title}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{a.category_slug}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${a.is_published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {a.is_published ? "✓ Публикувана" : "Чернова"}
                </span>
                {a.is_featured && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">★ Избрана</span>
                )}
              </div>
            </div>
            <div className="border-t border-slate-100">
              <Link href={`/admin/articles/${a.id}`} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 active:bg-sky-100 transition-colors">
                <Edit className="w-4 h-4" /> Редакция
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
