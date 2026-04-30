import Link from "next/link";
import { logoutAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
      <aside style={{ borderRight: "1px solid #e2e8f0", background: "white", padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, color: "#0f172a", fontSize: 15, letterSpacing: 0.2 }}>Админ панел</div>
        <nav style={{ display: "grid", gap: 7, fontSize: 13 }}>
          <NavLink href="/admin" label="Табло" />
          <NavLink href="/admin/operations" label="Операции" />
          <NavLink href="/admin/products" label="Продукти" />
          <NavLink href="/admin/articles" label="Статии" />
          <NavLink href="/admin/ratings" label="Оценки" />
          <NavLink href="/admin/inquiries" label="Запитвания" />
          <NavLink href="/admin/history" label="История" />
          <NavLink href="/admin/settings" label="Настройки" />
        </nav>
        <form action={logoutAction} style={{ marginTop: 14 }}>
          <button type="submit" style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", fontWeight: 600, color: "#0f172a", fontSize: 12 }}>
            Изход
          </button>
        </form>
      </aside>
      <main style={{ padding: 18 }}>{children}</main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "8px 10px",
        borderRadius: 10,
        color: "#334155",
        fontWeight: 600,
        textDecoration: "none",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        fontSize: 12,
      }}
    >
      {label}
    </Link>
  );
}

