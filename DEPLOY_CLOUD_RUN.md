## Cloud Run deploy (автоматично през GitHub)

Този проект deploy-ва **две Cloud Run услуги**:
- **backend**: Next.js (Admin + Public API) на порт `3001`
- **frontend**: Vite SPA, сервирана статично от `nginx` на порт `8080`

Deploy workflow: `.github/workflows/deploy-cloud-run.yml` (trigger: push към `main/master`).

### 1) One-time setup в Google Cloud

#### 1.1 Artifact Registry repo
Създай Docker repo (пример: `apps`):

```bash
gcloud artifacts repositories create apps \
  --repository-format=docker \
  --location=europe-west1
```

#### 1.2 Workload Identity Federation (GitHub → GCP)
Препоръчан подход: Workload Identity Federation + service account.

Създай service account (пример):

```bash
gcloud iam service-accounts create gha-deployer
```

Дай роли (минимално):
- `roles/run.admin`
- `roles/artifactregistry.writer`
- `roles/iam.serviceAccountUser`
- `roles/secretmanager.secretAccessor`

След това създай WIF pool/provider за GitHub и ограничи по repo/branch.

### 2) Cloud Run services

Създай/избери имена (пример):
- backend: `smolyanklima-backend`
- frontend: `smolyanklima-frontend`

### 3) Secret Manager secrets (production)

Създай secrets (имената по-долу трябва да съвпадат със secrets в GitHub):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `CLOUDINARY_URL` (ако ползваш upload)
- `RESEND_API_KEY` (ако ползваш email)

### 4) GitHub repo secrets (нужни за workflow-а)

**GCP:**
- `GCP_PROJECT_ID`
- `GCP_REGION` (пример: `europe-west1`)
- `GCP_ARTIFACT_REPO` (пример: `apps`)
- `GCP_WORKLOAD_IDENTITY_PROVIDER` (full resource name)
- `GCP_SERVICE_ACCOUNT` (email на service account)

**Cloud Run service names:**
- `CLOUD_RUN_BACKEND_SERVICE`
- `CLOUD_RUN_FRONTEND_SERVICE`

**Production origins:**
- `PROD_FRONTEND_ORIGIN` (пример: `https://www.smolyanklima.bg`)
- `PROD_BACKEND_ORIGIN` (пример: `https://api.smolyanklima.bg` или Cloud Run URL)

**Secret references** (по избор можеш да ги държиш като константи; тук са secrets за гъвкавост):
- `SECRET_SUPABASE_URL` (например `SUPABASE_URL`)
- `SECRET_SUPABASE_ANON_KEY`
- `SECRET_SUPABASE_SERVICE_ROLE_KEY`
- `SECRET_GEMINI_API_KEY`
- `SECRET_CLOUDINARY_URL` (ако няма — остави празно и махни реда от workflow)
- `SECRET_RESEND_API_KEY` (ако няма — остави празно и махни реда от workflow)

**Email (optional):**
- `PROD_NOTIFY_EMAIL_TO`
- `PROD_NOTIFY_EMAIL_FROM`

### 5) Local dev остава непроменен
- `./restart.bat` стартира:
  - frontend: `http://localhost:3000`
  - backend: `http://localhost:3001`

