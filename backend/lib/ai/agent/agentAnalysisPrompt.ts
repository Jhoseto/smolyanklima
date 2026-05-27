import { isRawListRequest, requiresToolData, isAdminGuideQuestion } from "@/lib/ai/agent/agentAutoTools";

/** Всяка заявка за данни от системата (освен изричен списък) изисква аналитичен отговор. */
export function needsAnalyticalResponse(message: string): boolean {
  return requiresToolData(message) && !isRawListRequest(message);
}

/** @deprecated alias */
export function isBusinessAnalysisQuestion(message: string): boolean {
  return needsAnalyticalResponse(message);
}

const UNIVERSAL_ANTI_PATTERNS = `
ЗАБРАНЕНО при ВСЯКА заявка за данни (продажби, склад, клиенти, доставчици, протоколи, активност и т.н.):
- Copy-paste на admin списъци без интерпретация — потребителят вече ги вижда в /admin/*
- Само числа/таблица без „значи…“, „риск…“, „препоръчвам…“
- Измислени имена, дати, продукти, клиенти или събития
- Технически кодове (service_protocol.update, in_progress, work_items)
- Графика без бизнес смисъл (напр. admin кликове вместо продажби/запитвания/наличност)
`.trim();

const UNIVERSAL_ANALYSIS_STRUCTURE = `
СТРУКТУРА (задължителна за всеки аналитичен отговор):
1. markdown "### Резюме" — 2–3 изречения: директен отговор на въпроса + главен извод
2. markdown "### Анализ" — интерпретация на данните в контекста на въпроса (не списък)
3. kpi × 2–4 — ключови числа от tool results с кратък hint (какво означават)
4. chart (ЗАДЪЛЖИТЕЛНО при сравнение/тренд/разпределение) — bar за сравнения, line/area за трендове, pie за дялове; данни от chartSuggestion/summary в tools
5. markdown "### Аномалии и рискове" — ако има несъответствия, пропуски, повтарящи се проблеми; иначе „Няма критични аномалии“
6. markdown "### Препоръки" — 2–4 конкретни стъпки + link blocks към /admin/...
7. table (optional, max 5–8 реда) — само ако добавя стойност: „Наблюдение | Значение | Действие", НЕ raw dump
`.trim();

const RAW_LIST_STRUCTURE = `
СТРУКТУРА (заявка за списък/преглед):
1. markdown "### Резюме" — колко резултата, какво показват накратко
2. table — max 20 реда от tool results, български колони
3. markdown "### Бележка" — 1–2 изречения какво да се направи с информацията
`.trim();

export function buildFinalAnalysisPrompt(userMessage: string): string {
  const analytical = needsAnalyticalResponse(userMessage);

  return [
    'Отговори САМО с JSON {"blocks":[...]}. Без ``` fences.',
    "Роля: старши бизнес аналитик на „Смолян Клима“.",
    analytical
      ? "Синтез и препоръки — не copy-paste от admin панела."
      : "Точен списък от tools + кратък контекст.",
    analytical ? UNIVERSAL_ANALYSIS_STRUCTURE : RAW_LIST_STRUCTURE,
    UNIVERSAL_ANTI_PATTERNS,
    "Данни САМО от tool results по-горе. Липсват → кажи какво не можеш да заключиш.",
    "columns — plain strings на български. Числа в table.rows като string.",
    `Въпрос: «${userMessage.slice(0, 400)}»`,
  ].join("\n\n");
}

export function buildPlainJsonFallbackPrompt(): string {
  return [
    "Финален опит: върни САМО валиден JSON {\"blocks\":[...]} на български.",
    "Минимум 3 markdown блока: ### Резюме, ### Анализ, ### Препоръки.",
    "По възможност добави kpi и chart от summary/chartSuggestion в данните.",
    "Без измислени имена или дати. Без технически кодове.",
  ].join("\n");
}

const ADMIN_GUIDE_STRUCTURE = `
СТРУКТУРА (обучителен материал / помощ за admin панела):
1. markdown "### Резюме" — за кого е материалът и какво покрива
2. markdown "### Навигация" — таблица: Раздел | Път (/admin/...) | Кога се ползва
3. markdown "### Основни процеси" — numbered flows (запитване→продажба→монтаж, сервиз, доставчик…)
4. markdown "### Стъпка по стъпка" — конкретни кликове/екрани за задачата на потребителя
5. table (optional) — Чеклист Ден 1 / Седмица 1 за нов служител
6. link blocks — директни линкове към /admin/... секции
7. chart (optional) — само ако потребителят иска визуализация на процес (pie/bar на етапи)

ЗАБРАНЕНО: да казваш че „нямаш достъп до UI" или „не можеш да генерираш обучение". Знаеш admin панела от ADMIN_PANEL_GUIDE.
`.trim();

export function isAdminGuideResponse(message: string): boolean {
  return isAdminGuideQuestion(message);
}

export function buildAdminGuidePrompt(userMessage: string): string {
  return [
    'Отговори САМО с JSON {"blocks":[...]}. Без ``` fences.',
    "Роля: старши обучител и вътрешен експерт по admin панела на „Смолян Клима“.",
    "Използвай ADMIN_PANEL_GUIDE от system instruction — точни пътища, менюта, flows.",
    ADMIN_GUIDE_STRUCTURE,
    "markdown: {type, content}. link: {type, label, href}. columns на български.",
    `Заявка: «${userMessage.slice(0, 500)}»`,
  ].join("\n\n");
}
