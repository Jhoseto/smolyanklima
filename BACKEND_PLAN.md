# 🔧 ПЛАН: Backend Реализация – SmolyanKlima

> **Цел:** Пълнофункционален backend с админ панел, API и база данни  
> **Stack:** 100% БЕЗПЛАТЕН - Supabase + Cloudinary + Google Cloud Run  
> **Frontend:** Вече изграден (React + Vite)  
> **Статус:** ✅ Архитектура финализирана - готов за имплементация

---

## 🎯 Финална Архитектура: 100% Безплатен Stack

### ✅ Избран Stack (0 лв/месец)

| Компонент | Сервиз | Цена | Лимити | Забележка |
|-----------|--------|------|--------|-----------|
| **Backend** | Next.js 15 + Cloud Run | **$0** | 2M requests/месец | Винаги активен |
| **Database** | Supabase Free | **$0** | 500MB, 50K users | Може да заспива (3-5 сек събуждане) |
| **Images** | Cloudinary Free | **$0** | 25GB storage | Оптимизация + CDN |
| **Auth** | Supabase Auth | **$0** | 50K users | JWT included |
| **CI/CD** | GitHub Actions | **$0** | Public repo | Auto-deploy |

### 🏗️ Архитектура Диаграма

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React/Vite)                    │
│                     ┌─────────────────┐                      │
│                     │   Cloudinary    │ ← Снимки (25GB free) │
│                     │   (Free Tier)   │                      │
│                     └─────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Next.js 15 App Router)                 │
│                    Google Cloud Run Free                     │
│              ┌──────────────────────────┐                  │
│              │   • Server Actions         │                  │
│              │   • Admin Panel (custom)   │                  │
│              │   • API Routes             │                  │
│              │   • AI Integrations        │                  │
│              └──────────────────────────┘                  │
│                         │                                   │
│                         ▼                                   │
│              ┌──────────────────────────┐                  │
│              │   Supabase Free ($0)     │                  │
│              │   PostgreSQL 500MB       │                  │
│              │   ⚠️ Може да заспива     │ ← Приемливо      │
│              │   ⏱️ Събужда се за 3-5 сек│   (3-5 сек)      │
│              └──────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Технологичен Стек (Финализиран)

### 🎯 Core (Безплатен)
| Технология | Версия | За какво | Цена |
|------------|--------|----------|------|
| **Next.js** | 15.x | Framework, API, Admin | $0 |
| **React** | 19.x | UI (admin) | $0 |
| **TypeScript** | 5.8 | Типизация | $0 |
| **Tailwind CSS** | 4.x | Styling | $0 |

### 🗄️ Database & Storage (Безплатен)
| Технология | За какво | Лимит | Цена |
|------------|----------|-------|------|
| **Supabase** | PostgreSQL + Auth | 500MB | $0 |
| **Cloudinary** | Снимки + CDN | 25GB | $0 |
| **Supabase Auth** | JWT аутентикация | 50K users | $0 |

### 🛠️ Dev & Deploy (Безплатен)
| Технология | За какво | Цена |
|------------|----------|------|
| **Google Cloud Run** | Hosting backend | $0 |
| **GitHub Actions** | CI/CD автоматизация | $0 |
| **Docker** | Containerization | $0 |

### 🧰 Libraries
| Технология | За какво |
|------------|----------|
| **Zod** | Валидация на данни |
| **React Hook Form** | Форми в админ панела |
| **date-fns** | Работа с дати |
| **slugify** | URL-friendly имена |
| **@supabase/supabase-js** | Database client |
| **cloudinary** | Image upload & optimization |

---

## 🗄️ Supabase База Данни – Схема

### Таблици

```sql
-- ПРОДУКТИ
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  type TEXT NOT NULL, -- 'wall' | 'multi-split' | 'cassette' | 'floor' | 'duct' | 'portable' | 'accessory' | 'part'
  category TEXT NOT NULL,
  area TEXT,
  
  -- Технически характеристики
  energy_cool TEXT, -- 'A+++' | 'A++' | 'A+' | 'A'
  energy_heat TEXT,
  noise TEXT,
  cooling_power TEXT,
  heating_power TEXT,
  refrigerant TEXT, -- 'R-32' | 'R-410A' | 'R-290' | null
  wifi BOOLEAN DEFAULT false,
  warranty TEXT,
  
  -- Описание и features
  description TEXT,
  features TEXT[], -- PostgreSQL масив
  
  -- Цени (в EUR)
  price DECIMAL(10,2) NOT NULL,
  price_with_mount DECIMAL(10,2),
  cost_price DECIMAL(10,2), -- за админа
  
  -- Медия
  images TEXT[], -- масив от URL-и
  main_image TEXT,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  
  -- Статус
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false, -- за "Топ продукти" на главната
  stock_status TEXT DEFAULT 'in_stock', -- 'in_stock' | 'out_of_stock' | 'pre_order'
  stock_quantity INTEGER DEFAULT 0,
  
  -- Рейтинг
  rating DECIMAL(2,1) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- КАТЕГОРИИ
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Lucide icon name
  color TEXT, -- hex цвят за UI
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- МАРКИ
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  color TEXT, -- brand цвят
  is_active BOOLEAN DEFAULT true
);

-- КЛИЕНТИ (за запитвания)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ЗАПИТВАНИЯ (leads)
CREATE TABLE inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT, -- ако няма product_id (общо запитване)
  
  -- Детайли
  message TEXT,
  room_size TEXT, -- квадратура
  room_type TEXT, -- спалня, хол, офис...
  budget_range TEXT,
  
  -- Статус
  status TEXT DEFAULT 'new', -- 'new' | 'contacted' | 'quoted' | 'converted' | 'lost'
  priority TEXT DEFAULT 'medium', -- 'low' | 'medium' | 'high'
  
  -- Assignment
  assigned_to UUID REFERENCES admin_users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

-- ПОРЪЧКИ
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL, -- ORD-2024-001
  customer_id UUID REFERENCES customers(id),
  
  -- Цени
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  -- Статус
  status TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  payment_status TEXT DEFAULT 'pending', -- 'pending' | 'paid' | 'partial' | 'refunded'
  
  -- Монтаж
  installation_date DATE,
  installation_address TEXT,
  installation_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ПОРЪЧКИ - ПРОДУКТИ (many-to-many)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL, -- snapshot на името
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  includes_installation BOOLEAN DEFAULT false
);

-- АДМИН ПОТРЕБИТЕЛИ
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'editor', -- 'super_admin' | 'admin' | 'editor' | 'viewer'
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ОТЗИВИ (reviews)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  text TEXT,
  is_verified BOOLEAN DEFAULT false, -- верифициран клиент
  is_approved BOOLEAN DEFAULT false, -- одобрен от админ
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- СТАТИИ (блог)
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT, -- HTML или Markdown
  category TEXT,
  read_time TEXT,
  image_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- НАСТРОЙКИ НА СИСТЕМАТА
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT
);

-- АКТИВНОСТ (audit log)
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login'
  entity_type TEXT, -- 'product', 'order', 'customer'
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS (Row Level Security) Policies

```sql
-- Продукти: всеки може да чете, само админи да пишат
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone" 
ON products FOR SELECT USING (is_active = true);

CREATE POLICY "Products are editable by admins" 
ON products FOR ALL 
USING (auth.uid() IN (SELECT id FROM admin_users WHERE is_active = true));

-- Запитвания: само създателят (анонимен) и админи
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inquiries viewable by admins" 
ON inquiries FOR SELECT 
USING (auth.uid() IN (SELECT id FROM admin_users WHERE is_active = true));
```

---

## 🚀 API Endpoints (Next.js App Router)

### Публични API (за frontend)

```typescript
// app/api/products/route.ts
GET    /api/products           → Списък с филтриране и пагинация
GET    /api/products/[slug]    → Детайли за продукт
GET    /api/categories         → Всички категории
GET    /api/brands            → Всички марки
POST   /api/inquiries         → Създаване на запитване
GET    /api/articles          → Статии (блог)
GET    /api/articles/[slug]    → Детайлна статия
```

### Admin API (защитени)

```typescript
// app/api/admin/products/route.ts
GET    /api/admin/products         → Всички продукти (с inactive)
POST   /api/admin/products         → Създаване на продукт
PUT    /api/admin/products/[id]    → Редакция
DELETE /api/admin/products/[id]    → Изтриване
PATCH  /api/admin/products/[id]/featured → Featured toggle

// app/api/admin/inquiries/route.ts
GET    /api/admin/inquiries        → Запитвания с филтри
PATCH  /api/admin/inquiries/[id]   → Обновяване статус
POST   /api/admin/inquiries/[id]/assign → Назначаване

// app/api/admin/orders/route.ts
GET    /api/admin/orders           → Поръчки
POST   /api/admin/orders           → Нова поръчка
PUT    /api/admin/orders/[id]     → Редакция
PATCH  /api/admin/orders/[id]/status → Смяна на статус

// app/api/admin/dashboard/route.ts
GET    /api/admin/dashboard/stats    → Статистики
GET    /api/admin/dashboard/revenue  → Приходи по месеци
GET    /api/admin/dashboard/top-products → Топ продукти
```

---

## 🎨 Admin Panel Structure

```
app/admin/
├── layout.tsx           ← Admin Layout с Sidebar
├── page.tsx            ← Dashboard (редиректва)
├── dashboard/
│   └── page.tsx        ← Главно табло с графики
├── products/
│   ├── page.tsx        ← Списък продукти
│   ├── new/
│   │   └── page.tsx    ← Нов продукт
│   └── [id]/
│       └── page.tsx    ← Редакция продукт
├── orders/
│   ├── page.tsx        ← Списък поръчки
│   └── [id]/
│       └── page.tsx    ← Детайлна поръчка
├── inquiries/
│   └── page.tsx        ← Запитвания (CRM)
├── customers/
│   └── page.tsx        ← Клиенти
├── content/
│   ├── articles/
│   └── pages/
└── settings/
    └── page.tsx        ← Настройки
```

### Admin UI Компоненти

```typescript
// components/admin/
├── layout/
│   ├── AdminSidebar.tsx
│   ├── AdminHeader.tsx
│   └── MobileNav.tsx
├── dashboard/
│   ├── StatsCards.tsx      ← 4 карти с KPI
│   ├── RevenueChart.tsx    ← Графика приходи
│   ├── RecentOrders.tsx    ← Последни поръчки
│   └── TopProducts.tsx     ← Топ продукти
├── products/
│   ├── ProductTable.tsx    ← Таблица с филтри
│   ├── ProductForm.tsx     ← Форма за продукт
│   ├── ImageUploader.tsx   ← Upload снимки
│   └── StockBadge.tsx      ← Статус наличност
├── orders/
│   ├── OrderTable.tsx
│   ├── OrderStatusBadge.tsx
│   └── OrderDetail.tsx
└── shared/
    ├── DataTable.tsx       ← Универсална таблица
    ├── ConfirmDialog.tsx   ← Потвърждение
    ├── ToastProvider.tsx   ← Notifications
    └── RichTextEditor.tsx  ← За статии
```

---

## 📱 API Response Examples

### GET /api/products

```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "daikin-perfera-ftxm25r",
      "name": "Daikin Perfera FTXM25R",
      "brand": "Daikin",
      "price": 659.00,
      "price_with_mount": 812.00,
      "main_image": "/images/daikin-perfera.jpg",
      "energy_cool": "A+++",
      "rating": 4.9,
      "reviews_count": 47,
      "stock_status": "in_stock",
      "is_featured": true,
      "category": {
        "id": "uuid",
        "name": "Стенни климатици",
        "slug": "stenni-klimatici"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "total_pages": 5,
    "total_count": 100,
    "per_page": 12
  }
}
```

### POST /api/inquiries

```json
// Request
{
  "name": "Иван Петров",
  "phone": "0888123456",
  "email": "ivan@example.com",
  "product_id": "uuid",
  "message": "Интересувам се от този модел за спалня 20м²",
  "room_size": "20",
  "room_type": "спалня",
  "budget_range": "600-900"
}

// Response
{
  "success": true,
  "message": "Запитването е изпратено успешно! Ще се свържем с вас скоро.",
  "inquiry_id": "uuid"
}
```

---

## 🔐 Аутентикация с Supabase Auth

### Настройка

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookies().set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookies().set({ name, value: '', ...options });
        },
      },
    }
  );
}
```

### Middleware за защита

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Проверка за /admin/* routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const supabase = createServerClient(...);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    
    // Проверка дали е admin
    const { data: admin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (!admin || !admin.is_active) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }
  
  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

---

## 🚀 Deployment Стратегия

### Опция 1: Vercel (Препоръчително)

```bash
# Backend (Next.js) на Vercel
vercel --prod

# Frontend (сегашният) на Netlify или Vercel
# CORS настройки в next.config.js
```

### Опция 2: Self-hosted (VPS)

```bash
# Docker Compose setup
docker-compose up -d
# - Next.js app
# - Nginx reverse proxy
# - Supabase (self-hosted)
```

### Environment Variables

```env
# .env.local (Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Admin credentials (първоначални)
ADMIN_EMAIL=admin@smolyanklima.bg
ADMIN_PASSWORD=secure_random

# App
NEXT_PUBLIC_APP_URL=https://admin.smolyanklima.bg
NEXT_PUBLIC_FRONTEND_URL=https://smolyanklima.bg
```

---

## 📅 План за Имплементация

### Фаза 1: Setup (Ден 1)
- [ ] Създаване на Next.js 15 проект в `backend/` папка
- [ ] Свързване с Supabase
- [ ] Създаване на таблиците (SQL миграция)
- [ ] Настройка на RLS policies
- [ ] Environment variables

### Фаза 2: Data Layer (Ден 2)
- [ ] Prisma schema (или Supabase types)
- [ ] TypeScript интерфейси
- [ ] Seed данни (10 продукта за тест)

### Фаза 3: Public API (Ден 3-4)
- [ ] GET /api/products с филтри
- [ ] GET /api/products/[slug]
- [ ] POST /api/inquiries
- [ ] GET /api/categories, /api/brands

### Фаза 4: Admin Auth (Ден 5)
- [ ] Login page
- [ ] Supabase Auth integration
- [ ] Middleware за защита
- [ ] Admin layout

### Фаза 5: Admin Products (Ден 6-7)
- [ ] Списък продукти с таблица
- [ ] Създаване/редакция форма
- [ ] Image upload (Supabase Storage)
- [ ] Rich text editor за описание

### Фаза 6: Admin Orders & Inquiries (Ден 8-9)
- [ ] Orders CRUD
- [ ] Inquiries CRM board (Kanban)
- [ ] Status management
- [ ] Notifications

### Фаза 7: Dashboard & Polish (Ден 10)
- [ ] Dashboard с графики
- [ ] Responsive mobile
- [ ] Performance optimization
- [ ] Testing

---

## 💡 Альтернативи (за разглеждане)

### Ако не харесваш Next.js:

**Express.js + React Admin**
- ✅ Повече контрол
- ❌ Отделни frontend/backend проекти
- ❌ Повече setup

**Payload CMS**
- ✅ Headless CMS с Admin панел готов
- ✅ Базиран на Next.js
- ⚠️ По-малка общност

**Directus**
- ✅ Open-source headless CMS
- ✅ Готов admin интерфейс
- ❌ Отделен от Next.js

**Strapi**
- ✅ Популярен headless CMS
- ✅ Добра документация
- ❌ Node.js + React (похарчва ресурси)

---

## ✅ КРАЙНА ПРЕПОРЪКА

**Използвай Next.js 15 + Supabase**

Причини:
1. **Един codebase** за API и Admin Panel
2. **Server Components** за бърз админ панел
3. **Отлична Supabase интеграция**
4. **Лесен deployment** на Vercel
5. **Type Safety** от край до край
6. **Екосистема** - огромна общност

**Бюджет:**
- Supabase Free Tier: 2 проекта, 500MB DB
- Google Cloud: Зависи от трафика (Free tier $300 кредити)
- Docker: Безплатно

---

## 🆓 Supabase Free Tier – Приети Лимити

### ✅ Какво ПОЛУЧАВАШ безплатно:

| Ресурс | Лимит | Реално за твоя проект |
|--------|-------|----------------------|
| **База данни** | 500 MB | Достатъчно за 10+ години (100 продукта = ~2MB) |
| **Auth Users** | 50,000 | Достатъчно за всички клиенти |
| **Storage** | 1 GB | Не се ползва (снимките са в Cloudinary) |
| **API Requests** | Unlimited | Без лимит |

### ⚠️ ЕДИНСТВЕНОТО ОГРАНИЧЕНИЕ (Приемливо):

**Паузиране след 7 дни неактивност:**
- Проектът "заспива" ако няма трафик
- **Събуждане:** 3-5 секунди при първа заявка
- **Решение:** Приемливо! Потребителят изчаква 3-5 сек при първи visit
- **Алтернатива:** Може да се избегне с UptimeRobot (но не е необходимо)

### 🚫 Какво НЯМА да е проблем:
- ❌ Място в базата - 500MB е ОГРОМНО за текстови данни
- ❌ Брой заявки - няма лимит
- ❌ Време за ползване - безкраен, няма expiration

### Оптимизации за Free Tier

```sql
-- 1. Изображенията са външно (Cloud Storage / CDN)
-- Само URL-и се пазят в базата
ALTER TABLE products 
  ADD COLUMN images TEXT[]; -- ['https://cdn.smolyanklima.bg/...']

-- 2. Премахни ненужни индекси
DROP INDEX IF EXISTS idx_products_description;

-- 3. Използвай JSONB само когато е нужно
-- Не пази големи JSON в основните таблици

-- 4. Archiving стратегия за стари запитвания
-- Премести >1 година в archive таблица
CREATE TABLE inquiries_archive (LIKE inquiries INCLUDING ALL);
```

### 🖼️ Снимки: Cloudinary Free (25GB)

**Защо Cloudinary:**
- ✅ **25GB безплатен storage** (достатъчно за 5000+ продукта)
- ✅ Автоматична оптимизация (WebP, AVIF)
- ✅ Resize on-the-fly (не пазиш множество версии)
- ✅ Global CDN (бързо зареждане)
- ✅ Face detection, auto-crop
- **Не използвай Supabase Storage** - пази го за админ документи ако е нужно

**Примерна сметка:**
- 100 продукта × 3 снимки × 200KB = 60MB
- = 25GB ще стигнат за 400+ продукта със снимки!

### Миграция от Hardcoded Данни

```typescript
// scripts/migrate-to-supabase.ts
import { createClient } from '@supabase/supabase-js';
import { products } from '../frontend/data/db';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SERVICE_ROLE_KEY!);

async function migrate() {
  // Трансформирай hardcoded данните
  const transformedProducts = products.map(p => ({
    slug: p.id,
    name: p.name,
    brand: p.brand,
    // ... други полета
    price: p.price,
    created_at: new Date().toISOString(),
  }));

  // Batch insert по 50 записа
  const batchSize = 50;
  for (let i = 0; i < transformedProducts.length; i += batchSize) {
    const batch = transformedProducts.slice(i, i + batchSize);
    await supabase.from('products').insert(batch);
    console.log(`Inserted batch ${i/batchSize + 1}`);
  }
}
```

---

## ☁️ Google Cloud Deployment Strategy

### Опция 1: Cloud Run (Препоръчително)

**Защо Cloud Run:**
- ✅ Serverless - плащаш само за използвано време
- ✅ Автоматично мащабиране (0 → N instances)
- ✅ Docker container deployment
- ✅ Free tier: 2M requests/месец, 360K GB-seconds
- ✅ HTTPS по подразбиране
- ✅ Custom domain

**Архитектура:**
```
Cloud Run (Next.js App)
       ↕
Supabase (PostgreSQL + Auth)
       ↕
Cloud Storage (Images)
```

### Опция 2: Compute Engine (VM)

**Кога да избереш:**
- Постоянен трафик (не sporadic)
- Нужда от custom софтуер
- По-добра цена за висок трафик

**Спецификация:**
- e2-micro (1 vCPU, 1 GB) - $6.11/месец
- e2-small (2 vCPU, 2 GB) - $12.23/месец
- Debian/Ubuntu + Docker

### Опция 3: GKE (Kubernetes)

**Кога да избереш:**
- Микросървисна архитектура в бъдеще
- Auto-scaling с повече контрол
- Не препоръчвам за старт - overkill

---

## 🐳 Docker Setup

### Dockerfile (Next.js)

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### docker-compose.yml (за development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    restart: unless-stopped

  # Опционално: Redis за кеширане
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

### .dockerignore

```
node_modules
.next
.git
.env.local
.env.*.local
npm-debug.log
README.md
.docker
```

---

## 🚀 CI/CD Pipeline (GitHub → Google Cloud)

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
  workflow_dispatch:

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: smolyanklima-backend
  REGION: europe-west1

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Google Auth
        id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Docker Auth
        id: docker-auth
        run: |
          gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Build and Push Container
        run: |
          docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/smolyanklima/${{ env.SERVICE_NAME }}:${{ github.sha }} ./backend
          docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/smolyanklima/${{ env.SERVICE_NAME }}:${{ github.sha }}

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE_NAME }}
          region: ${{ env.REGION }}
          image: ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/smolyanklima/${{ env.SERVICE_NAME }}:${{ github.sha }}
          env_vars: |
            SUPABASE_URL=${{ secrets.SUPABASE_URL }}
            SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}
          flags: |
            --allow-unauthenticated
            --memory=1Gi
            --cpu=1
            --min-instances=0
            --max-instances=10
```

### Нужни Secrets (GitHub)

```
GCP_PROJECT_ID=your-project-id
WIF_PROVIDER=projects/.../locations/.../workloadIdentityPools/.../providers/...
WIF_SERVICE_ACCOUNT=github-actions@project.iam.gserviceaccount.com
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 💰 Cost Estimation (Google Cloud)

### Cloud Run (Recommended)

| Scenario | Requests/месец | Cost |
|----------|----------------|------|
| **Нов сайт** | < 2M | **$0** (Free tier) |
| **Растящ** | 5M | ~$5-10 |
| **Установен** | 20M | ~$30-50 |
| **Бизнес** | 100M | ~$150-200 |

### Cloud Storage (Images)

| Storage | Cost/месец |
|---------|------------|
| 5 GB | **$0** (Free tier) |
| 50 GB | $1.20 |
| 100 GB | $2.40 |
| Egress (трафик) | $0.12/GB |

### Cloudinary (Images) - Free Tier

| Storage | Cost/месец | Забележка |
|---------|------------|-----------|
| **25 GB** | **$0** (Free tier) | Достатъчно за 5000+ продукта |
| 25GB+ | $25/месец | Мигрирай когато стигнеш 400+ продукта |

### Supabase Free Tier

- База: **$0** (500 MB) - може да заспива, 3-5 сек събуждане
- Auth: **$0** (50K users)
- Storage: **$0** (1 GB) - не се ползва за снимки

### 📊 Общо месечно (РЕАЛНИ сценарии)

| Период | Cloud Run | Cloudinary | Supabase | **Общо** | Забележка |
|--------|-----------|------------|----------|----------|-----------|
| **Старт (0-6 м)** | $0 | $0 | $0 | **$0** | ✅ Всички free tiers са достатъчни |
| **Растеж (6-12 м)** | $0 | $0 | $0 | **$0** | ✅ Пак 100% безплатно |
| **Година 2+** | $0 | $0 | $0 | **$0** | ✅ Ако трафикът е под 2M/месец |
| **Бъдеще** | $0-10 | $0-25 | $0-25 | **$0-60** | Когато надхвърлиш free tiers |

**Реалност:** Можеш да работиш **1-2 години безплатно** с този stack!

---

## 📋 Обновен План за Имплементация (с Docker + GCP)

### Фаза 1: Infrastructure (Ден 1-2)
- [ ] Създаване на Supabase проект (Free tier) - база данни
- [ ] Регистрация в Cloudinary (Free tier) - снимки
- [ ] Създаване на Google Cloud проект
- [ ] Настройка на Artifact Registry (Docker images)
- [ ] Enable Cloud Run API
- [ ] Създаване на базата данни (SQL миграция в Supabase)

### Фаза 2: Local Development (Ден 3-4)
- [ ] Next.js 15 проект в `backend/` папка
- [ ] Docker + docker-compose setup
- [ ] Supabase client конфигурация
- [ ] Тестване с `docker-compose up`

### Фаза 3: API Development (Ден 5-7)
- [ ] Public API endpoints
- [ ] Admin API endpoints
- [ ] Authentication middleware
- [ ] Seed данни от hardcoded

### Фаза 4: Admin Panel (Ден 8-10)
- [ ] Login page
- [ ] Dashboard с графики
- [ ] Products CRUD
- [ ] Orders & Inquiries

### Фаза 5: CI/CD & Deploy (Ден 11-12)
- [ ] GitHub Actions workflow
- [ ] Настройка на secrets
- [ ] Първи deploy на Cloud Run
- [ ] Custom domain (admin.smolyanklima.bg)
- [ ] SSL certificate

### Фаза 6: Migration (Ден 13)
- [ ] Миграционен скрипт (db.ts → Supabase)
- [ ] Тестване на всички данни
- [ ] Switch frontend да ползва API вместо hardcoded
- [ ] Testing & Bug fixes

### Фаза 7: Production (Ден 14)
- [ ] Monitoring (Cloud Logging)
- [ ] Backups автоматизация
- [ ] Performance optimization
- [ ] Documentation

---

## 🔬 FRONTEND АНАЛИЗ – Всички Изисквания за Backend

### 📊 Данни от `db.ts` (Важно за Backend)

**Брой продукти:** ~100 хардкоднати продукта в 8 категории:

| Категория | Брой | Типове |
|-----------|------|--------|
| **Стенни климатици** | ~20 | Стенен климатик, Дизайнерски, Офис |
| **Мулти-сплит системи** | ~6 | 2x1, 3x1, 4x1 |
| **Касетни климатици** | ~6 | Касетен |
| **Подови климатици** | ~5 | Подов |
| **Канални климатици** | ~5 | Канален |
| **Портативни климатици** | ~6 | Портативен |
| **Аксесоари** | ~20 | Дистанционни, Монтажни, Консумативи |
| **Резервни части** | ~12 | Филтри, Компресори, Платки |

### 🏷️ Продуктови Полета (Всички трябва да са в DB)

```typescript
// Задължителни полета за всеки продукт:
interface Product {
  // ── Identity ───────────────────────
  id: string;                    // 'daikin-perfera' (URL-friendly)
  slug: string;                  // Уникален за URL
  name: string;                // 'Daikin Perfera'
  brand: string;               // 'Daikin'
  model: string;               // 'Perfera FTXM25R'
  type: string;                // 'Стенен климатик'
  category: string;            // 'Апартамент'
  
  // ── Tech Specs ──────────────────────
  area: string;                  // 'до 25 м²'
  energyCool: string;            // 'A+++', 'A++', 'A+', 'A'
  energyHeat: string;            // 'A+++', 'A++', 'A+', 'A'
  noise: string;                 // '< 19 dB', '23 dB'
  coolingPower: string;          // '2.5 kW', '9000 BTU'
  heatingPower: string;          // '3.2 kW'
  refrigerant: string;          // 'R-32', 'R-410A', 'R-290'
  wifi: boolean;                // true/false
  warranty: string;             // '2 г. (до 5 г. при регистрация)'
  
  // ── Description ────────────────────
  description: string;          // Дълго описание
  features: string[];           // ['Инвертор', 'WiFi управление', ...]
  
  // ── Pricing ────────────────────────
  price: number;                 // EUR, задължително
  priceWithMount: number;        // EUR (price + монтаж)
  costPrice?: number;           // Закупна цена (админ само)
  
  // ── Media ──────────────────────────
  images: string[];              // ['https://cdn.../img1.jpg']
  mainImage: string;             // Първична снимка
  
  // ── SEO ────────────────────────────
  metaTitle?: string;            // SEO title
  metaDescription?: string;     // SEO description
  
  // ── Status ─────────────────────────
  isActive: boolean;             // Видим ли е в каталога
  isFeatured: boolean;           // Показва ли се на главната
  stockStatus: string;           // 'in_stock' | 'out_of_stock' | 'pre_order'
  stockQuantity: number;         // Бройка наличност
  
  // ── Social Proof ───────────────────
  rating: number;                // 4.9 (calculated)
  reviewsCount: number;          // 47
  
  // ── UI Styling (Derived) ────────────
  badge?: {                      // Bestseller, Premium, etc.
    text: string;
    bg: string;                  // 'bg-yellow-100'
    textCol: string;             // 'text-yellow-700'
  };
  cardBorder: string;            // 'border-blue-200'
  imgBg: string;                 // 'bg-gray-50'
  
  // ── Timestamps ──────────────────────
  createdAt: Date;
  updatedAt: Date;
}
```

### 🎨 Марки (Brands)

**Налични марки в db.ts:**
- Daikin (японска)
- Mitsubishi Electric (японска)
- Mitsubishi Heavy (японска)
- Samsung (корейска)
- LG (корейска)
- Fujitsu (японска)
- Gree (китайска)
- Panasonic (японска)
- Hitachi (японска)
- Carrier (американска)
- Toshiba (японска)
- Electrolux (шведска)
- Kentatsu (японска)

**Структура:**
```typescript
interface Brand {
  id: string;           // 'daikin'
  name: string;         // 'Daikin'
  slug: string;         // 'daikin'
  description?: string;
  logoUrl?: string;     // 'https://.../daikin-logo.svg'
  color: string;        // '#00B4D8' (brand accent)
  website?: string;      // 'https://www.daikin.bg'
  sortOrder: number;     // За сортиране
  isActive: boolean;
}
```

### 📂 Категории (Categories)

**В frontend-а има 8 категории:**

| ID | Име | Икона | Типове продукти |
|----|-----|-------|-----------------|
| `all` | Всички | Grid | Всички |
| `stenni` | Стенни | Home | Стенен климатик, Дизайнерски, Офис |
| `multi-split` | Мулти-сплит | Layers | Мулти-сплит система |
| `kasetni` | Касетни | Building | Касетен климатик |
| `podovi` | Подови | Square | Подов климатик |
| `kanalni` | Канални | Wind | Канален климатик |
| `portativni` | Портативни | Fan | Портативен климатик |
| `aksesoari` | Аксесоари | Package | Аксесоари |
| `chasti` | Резервни части | Wrench | Резервни части |

### 🔍 Филтри във Frontend (FilterSidebar.tsx)

**Активни филтри:**
1. **Марка** - Checkbox списък с всички марки
2. **Ценови диапазон** - Dual-handle range slider (min/max)
3. **Енергиен клас** - 'A+++', 'A++', 'A+', 'A' (multi-select)
4. **Функции** - WiFi, Инвертор, Нощен режим, Самопочистване, nanoe™ (multi-select)
5. **Категория** - Category chips (хоризонтален скрол)

### 📊 Сортиране (Sort Options)

```typescript
type SortOption = 
  | 'recommended'      // По подразбиране (featured first)
  | 'price-asc'        // Ниска → Висока
  | 'price-desc'       // Висока → Ниска
  | 'energy-class'     // A+++ първи
  | 'noise-asc'        // Най-тихи първи
  | 'rating-desc';     // Най-висок рейтинг
```

### ❤️ Favorites System

**Реализация:** LocalStorage (сега) → Backend (бъдеще)

```typescript
// Сега: LocalStorage key 'sk_favorites'
// Бъдеще: Supabase table user_favorites
interface UserFavorite {
  userId: string;       // Supabase Auth user_id
  productId: string;
  createdAt: Date;
}
```

### 🔁 Compare System

**Функционалност:**
- До 3 продукта за сравнение
- Пази се в React state (сега)
- Може да се добави в localStorage или backend

**Сравнителна таблица показва:**
- Снимка, Марка, Модел
- Цена (с и без монтаж)
- Мощност охлаждане/отопление
- Енергиен клас
- Ниво на шум
- WiFi (✓/✗)
- Гаранция

### 👁️ Recently Viewed

```typescript
// Сега: localStorage 'sk_recently_viewed'
// Бъдеще: Supabase + cross-device
interface RecentlyViewed {
  userId?: string;      // Ако е логнат
  sessionId: string;    // Ако не е логнат
  productId: string;
  viewedAt: Date;
}
// Пази последните 10-15 продукта
```

### 🧙 Guided Buying Wizard

**3 въпроса:**
1. **Помещение:** Една стая / Няколко стаи / Търговско
2. **Площ:** До 25м² / 25-35м² / 35-50м² / Над 50м²
3. **Приоритет:** Ниска цена / Ефективност / Тишина / Smart

**Backend логика:**
- Филтриране по `category` и `area`
- Сортиране по `price`, `energyCool`, `features`
- Връща ТОП 3 препоръки

### 📞 Запитвания (Inquiries/Leads)

**Източници на запитвания:**
1. **QuickViewModal** - Форма с име, телефон
2. **ContactSection** - Обща форма за контакт
3. **GuidedBuyingWizard** - Запитване след резултати
4. **ProductDetailsPage** - "Направи запитване"

**Структура:**
```typescript
interface Inquiry {
  id: string;
  source: string;           // 'quick_view', 'contact_page', 'wizard'
  
  // Клиент
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  
  // Продукт (ако е свързано)
  productId?: string;
  productName?: string;
  
  // Детайли от Wizard (ако има)
  roomType?: string;        // 'wall', 'multi', 'commercial'
  roomSize?: string;        // 'small', 'medium', 'large'
  priority?: string;        // 'budget', 'efficiency', 'comfort'
  
  // Съобщение
  message?: string;
  
  // Статус
  status: 'new' | 'contacted' | 'quoted' | 'converted' | 'lost';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;      // admin_user_id
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  contactedAt?: Date;
  convertedAt?: Date;
}
```

### 📋 Отзиви (Reviews)

**Структура:**
```typescript
interface Review {
  id: string;
  productId: string;
  customerName: string;      // "Иван от Смолян"
  rating: number;            // 1-5
  title?: string;            // "Отличен климатик"
  text: string;              // "Много сме доволни..."
  
  // Верификация
  isVerified: boolean;       // Купил от нас?
  isApproved: boolean;       // Одобрен от админ?
  
  // Админ
  adminReply?: string;      // Отговор от админ
  adminReplyAt?: Date;
  
  createdAt: Date;
}
```

**Връзка с продукт:**
```sql
-- Продуктите имат calculated полета:
ALTER TABLE products ADD COLUMN rating DECIMAL(2,1) DEFAULT 0;
ALTER TABLE products ADD COLUMN reviews_count INTEGER DEFAULT 0;

-- Update при нова рецензия:
UPDATE products 
SET rating = (SELECT AVG(rating) FROM reviews WHERE product_id = $1 AND is_approved = true),
    reviews_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND is_approved = true)
WHERE id = $1;
```

### 📦 Поръчки (Orders)

```typescript
interface Order {
  id: string;
  orderNumber: string;       // 'ORD-2024-001'
  
  // Клиент
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  
  // Продукти
  items: OrderItem[];
  
  // Цени
  subtotal: number;          // Сума без монтаж
  installationTotal: number; // Сума за монтаж
  discountAmount: number;
  total: number;             // Крайна сума
  
  // Статуси
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'partial' | 'refunded';
  
  // Монтаж
  installationDate?: Date;
  installationTime?: string; // 'morning', 'afternoon'
  installationAddress?: string;
  installationNotes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;       // Snapshot
  productImage?: string;
  quantity: number;
  unitPrice: number;         // Цена без монтаж
  installationPrice: number; // Цена на монтаж
  totalPrice: number;
  includesInstallation: boolean;
}
```

### 📊 Admin Dashboard Stats

**Необходими за Dashboard:**

```typescript
interface DashboardStats {
  // KPI Cards
  totalRevenue: number;          // Общо приходи (месец)
  totalOrders: number;           // Брой поръчки (месец)
  totalInquiries: number;        // Нови запитвания
  conversionRate: number;        // % конверсия
  
  // Charts
  revenueByMonth: {              // За графика
    month: string;
    revenue: number;
    orders: number;
  }[];
  
  // Lists
  topProducts: {                 // Топ 5 продукта
    productId: string;
    name: string;
    sold: number;
    revenue: number;
  }[];
  
  recentOrders: Order[];         // Последните 5 поръчки
  
  inquiriesByStatus: {          // За pie chart
    status: string;
    count: number;
  }[];
}
```

### 🔐 Аутентикация (Auth)

**Роли в системата:**
```typescript
type UserRole = 
  | 'super_admin'    // Пълен достъп, настройки
  | 'admin'          // Всичко без критични настройки
  | 'editor'         // Продукти, статии, не поръчки
  | 'viewer'         // Само четене
  | 'installer';     // Вижда само монтажите си

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}
```

### 🖼️ Media Management

**Изображения:**
- Размери: Thumbnail (300x300), Medium (600x600), Full (1200x1200)
- Формати: WebP (основен), JPEG (fallback)
- Storage: Google Cloud Storage bucket
- CDN: Cloudflare или Cloud CDN

**Структура:**
```
gs://smolyanklima-media/
  ├── products/
  │   ├── daikin-perfera/
  │   │   ├── main.webp
  │   │   ├── main-thumb.webp
  │   │   ├── gallery-1.webp
  │   │   └── gallery-2.webp
  │   └── ...
  ├── brands/
  │   ├── daikin-logo.svg
  │   └── ...
  └── articles/
      └── ...
```

### 🔔 Notifications System

**Toast notifications ( frontend → backend ):**
- Добавено в любими
- Линк копиран
- Запитване изпратено
- Премахнато от любими

**Push notifications (бъдеще):**
- Нова поръчка (админ)
- Статус на поръчка променен (клиент)
- Нов отговор на запитване (клиент)

### 📱 URL Structure & Routing

**Публични URL-и:**
```
/                          → Главна страница (App.tsx)
/catalog                   → Каталог (CatalogPage.tsx)
/catalog?cat=multi-split   → Филтриран каталог
/product/:slug            → Детайлна страница (ProductDetailsPage.tsx)
/contact                   → Контакт (ContactPage.tsx)
/services                  → Услуги (ServicesPage.tsx)
```

**Admin URL-и:**
```
/admin                     → Dashboard
/admin/products            → Списък продукти
/admin/products/new        → Нов продукт
/admin/products/:id        → Редакция
/admin/orders              → Поръчки
/admin/inquiries           → Запитвания
/admin/customers           → Клиенти
/admin/settings            → Настройки
```

### ⚙️ Настройки на Системата (Settings)

```typescript
interface AppSettings {
  // Контакти
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  workingHours: string;
  
  // Цени
  installationBasePrice: number;    // Базова цена монтаж
  installationPerMeter: number;     // На метър тръба
  
  // SEO
  siteTitle: string;
  siteDescription: string;
  
  // Features
  enableReviews: boolean;
  enableComparisons: boolean;
  enableWizard: boolean;
  maintenanceMode: boolean;
}
```

---

## ✅ ФИНАЛНА ПРЕПОРЪКА (100% Безплатен Stack)

### 🎯 Избран Архитектура:

| Компонент | Технология | Цена | Забележка |
|-----------|------------|------|-----------|
| **Backend** | Next.js 15 + Cloud Run | **$0** | 2M requests/месец free |
| **Database** | Supabase PostgreSQL | **$0** | 500MB, може да заспива (ОК) |
| **Images** | Cloudinary | **$0** | 25GB + CDN + оптимизация |
| **Auth** | Supabase Auth | **$0** | 50K users |
| **Deploy** | GitHub Actions + Cloud Run | **$0** | Автоматичен CI/CD |
| **Docker** | Multi-stage build | **$0** | Production-ready |

### 💰 Реална Цена:
- **Месец 1-12:** $0 (100% безплатно)
- **Година 2:** $0 (ако трафикът е под лимитите)
- **Бъдеще:** $0-60/месец (когато надхвърлиш free tiers)

### 🚀 Предимства:
1. **$0 за 1-2 години** - безплатни лимити са щедри
2. **Supabase може да заспива** - приемливо (3-5 сек събуждане)
3. **Cloudinary за снимки** - оптимизация, CDN, 25GB free
4. **Docker** - консистентност dev/prod
5. **Auto-deploy** - push към main → автоматичен deploy

### ⚠️ Приети Компромиси:
- Supabase "заспива" след 7 дни неактивност → 3-5 сек при първи visit (OK)
- 500MB база → достатъчно за 10+ години (само текстови данни)
- Без connection pooling → ще добавим при нужда

---

*Планът е финализиран и готов за имплементация!* 🚀

## 📋 Първи Стъпки (Ако си готов):
1. Създай Supabase проект (free tier)
2. Регистрирай се в Cloudinary (free tier)
3. Създай Google Cloud проект
4. Започваме с Next.js 15 + Docker setup

**Готов ли си да започнем?**
