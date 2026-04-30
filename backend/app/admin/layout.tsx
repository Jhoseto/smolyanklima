import Link from "next/link";
import { logoutAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #e5e7eb", padding: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 16 }}>Админ панел</div>
        <nav style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <Link href="/admin">Табло</Link>
          <Link href="/admin/products">Продукти</Link>
          <Link href="/admin/articles">Статии</Link>
          <Link href="/admin/inquiries">Запитвания</Link>
          <Link href="/admin/settings">Настройки</Link>
        </nav>
        <form action={logoutAction} style={{ marginTop: 18 }}>
          <button type="submit" style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
            Изход
          </button>
        </form>
      </aside>
      <main style={{ padding: 20 }}>{children}</main>
    </div>
  );
}

