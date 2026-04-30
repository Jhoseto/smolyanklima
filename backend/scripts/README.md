# Импорт от frontend към Supabase (Фаза 5)

Единственият източник на „seed“ данни за каталог и блог в репото са TypeScript модулите под `frontend/data/`. Скриптовете по-долу ги качват в Postgres през **service role** ключ.

## Предпоставки

1. Приложени са всички SQL миграции от `backend/supabase/migrations/` (виж `backend/supabase/README.md`).
2. Файл `backend/.env.local` съдъжа поне:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Ред на изпълнение (препоръчително)

1. Първо продукти (марки, типове, продукти, specs, features, образи от `frontend/data/db.ts`):

   ```bash
   cd backend
   npm run import:products
   ```

2. После статии от `frontend/data/blog/index.ts` (през `index.ts` експорт):

   ```bash
   npm run import:blog
   ```

Повторното пускане е **идемпотентно**: същите `slug`-ове се обновяват, не се дублират редове.

## Флагове

| Скрипт | Команда | Ефект |
|--------|---------|--------|
| Продукти | `npm run import:products -- --dry-run` | Само брой записи от източника, без DB |
| Продукти | `npm run import:products -- --help` | Кратка помощ |
| Блог | `npm run import:blog -- --dry-run` | Само брой статии, без DB |
| Блог | `npm run import:blog -- --help` | Кратка помощ |

## Идемпотентност (какво се случва при втори run)

- **Продукти:** `upsert` по `slug`; `product_features` за всеки продукт се **изчиства и презаписва** спрямо текущия списък features в `db.ts` (няма останали „висящи“ връзки). Главната снимка `/images/{slug}.jpg` се презаписва по същия URL.
- **Аксесоари/части:** по `accessories.slug`; при нужда се премахва дублиращ ред в `products`.
- **Статии:** `upsert` по `slug`; **`view_count` се взима от базата**, ако записът вече съществува (не се нулира при повторен импорт).

## След импорт

Провери публичния каталог и блог през приложението или `GET /api/products`, `GET /api/articles`.
