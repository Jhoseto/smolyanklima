import { loginAction } from "./actions";

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
          <div className="login-logo">
            <span className="login-logo-smolyan">СМОЛЯН</span>
            <span className="login-logo-klima">КЛИМА</span>
          </div>
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

        <h1 className="login-title">Вход в системата</h1>
        <p className="login-sub">Въведете корпоративните си идентификационни данни.</p>

        {reason === "not_admin" && (
          <div className="login-alert login-alert--warn" role="alert">
            <strong style={{ display: "block", marginBottom: 6 }}>Нямате администраторски права</strong>
            <span>
              Акаунтът не е активиран в списъка на администраторите. Свържете се с отговорното лице или проверете записа в{" "}
              <code style={{ opacity: 0.95 }}>admin_users</code>.
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
            <span>Имейл</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="office@smolyanklima.bg"
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
              placeholder="••••••••"
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
