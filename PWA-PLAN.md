# PWA план — SmolyanKlima Admin Panel

## Цел
Административният панел (`/admin`) да може да се инсталира на телефон като нативно приложение —
с икона на началния екран, splash екран с анимация и работа без адресна лента.

---

## Архитектура

```
backend/
├── public/
│   ├── manifest.webmanifest        ← PWA манифест (нов файл)
│   ├── icon-192.png                ← икона 192×192 px (нов файл)
│   ├── icon-512.png                ← икона 512×512 px (нов файл)
│   ├── icon-maskable-512.png       ← maskable икона за Android (нов файл)
│   └── apple-touch-icon.png        ← iOS икона 180×180 px (нов файл)
│
├── app/
│   ├── layout.tsx                  ← ПРОМЯНА: PWA мета тагове + manifest link
│   ├── admin/
│   │   ├── layout.tsx              ← ПРОМЯНА: добавя SplashScreen компонент
│   │   └── SplashScreen.tsx        ← НОВ файл: анимация при стартиране
```

---

## Стъпка 1 — Иконата (SVG → PNG)

Иконата е **само SVG елементът** от `Logo.tsx` (без текста "СМОЛЯНКЛИМА"):

```
- Горна дъга: оранжев градиент  #FF4D00 → #FF6A00 → #FF2A4D
- Долна дъга: син градиент      #00B4D8 → #0077B6
- Горна полуточка: оранжева
- Долна полуточка: синя
- Малък кръг горе вляво: оранжев контур (символ за градус °)
- Фон: бял квадрат с леко заоблени ъгли
```

Нужни размери:
| Файл                   | Размер   | Употреба                         |
|------------------------|----------|----------------------------------|
| `icon-192.png`         | 192×192  | Android home screen              |
| `icon-512.png`         | 512×512  | Android splash / install dialog  |
| `icon-maskable-512.png`| 512×512  | Android adaptive icon (safe zone)|
| `apple-touch-icon.png` | 180×180  | iOS home screen                  |

> **Генериране:** Ще се запишат като SVG файлове в `public/` и браузърите ще ги ползват директно.
> За PNG версии се ползва `sharp` пакет при build, или онлайн конвертор (напр. squoosh.app).

---

## Стъпка 2 — manifest.webmanifest

```json
{
  "name": "SmolyanKlima Admin",
  "short_name": "SK Admin",
  "description": "Административен панел — продукти, запитвания, контакти, календар",
  "start_url": "/admin",
  "scope": "/admin",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#0ea5e9",
  "lang": "bg",
  "icons": [
    { "src": "/icon-192.png",         "sizes": "192x192",  "type": "image/png" },
    { "src": "/icon-512.png",         "sizes": "512x512",  "type": "image/png" },
    { "src": "/icon-maskable-512.png","sizes": "512x512",  "type": "image/png", "purpose": "maskable" },
    { "src": "/icon.svg",             "sizes": "any",      "type": "image/svg+xml" }
  ],
  "screenshots": [],
  "categories": ["business", "productivity"]
}
```

Ключови полета:
- `"display": "standalone"` → без адресна лента (изглежда като native app)
- `"start_url": "/admin"` → отваря директно admin панела
- `"scope": "/admin"` → само admin страниците са "в приложението"
- `"theme_color": "#0ea5e9"` → цветът на status bar-а на Android (sky-500)
- `"background_color": "#ffffff"` → фон на splash screen докато зарежда

---

## Стъпка 3 — Мета тагове в layout.tsx

```tsx
// backend/app/layout.tsx
export const metadata: Metadata = {
  title: "SmolyanKlima Admin",
  description: "Административен панел",
  manifest: "/manifest.webmanifest",
  // iOS специфични тагове
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SK Admin",
  },
  // theme color за мобилните браузъри
  themeColor: "#0ea5e9",
  // viewport
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1, // предотвратява zoom в полета — по-native усещане
  },
};
```

Допълнителни `<head>` тагове (iOS специфични):
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

---

## Стъпка 4 — SplashScreen анимация

Компонент `SplashScreen.tsx` — показва се само при стартиране от home screen.

### Логика
1. При mount проверява дали е стартиран от PWA (`window.matchMedia('(display-mode: standalone)')`)
2. Ако е standalone (= инсталиран), показва splash за ~1.8 секунди
3. Ако е нормален браузър — не показва нищо
4. Записва в `sessionStorage` дали е вече показан в тази сесия

### Дизайн на анимацията (3 фази)

```
Фаза 1 (0ms → 600ms):   Иконата SVG се "нарисува" — stroke-dashoffset анимация
                          Двете дъги се появяват от началото с draw ефект

Фаза 2 (600ms → 1100ms): Иконата се мащабира от 0.7 до 1.0 с spring-like easing
                          Мека "пулсация" на цветовете

Фаза 3 (1100ms → 1800ms): Текстът "СМОЛЯН·КЛИМА" се появява с fade+slide
                           Целият splash избледнява (opacity 1 → 0)
                           Admin панелът се разкрива отдолу
```

### CSS анимации
```css
/* Draw ефект за SVG path-овете */
@keyframes draw {
  from { stroke-dashoffset: 300; }
  to   { stroke-dashoffset: 0; }
}

/* Пулсация на иконата */
@keyframes pulse-scale {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.08); }
}

/* Fade out на целия splash */
@keyframes fade-out {
  from { opacity: 1; }
  to   { opacity: 0; pointer-events: none; }
}
```

### Визия
```
┌─────────────────────────────┐
│                             │
│                             │
│           [  C  ]           │  ← SVG икона, 80×80px, центрирана
│                             │
│       СМОЛЯН КЛИМА          │  ← текст с градиент, fade in
│   Административен панел     │  ← подзаглавие, по-малко, slate-500
│                             │
└─────────────────────────────┘

Фон: бял (#ffffff)
Иконата: рисува се с draw ефект
Текстът: slide up + fade in
```

---

## Стъпка 5 — admin/layout.tsx промяна

```tsx
import { SplashScreen } from "./SplashScreen";

export default function AdminLayout({ children }) {
  return (
    <>
      <SplashScreen />   {/* ← само на мобилен standalone режим */}
      <div className="h-screen ...">
        {/* ... съществуващия layout ... */}
      </div>
    </>
  );
}
```

---

## Стъпка 6 — iOS специфики

iOS Safari има ограничения при PWA. Задължителни допълнения:

```html
<!-- Скрива Safari UI елементите при standalone режим -->
<meta name="apple-mobile-web-app-capable" content="yes">

<!-- Цвят на status bar: "default" (бял), "black" (черен), "black-translucent" -->
<meta name="apple-mobile-web-app-status-bar-style" content="default">

<!-- Заглавие на приложението на iOS -->
<meta name="apple-mobile-web-app-title" content="SK Admin">

<!-- Splash screens за различни iPhone размери -->
<link rel="apple-touch-startup-image" href="/splash-1290x2796.png" media="...">
```

> **Забележка:** iOS splash screens изискват отделни PNG файлове за всеки размер iPhone.
> Опростен вариант: само `apple-touch-icon.png` без индивидуалните splash файлове.
> На iOS splash е само статичен — анимацията се прилага след него в приложението.

---

## Стъпка 7 — Проверка и тестване

След имплементация, проверява се с:

1. **Chrome DevTools → Application → Manifest** — вижда се цялата PWA конфигурация
2. **Lighthouse → PWA audit** — дава оценка и показва проблеми
3. **На Android устройство** — Chrome → менюто → "Инсталирай приложение"
4. **На iPhone** — Safari → Сподели (□↑) → "Добави към началния екран"

---

## Обобщение на файловете

| Файл | Действие | Описание |
|------|----------|----------|
| `backend/public/manifest.webmanifest` | СЪЗДАВАНЕ | PWA манифест |
| `backend/public/icon.svg` | СЪЗДАВАНЕ | SVG икона (всички размери) |
| `backend/public/icon-192.png` | СЪЗДАВАНЕ | PNG 192×192 |
| `backend/public/icon-512.png` | СЪЗДАВАНЕ | PNG 512×512 |
| `backend/public/apple-touch-icon.png` | СЪЗДАВАНЕ | PNG 180×180 iOS |
| `backend/app/layout.tsx` | ПРОМЯНА | PWA metadata + мета тагове |
| `backend/app/admin/SplashScreen.tsx` | СЪЗДАВАНЕ | Анимиран splash компонент |
| `backend/app/admin/layout.tsx` | ПРОМЯНА | Добавя SplashScreen |

**Общо: ~6 нови файла, 2 промени в съществуващи файлове.**

---

## Времева оценка на имплементация

| Стъпка | Работа |
|--------|--------|
| SVG икона + PNG генериране | ~20 мин |
| manifest.webmanifest | ~5 мин |
| layout.tsx мета тагове | ~10 мин |
| SplashScreen анимация | ~30 мин |
| Тестване | ~15 мин |
| **Общо** | **~80 мин** |
