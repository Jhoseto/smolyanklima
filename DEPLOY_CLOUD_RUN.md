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

### Cloud Build (`cloudbuild.yaml`) — като [STAIPOAI](https://github.com/Jhoseto/STAIPOAI), един service

- Образи в **Google Container Registry формат**: `gcr.io/$PROJECT_ID/smolyanklima` (+ tags `$COMMIT_SHA` и `latest`), **push** с `--all-tags`, секция **`images`**, **`options.logging`** + **`machineType: E2_HIGHCPU_8`**.
- **Разлика от STAIPOAI**: при теб е **един** Cloud Run service (не backend+frontend поотделно); тайните за runtime са в **Secret Manager** и се закачат с `--set-secrets` (в STAIPOAI много стойности са в **substitution variables** на тригера — по-лесно, но по-малко сигурно).
- Задай **`_PUBLIC_URL`** в тригера = HTTPS URL на услугата (без `/` накрая).
- Secret Manager: имената трябва да съвпадат с `--set-secrets` в `cloudbuild.yaml`.

### GitHub Actions (unified)

Задължителни secrets (минимум):

- `GCP_PROJECT_ID`, `GCP_REGION`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`
- `CLOUD_RUN_SERVICE` — име на Cloud Run service (напр. `smolyanklima`)
- `PROD_FRONTEND_ORIGIN` — **същият** URL като публичния на услугата (HTTPS, без trailing slash)
- `SECRET_SUPABASE_URL`, `SECRET_SUPABASE_ANON_KEY`, `SECRET_SUPABASE_SERVICE_ROLE_KEY`, `SECRET_GEMINI_API_KEY`, `SECRET_CLOUDINARY_URL` (references към Secret Manager имена в GCP)
- `RESEND` в workflow е махнат — при нужда добави ръчно в Cloud Run или втори `--set-secrets` в workflow
- По желание: `PROD_NOTIFY_EMAIL_TO`, `PROD_NOTIFY_EMAIL_FROM`

След **Run workflow** (ръчно): build, push към **`gcr.io/PROJECT_ID/smolyanklima`**, deploy към Cloud Run.

### Проверка след deploy

- `GET /api/health` → JSON `ok: true`
- Началната страница е SPA, не Next.js starter (няма `backend/app/page.tsx` за `/`)

---

## Нов GCP проект: всички настройки стъпка по стъпка + deploy от GitHub (Cloud Build)

Долу е **един** начин: **push към правилния клон → Cloud Build → `gcr.io/...` → Cloud Run**. **Регионът** в `cloudbuild.yaml` (`_REGION`) трябва да е **същият** като региона на Cloud Run услугата (при теб по екрана: **`europe-west3`**). Име на услуга: **`smolyanklima`** (`_SERVICE`).

### Част A — Google Cloud проект и фактуриране

1. Отвори [Google Cloud Console](https://console.cloud.google.com).
2. Отгоре до името на проекта → **Select a project** → **New project**.
3. **Project name**: по избор. **Project ID**: запомни го (уникален).
4. **Create** → избери проекта от селектора.
5. **☰ → Billing** → **Link a billing account**.

### Част B — включване на API услуги

1. **☰ → APIs & Services → Library** (или „Enable APIs“).
2. Включи (Enable) поне:
   - **Cloud Build API**
   - **Artifact Registry API**
   - **Container Registry API** (препоръчително за `gcr.io`, както при STAIPOAI)
   - **Cloud Run Admin API**
   - **Secret Manager API**
   - **IAM Service Account Credentials API** (често се иска за свързване с GitHub)
3. Изчакай „API enabled“ за всяка.

### Част C — Registry (`gcr.io`, като STAIPOAI)

**Обикновено не е нужно** ръчно да създаваш отделен Artifact Registry repository за този проект: първият успешен `docker push gcr.io/$PROJECT_ID/smolyanklima:...` от Cloud Build създава/използва подходящото хранилище в проекта.

Ако push към `gcr.io` връща грешка за права или bucket: на Cloud Build service account добави роля **Storage Admin** (или поне права върху bucket-а за container artifacts на проекта) според съобщението в лога; включи и **Container Registry API**.

### Част D — Secret Manager (production тайни)

1. **☰ → Security → Secret Manager** (или търси „Secret Manager“).
2. За **всяко** от долните имена: **Create secret** → **Name** точно както е написано → **Secret value** = реалната стойност → **Create**.

Задължителни за **`cloudbuild.yaml`** (трябва да съществуват в Secret Manager):

| Secret name (име в GCP) |
|---|
| `SUPABASE_URL` |
| `SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` |
| `GEMINI_API_KEY` |
| `CLOUDINARY_URL` |

**По желание (имейл през Resend):** `RESEND_API_KEY` — няма в типичния `.env.local`, докато не се настрои Resend. Тогава: създай secret в Secret Manager и в **Cloud Run → Edit revision → Variables & secrets** добави env от secret `RESEND_API_KEY`, или добави обратно в `cloudbuild.yaml` в `--set-secrets=...,RESEND_API_KEY=RESEND_API_KEY:latest` след като secret-ът съществува.

Ако някоя от задължителните интеграции още не се ползва, създай secret с валидна placeholder стойност (според `backend/lib/env.ts`), иначе **`gcloud run deploy` пада**.

### Част E — Service account-и и роли (IAM)

#### E1. Cloud Build (който пуска build и deploy)

1. **☰ → IAM & Admin → IAM**.
2. Намери имейла **`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`** (Google-managed Cloud Build service account). `PROJECT_NUMBER` виж в **IAM & Admin → Settings** (Project number).

На този principal добави роли (**Grant access** / отвори реда → **Edit** → **Add role**):

- **Artifact Registry Writer** (или роля за push към `gcr.io` / AR — виж Част C при грешка)
- **Storage Admin** (само ако push към `gcr.io` връща „Access denied“ за bucket — опционално, по лога)
- **Cloud Run Admin**
- **Service Account User** (за да деплойва от името на runtime service account-а на Cloud Run — виж E2)
- **Secret Manager Secret Accessor** (да монтира/закача secrets към Cloud Run при deploy)

(Ако UI предлага „Cloud Build Service Agent“ или отделни политики за Repository — при грешка „permission denied“ в лога добави и **Logs Writer** към същия SA, по-рядко.)

#### E2. Cloud Run runtime (който вика Supabase със secrets в runtime)

По подразбиране Cloud Run ползва Compute Engine default service account:

**`PROJECT_NUMBER-compute@developer.gserviceaccount.com`**

1. **IAM** → намери **`...-compute@developer.gserviceaccount.com`** → **Edit** → добави роля:
   - **Secret Manager Secret Accessor**

Това позволява на контейнера да чете стойностите на горните secrets като env vars.

### Част F — Първи deploy и реален URL (`_PUBLIC_URL`)

След първия успешен deploy Cloud Run ще даде URL от вида:

`https://smolyanklima-XXXXXXXXXX.europe-west3.run.app` (регионът съвпада с услугата)

Този URL **без** накраен `/` трябва да влезе в substitution **`_PUBLIC_URL`** (и в реалността е `FRONTEND_ORIGIN` + `APP_URL`).

**Вариант 1 (препоръчан ред):**

1. Направи първия успешен build/deploy от тригер (Част G) с временен `_PUBLIC_URL` (може да е същият URL, който очакваш, ако вече знаеш субдомейна от предишен service — при напълно нов service UUID се генерира при първо създаване).
2. След успех: **Cloud Run** → услуга **`smolyanklima`** → копирай **URL**.
3. **Cloud Build → Triggers** → твоя trigger → **Edit** → **Substitution variables** → **`_PUBLIC_URL`** = копираният URL → **Save**.
4. Направи празен commit / **Run trigger** отново, за да се приложат коректните env за CORS.

**Вариант 2:** След първия deploy обнови само услугата: **Cloud Run** → service → **Edit & deploy new revision** → **Variables & secrets** — задай **FRONTEND_ORIGIN** и **APP_URL** ръчно към същия публичен URL (ако не искаш да чакаш втори build).

### Част G — Свързване на GitHub и Cloud Build trigger (автоматичен deploy)

#### G1. GitHub приложение

1. В GCP: **☰ → Cloud Build → Repositories** (или **Connections** в по-новия UI „Developer Connect“).
2. **Connect repository** → избери **GitHub** (Cloud Build GitHub App).
3. Следвай OAuth/инсталацията. В GitHub: **Settings → Applications → Installed GitHub Apps → Google Cloud Build** → **Configure**:
   - дай достъп до repo **`Jhoseto/smolyanklima`** (или **All repositories**, ако ти е ок).
4. Завърши свързването, докато repo се вижда без грешка в GCP.

#### G2. Създаване на trigger

1. **Cloud Build → Triggers** → **Create trigger**.
2. **Name**: напр. `deploy-smolyanklima-main`.
3. **Region** на тригера: обикновено **global**; **`_REGION` в substitution** трябва да е регионът на Cloud Run (напр. `europe-west3`).
4. **Event**: **Push to a branch**.
5. **Source**: избери свързания GitHub repo.
6. **Branch (regex)** — **трябва да съвпада с реалния клон в GitHub**:
   - само `main` → `^main$`
   - само `master` → `^master$`
   - ако Cloud Run wizard е задал `main`, а repo-то е **`master`**, тригерът **никога** няма да пусне build (грешка: *no branch matching the configured branch pattern*).
7. **Configuration**:
   - Type: **Cloud Build configuration file (yaml or json)**.
   - **Location**: **Repository**.
   - **Cloud Build configuration file location**: `cloudbuild.yaml` (в root на repo).
8. **Substitution variables** (User-defined; задължително попълни поне):
   - **`_PUBLIC_URL`** = `https://ТВОЯТА-услуга....run.app` (без `/` накрая; обнови след първи deploy, виж Част F).
   - Останалите **`_REGION`**, **`_SERVICE`** идват от `cloudbuild.yaml`, освен ако не ги override-неш в тригера.
9. **Create** / **Save**.

#### G3. Тест

1. **Run trigger** (от тригера):
   - **Branch**: напиши **`main`** (не `*`).
2. **Cloud Build → History** — провери зелен build.
3. **Cloud Run** — нова ревизия на **`smolyanklima`**.
4. Отвори URL → **`/api/health`**.

При всеки **push към клона, който тригерът наблюдава** (обикновено `main` или `master`), автоматичният build трябва да тръгне.

### Част H — GitHub: само един автоматичен deploy

В репото има и **GitHub Actions** (`.github/workflows/deploy-cloud-run.yml`). Ако оставиш **и** Cloud Build trigger, и **push** към `main` в Actions, ще имаш **два** деплоя наведнъж.

**Препоръка:** ползваш **само Cloud Build** → в GitHub изключи автоматичния push deploy:

- промени `on:` в workflow на само `workflow_dispatch:` (ръчно пускане), **или**
- изтрий/деактивирай workflow файла.

Ако пуснеш **Deploy (Cloud Run)** без настроени secrets **`GCP_WORKLOAD_IDENTITY_PROVIDER`** и **`GCP_SERVICE_ACCOUNT`**, GitHub Actions ще падне с грешка от `google-github-actions/auth`. Това **не спира** Cloud Build — просто не ползвай този workflow, докато не конфигурираш WIF, или се фокусирай само на тригера в GCP.

### Част I — Типични грешки

| Симптом | Какво да провериш |
|--------|-------------------|
| „Failed to list branches“ / „Couldn’t read commit“ | GitHub App permissions; reconnect repo (Част G1). |
| „no branch matching the configured branch pattern“ | **Cloud Build → Triggers → Edit**: regex да съвпада с клона в GitHub (`^main$` vs `^master$`). Направи commit/push към този клон. |
| Placeholder image `gcr.io/cloudrun/placeholder` | Build от repo още не е успявал; след корекция на клона — нов build. |
| Build: push denied | Cloud Build SA → **Artifact Registry Writer** |
| Deploy: permission | Cloud Build SA → **Cloud Run Admin**, **Service Account User** |
| Deploy: secret access | Runtime SA → **Secret Manager Secret Accessor**; имената на secrets = таблицата |
| 502 след deploy | порт контейнер **8080**; логове на Cloud Run |

---

## Кратък ред на изпълнение (checklist)

1. Нов проект + Billing  
2. Enable APIs (Build, Artifact Registry, Run, Secret Manager, …)  
3. `_REGION` в тригера = регион на Cloud Run (напр. `europe-west3`)  
4. Secret Manager: задължителните 5 secrets + по желание `RESEND_API_KEY`  
5. IAM: Cloud Build SA + Compute default SA роли  
6. Свържи GitHub, създай trigger към `cloudbuild.yaml`, regex `^main$`, `_PUBLIC_URL`  
7. Run trigger с branch `main` → после обнови `_PUBLIC_URL` ако URL-ът е нов  
8. Изключи дублиращ GitHub Actions push (Част H)
