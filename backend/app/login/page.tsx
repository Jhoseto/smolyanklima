import { loginAction } from "./actions";
import { LoginPWAInstall } from "./LoginPWAInstall";
import { AdminLogo } from "../admin/AdminLogo";

export const metadata = {
  title: "Вход — администрация | Смолян Клима",
  description: "Административен портал с класифициран достъп.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next ?? "/admin";
  const error = sp.error;
  const reason = sp.reason;
  const publicSite = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <AdminLogo size="lg" uniqueId="login" showIcon={false} className="justify-center" />
          <p className="login-tagline">Административен портал</p>
        </div>

        <div className="login-classified">
          <svg className="login-classified-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <strong>Класифициран достъп</strong>
            <p>
              Този раздел е само за оторизирани служители на Смолян Клима. Неоторизиран достъп и опити за влизане чрез чужди
              акаунти са забранени и могат да бъдат отчетени и преследвани съгласно вътрешните правила и приложимото право.
            </p>
          </div>
        </div>

        <LoginPWAInstall />

        <h1 className="login-title">Вход в системата</h1>
        <p className="login-sub">Въведете телефонния си номер или имейл и паролата си.</p>

        {reason === "not_admin" && (
          <div className="login-alert login-alert--warn" role="alert">
            <strong style={{ display: "block", marginBottom: 6 }}>Нямате администраторски права</strong>
            <span>
              Паролата е приета, но акаунтът липсва или е неактивен в{" "}
              <code style={{ opacity: 0.95 }}>admin_users</code>. След възстановяване от резервно копие Auth
              потребителите не се импортират — в Supabase SQL Editor свържете UUID от{" "}
              <code style={{ opacity: 0.95 }}>auth.users</code> с ред в{" "}
              <code style={{ opacity: 0.95 }}>admin_users</code> (роля{" "}
              <code style={{ opacity: 0.95 }}>master_admin</code>,{" "}
              <code style={{ opacity: 0.95 }}>is_active = true</code>).
            </span>
          </div>
        )}

        {error && (
          <div className="login-alert login-alert--err" role="alert">
            <strong style={{ display: "block", marginBottom: 6 }}>Неуспешен вход</strong>
            <span>{error}</span>
          </div>
        )}

        <form action={loginAction} className="login-form">
          <input type="hidden" name="next" value={next} />

          <label className="login-label">
            <span>Телефон или имейл</span>
            <input
              name="email"
              type="text"
              required
              autoComplete="username"
              placeholder="0888 58 58 16 или admin@example.com"
              className="login-input"
            />
          </label>

          <label className="login-label">
            <span>Парола</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder=""
              className="login-input"
            />
          </label>

          <button type="submit" className="login-submit">
            Вход
          </button>
        </form>

        <a href={publicSite} className="login-back">
          ← Обратно към публичния сайт
        </a>
      </div>
    </div>
  );
}
