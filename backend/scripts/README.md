# Помощни скриптове (backend)

Идеята на тези скриптове е еднократно зареждане на статичен контент в Supabase
(блог статии, опресняване на снимки). **Продуктовият каталог се администрира
изцяло през админ панела** (`/admin/products`), затова за него вече няма seed
скрипт — старият `import:products` беше премахнат заедно с hardcoded списъка
`frontend/data/db.ts`.

## Предпоставки

1. Приложени са всички SQL миграции от `backend/supabase/migrations/` (виж
   `backend/supabase/README.md`).
2. Файл `backend/.env.local` съдържа поне:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Налични команди

| Скрипт | Команда | Действие |
|--------|---------|----------|
| Блог импорт | `npm run import:blog` | Качва статиите от `frontend/data/blog/index.ts` в Supabase (`upsert` по `slug`; `view_count` се запазва ако записът вече съществува). |
| Блог импорт (dry-run) | `npm run import:blog -- --dry-run` | Само брой статии, без писане в БД. |
| Снимки на каталог | `npm run catalog:images` | Синхронизира липсващи снимки. |
| Снимки (само старите) | `npm run catalog:images:stale` | Обновява само остарелите. |

## След импорт

Провери публичния блог през приложението или `GET /api/articles`.
