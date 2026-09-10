/**
 * Authoritative admin panel UI + workflow knowledge for the AI agent.
 * Source of truth: AdminSidebarNav, MobileNav, domain workflows.
 */
export const ADMIN_PANEL_GUIDE = `
=== АДМИН ПАНЕЛ — НАВИГАЦИЯ И РОЛИ ===

URL база: /admin (backend Next.js app, порт 3001 в dev).

РОЛИ:
- master_admin — пълен достъп + Настройки + AI Agent (с история) + Персонал
- office_staff — Офис (контакт, запитвания, продукти, продажби, поръчки, статии, AI Agent без история) + Отчети + Персонал (без Настройки)
- service_staff — Табло + Сервиз → Документи (без каталог продукти)

СТРУКТУРА НА МЕНЮТО:
| Секция | Път | Какво прави |
| Табло | /admin | KPI карти: продукти, нови запитвания, работа днес/просрочена, outbox |
| Офис → Контакти | /admin/contacts | CRM: клиенти, доставчици, фирми; филтър по вид контакт |
| Офис → Чат | /admin/chat | Live chat с посетители на сайта; badge при нови |
| Офис → Запитвания | /admin/inquiries | Leads от сайт/телефон; status: new → in_progress → done/cancelled |
| Офис → Продукти | /admin/products | Склад: един ред = един физически климатик (serial); продажба, резервиране |
| Офис → Продажби | /admin/history | История на завършени продажби; детайл с продукти и протоколи |
| Офис → Поръчки | /admin/supplier-orders | Поръчки към доставчици (work_items event_code=supplier_order) |
| Офис → Статии | /admin/articles | Блог статии за сайта |
| Офис → Автопарк | /admin/fleet | МПС, срокове (винетка, гражданска отговорност, преглед, каско), поддръжка и ремонти |
| Офис → Контейнери | /admin/containers | Доставки климатици втора употреба от Япония; разходи и продукти по пратка |
| Сервиз → Документи | /admin/service/documents | Приемо-предавателни и сервизни протоколи |
| Отчети → Оценки | /admin/ratings | Рейтинги на продукти от клиенти |
| Отчети → Активност | /admin/activity | Одит лог — кой какво е правил в admin |
| Админ → Персонал | /admin/staff | Admin потребители и роли |
| Админ → За приложението | /admin/about | Changelog от GitHub main (Jhoseto/smolyanklima) — автоматично зареждане, бутон „Обнови“ за нови commit-и, AI описание на български |
| Админ → Настройки | /admin/settings | Системни настройки, sync на каталози (Bulclima, Climacom…) |
| Офис → AI Agent | /admin/ai-agent | AI чат за офис (без история на разговори) |
| Админ → AI Agent | /admin/ai-agent | AI чат с история, търсене, шаблони, scheduled reports (master_admin) |
| Профил | /admin/profile | Аватар, име на текущия admin |

=== FLOW 1: ЗАПИТВАНЕ → ПРОДАЖБА → МОНТАЖ ===

1. Клиент пише/звъни → запис в /admin/inquiries (status: new)
2. Офис отваря запитването → in_progress → обаждане, оферта
3. Клиент купува → от /admin/products намира свободен продукт (stock_status=available)
4. Бутон „Продажба" на продукта → форма: клиент, цена, дали включва монтаж, дата/час монтаж
5. Системата създава work_item event_code=sale + при монтаж → service_installation в календара
6. sale_install_state: pending_mount (чака монтаж) или completed (само продажба без монтаж)
7. След монтаж → service staff маркира монтажа done; при нужда → протокол в /admin/service/documents/acceptance
8. Продажбата се вижда в /admin/history

=== FLOW 2: СКЛАД / ПРОДУКТ ===

- /admin/products — списък с филтри: наличност, марка, търсене по име/serial
- /admin/products/new — ръчно добавяне
- /admin/products/[id] — детайл: цена, serial, доставчик, source_url, продажба, история
- stock_status: available | reserved | sold | …
- Синхрон от доставчици: Настройки → Bulclima/Climacom/Condex/Bittel sync

=== FLOW 3: СЕРВИЗ ===

- /admin/service/documents — hub
- /admin/service/documents/acceptance — приемо-предавателни протоколи (монтаж/доставка)
- /admin/service/documents/service — сервизни протоколи (ремонт на място/в сервиз)
- /admin/service/tasks — задачи сервизен екип
- work_items: service_installation, service_maintenance, service_on_site, service_in_shop

=== FLOW 4: ДОСТАВЧИЦИ ===

- /admin/contacts → филтър contact_kind=supplier
- Продукти могат да имат supplier_id и source_url към сайта на доставчика
- /admin/supplier-orders — поръчки; при доставка → продажба/монтаж flow

=== FLOW 5: КАЛЕНДАР / РАБОТА ===

- Таблото (/admin) показва work_items за днес и просрочени
- work_items = централна таблица: продажби, монтажи, сервиз, консултации, поръчки
- event_code определя типа; due_date + status (planned/in_progress/done/cancelled)

=== FLOW 7: АВТОПАРК ===

1. /admin/fleet — списък МПС с цветни индикатори за срокове (винетка, гражданска отговорност, преглед, каско)
2. **Добави МПС** — бутон „Ново МПС": рег. номер, марка, модел, пробег, отговорен служител
3. Кликни ред → **drawer** с детайли, compliance history, поддръжки/ремонти
4. **Поднови срок** — бутон при изтичащ/изтекъл вид (винетка, гражданска отговорност, преглед, каско): дата, доставчик, цена
5. **Поддръжка/ремонт** — форма: вид (сервиз, масло, гуми, ремонт…), дата, пробег, цена; при ремонт → части + труд
6. **Alert bar** отгоре — брояч критични/скоро изтичащи срокове
7. **Изтриване** на МПС — само master_admin

=== FLOW 8: КОНТЕЙНЕРИ ===

1. /admin/containers — списък контейнери по година с брой климатици и общи разходи
2. **Създай контейнер** — година → auto име „Контейнер YYYY" или „Контейнер YYYY-N"
3. **Редакция** — разходи: цена Япония, мито, ДДС, транспорт до България/Смолян, дати, доставчик
4. **Преглед продукти** — клик → детайл с климатици в контейнера (serial, наличност)
5. products.container_id свързва климатик с контейнер при добавяне/редакция на продукт
6. **Изтриване** — блокирано ако има продукти в контейнера; първо премести/премахни обвързването

=== FLOW 6: СЪДЪРЖАНИЕ И КОМУНИКАЦИЯ ===

- /admin/articles — блог
- /admin/chat — live chat widget от публичния сайт
- /admin/inquiries — формуляри и leads
- Email outbox — грешки/ pending виж на таблото

=== ЕКРАН: /admin/products — ПРОДАЖБА ===

1. Отвори /admin/products → филтрирай „Налични" или търси по модел/serial
2. На реда на продукта → бутон **Продажба** (само ако stock_status позволява)
3. Модал „Продажба":
   - Избери съществуващ контакт ИЛИ въведи нов (име, телефон, адрес, email)
   - **Договорена цена** — може отстъпка в %
   - **Включи монтаж** — checkbox; ако е маркиран → дата и часови диапазон за монтаж
   - Без монтаж → продажбата се маркира completed в /admin/history веднага
4. С **монтаж** → sale_install_state=pending_mount + work_item service_installation в календара
5. При on_order продукт → бутон „Поръчване" вместо „Продажба"

=== ЕКРАН: /admin/inquiries — ЗАПИТВАНИЯ ===

Статуси: new (Ново) → in_progress (В работа) → done (Приключено) | spam
1. /admin/inquiries — списък с филтри: status, source, търсене
2. Кликни ред → детайл: данни клиент, съобщение, бележки на admin
3. Смени status: new → in_progress при поемане; done след приключване
4. Badge в менюто показва броя нови запитвания
5. Свързване с продажба: намери/създай контакт в /admin/contacts → продажба от /admin/products

=== ЕКРАН: /admin/history — ПРОДАЖБИ ===

- Списък завършени продажби с филтри по период
- Клик → детайл модал: продукти, клиент, сума, монтаж, протоколи
- Линк към продукт /admin/products/[id] и протокол /admin/service/documents/acceptance

=== ЕКРАН: /admin/service/documents ===

- **Приемо-предавателни** (/acceptance) — протокол при монтаж/доставка; подписи, серийни номера
- **Сервизни** (/service) — ремонт на място или в сервиз
- **Задачи** (/tasks) — task list за сервизен екип
- Свързани с work_items и products

=== ЕКРАН: /admin/contacts — CRM ===

- Филтър contact_kind: client | supplier | company
- Търсене по име, телефон, email
- Доставчици (supplier) → сайт в бележки; продукти с supplier_id
- При продажба — избор на контакт от autocomplete

=== ЕКРАН: /admin/settings — СИНХРОН КАТАЛОЗИ ===

- Bulclima, Climacom, Condex, Bittel sync status
- След sync → нови продукти в /admin/products
- AI Agent може да провери get_supplier_sync_status tool

=== ЕКРАН: /admin/ai-agent ===

- office_staff: чат с AI — анализи, KPI, графики, обучение; без sidebar история, търсене, шаблони, scheduled reports
- master_admin: същото + история на разговори, търсене, шаблони, scheduled reports, експорт

=== ОБУЧЕНИЕ НА НОВ ОФИС СЛУЖИТЕЛ — ДЕН 1 / СЕДМИЦА 1 ===

Ден 1:
1. Вход /admin → разгледай Таблото (KPI)
2. /admin/inquiries — как се обработва ново запитване (open → in_progress → done)
3. /admin/contacts — търсене на клиент по телефон/име
4. /admin/products — търсене на наличен климатик
5. /admin/fleet — провери автопарк срокове (alert bar, критични МПС)
6. /admin/containers — провери контейнер за текущата година (брой климатици, разходи)

Седмица 1:
7. Пълен flow продажба с монтаж (products → продажба → проверка в history)
8. /admin/supplier-orders — как се следи поръчка
9. /admin/chat — отговор на live chat
10. /admin/activity — как се проверява какво е правено в системата

=== КАК ДА ОТГОВАРЯШ НА ВЪПРОСИ ЗА ИНТЕРФЕЙСА ===

- Знаеш ТОЧНО менютата, пътищата и стъпките от този guide — НЕ отказвай с „нямам достъп до UI"
- Давай numbered steps с точни пътища (/admin/...)
- За обучителен материал: секции по роля, таблица „Задача | Къде | Стъпки", link blocks
- Mermaid/ASCII flow diagrams в markdown са OK за процеси
- Illustrations: опиши какво вижда на екрана (бутони, табове) — няма screenshot tool
- Комбинирай guide + tools самo ако потребителят иска и live данни (напр. „как да продам + колко налични имаме")
`.trim();

export function compactAdminPanelGuideForPrompt(): string {
  return ADMIN_PANEL_GUIDE;
}
