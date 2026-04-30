import Link from "next/link";
import { adminDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,price,is_active,is_featured,created_at,brands:brand_id(name),product_types:type_id(name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900 }}>Продукти</h1>
        <Link href="/admin/products/new" style={{ padding: "10px 12px", borderRadius: 12, background: "#0ea5e9", color: "white", fontWeight: 800 }}>
          + Нов продукт
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
              {["Име", "Марка", "Тип", "Цена", "Активен", "Избран", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#374151" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={{ padding: "10px 12px", fontWeight: 800 }}>{p.name}</td>
                <td style={{ padding: "10px 12px", color: "#6b7280" }}>{(p as any).brands?.name ?? "—"}</td>
                <td style={{ padding: "10px 12px", color: "#6b7280" }}>{(p as any).product_types?.name ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>€{Number(p.price).toLocaleString()}</td>
                <td style={{ padding: "10px 12px" }}>{p.is_active ? "Да" : "Не"}</td>
                <td style={{ padding: "10px 12px" }}>{p.is_featured ? "Да" : "Не"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <Link href={`/admin/products/${p.id}`} style={{ fontWeight: 800 }}>
                    Редакция →
                  </Link>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 14, color: "#6b7280" }}>
                  Няма продукти.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

