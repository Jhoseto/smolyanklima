## Cloud Run deploy (автоматично през Cloud Build)

### Вариант (препоръчан за “1 услуга”)
Този проект може да deploy-ва **една Cloud Run услуга** (един контейнер):
- `nginx` сервира Vite SPA (порт `8080`)
- `nginx` проксира `/api`, `/admin`, `/login`, `/_next` към Next.js backend (вътрешно на `3001`)

Файлове:
- `Dockerfile` (repo root) — unified image
- `deploy/nginx-unified.conf`
- `cloudbuild.yaml` (по избор, ако искаш 1 trigger с build config вместо “Dockerfile” режим)

### 1) One-time setup в Google Cloud

#### 1.1 Artifact Registry repo
Създай Docker repo (пример: `apps`):

```bash
gcloud artifacts repositories create apps \
  --repository-format=docker \
  --location=europe-west1
```

#### 1.2 Cloud Build permissions (задължително)
Cloud Build service account трябва да има роли:
- Artifact Registry Writer
- Cloud Run Admin
- Secret Manager Secret Accessor
- Service Account User
- Cloud Build Builds Editor

### 2) Cloud Run service
Създай една услуга (пример): `smolyanklima`

### 3) Secret Manager secrets (production)

Създай secrets (имената по-долу трябва да съвпадат със secrets в GitHub):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `CLOUDINARY_URL` (ако ползваш upload)
- `RESEND_API_KEY` (ако ползваш email)

### 4) Runtime env vars (Cloud Run)
Задължително:
- `FRONTEND_ORIGIN` (домейнът на сайта; за CORS)
- `APP_URL` (публичният URL на услугата; за email линкове)

Optional:
- `NOTIFY_EMAIL_TO`
- `NOTIFY_EMAIL_FROM`

### 5) Local dev остава непроменен
- `./restart.bat` стартира:
  - frontend: `http://localhost:3000`
  - backend: `http://localhost:3001`

