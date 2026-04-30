import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next ?? "/admin";
  const error = sp.error;
  const reason = sp.reason;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Вход за администратори</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
          Влез с админ акаунта си (Supabase Auth).
        </p>

        {reason === "not_admin" && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: 12, borderRadius: 12, marginBottom: 12 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>Нямаш админ достъп</strong>
            <span style={{ fontSize: 13, color: "#9a3412" }}>
              Акаунтът не е добавен/активиран в <code>admin_users</code>.
            </span>
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>Грешка</strong>
            <span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span>
          </div>
        )}

        <form action={loginAction} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="next" value={next} />

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>Имейл</span>
            <input
              name="email"
              type="email"
              required
              placeholder="admin@smolyanklima.bg"
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>Парола</span>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #0ea5e9",
              background: "#0ea5e9",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Вход
          </button>
        </form>
      </div>
    </div>
  );
}

