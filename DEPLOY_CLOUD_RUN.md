## Production: Google Cloud Run (препоръчан модел)

Един **Cloud Run service**, един **Docker image** от **repo root `Dockerfile`**:

- Next.js (standalone) слуша `$PORT` (Cloud Run подава **8080**).
- Vite build се копира в `public/`; `backend/next.config.mjs` пренасочва „клиентски“ пътища към `/index.html` (SPA), а `/api/*`, `/admin/*`, `/login` остават за Next.js.
- Локално: Vite (`npm run dev` в root) проксира `/api` към Next на **3001** (`vite.config.ts`); това **не се използва** в контейнера.

### Защо автоматичният deploy „не работи“

Има **два независими** механизма; объркват се лесно:

1. **Cloud Build trigger** (GitHub → Cloud Build) — ако в конзолата виждаш *„Failed to list branches“* / *„Couldn’t read commit“*, връзката **Google Cloud Build ↔ GitHub app** е счупена. Трябва reconnect на repository (Cloud Build → Repositories) или настройка на GitHub App permissions. Без това trigger **никога** няма да стартира build.
2. **GitHub Actions** — `.github/workflows/deploy-cloud-run.yml` деплойва директно през WIF **без** Cloud Build GitHub connector. Ако липсват secrets или WIF е грешен, workflow пада; провери **Actions** таб в GitHub.

**Не ползвай едновременно** два различни модела за един и същ сайт (един път unified image, друг път отделен frontend nginx + отделен backend), освен ако наистина знаеш какво правиш.

### Грешка: отделен frontend (nginx) + отделен backend

`frontend/nginx.conf` **няма** `proxy_pass` към `/api`. SPA-то вика `fetch("/api/...")` — на чист nginx това **не стига** до Next.js. Затова в production ползвай **само root `Dockerfile`**, или добави изричен reverse proxy (извън scope на текущия препоръчан setup).

### Cloud Build (`cloudbuild.yaml`)

- Задай **`_PUBLIC_URL`** = точният HTTPS URL на услугата (без `/` накрая), напр. в trigger → **Substitutions**. Иначе CORS/`getEnv()` ще са с грешен `FRONTEND_ORIGIN` / `APP_URL`.
- Secret Manager: имената трябва да съвпадат с `--set-secrets` в `cloudbuild.yaml`.

### GitHub Actions (unified)

Задължителни secrets (минимум):

- `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ARTIFACT_REPO`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`
- `CLOUD_RUN_SERVICE` — име на Cloud Run service (напр. `smolyanklima`)
- `PROD_FRONTEND_ORIGIN` — **същият** URL като публичния на услугата (HTTPS, без trailing slash)
- `SECRET_SUPABASE_URL`, `SECRET_SUPABASE_ANON_KEY`, `SECRET_SUPABASE_SERVICE_ROLE_KEY` (+ останалите secret refs както в workflow)
- По желание: `PROD_NOTIFY_EMAIL_TO`, `PROD_NOTIFY_EMAIL_FROM`

След push към `main` / `master` (или **Run workflow** ръчно): build на root `Dockerfile`, push към Artifact Registry, `gcloud run deploy` с `--port 8080`.

### Проверка след deploy

- `GET /api/health` → JSON `ok: true`
- Началната страница е SPA, не Next.js starter (няма `backend/app/page.tsx` за `/`)
