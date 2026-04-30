import Link from "next/link";
import { adminDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("articles")
    .select("id,slug,title,category_slug,author_slug,is_published,is_featured,created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900 }}>Статии</h1>
        <Link href="/admin/articles/new" style={{ padding: "10px 12px", borderRadius: 12, background: "#0ea5e9", color: "white", fontWeight: 800 }}>
          + Нова статия
        </Link>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          <strong>Грешка в базата:</strong> {error.message}
        </div>
      )}

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              {["Заглавие", "Категория", "Автор", "Публикувана", "Избрана", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#374151" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={{ padding: "10px 12px", fontWeight: 800 }}>{a.title}</td>
                <td style={{ padding: "10px 12px", color: "#6b7280" }}>{a.category_slug}</td>
                <td style={{ padding: "10px 12px", color: "#6b7280" }}>{a.author_slug}</td>
                <td style={{ padding: "10px 12px" }}>{a.is_published ? "Да" : "Не"}</td>
                <td style={{ padding: "10px 12px" }}>{a.is_featured ? "Да" : "Не"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <Link href={`/admin/articles/${a.id}`} style={{ fontWeight: 800 }}>
                    Редакция →
                  </Link>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: "#6b7280" }}>
                  Няма статии.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

