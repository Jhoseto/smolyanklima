export const DOMAIN_KNOWLEDGE = `
БИЗНЕС КОНТЕКСТ — Смолян Клима:
- Регион: Смолян, Родопи; планински климат → сезонност (пик пролет/лято).
- Телефон: 0878 58 16 16.
- Продукт = отделен ред в products (serial per unit). Продажба без монтаж → saleInstallState=completed.

WORK_ITEMS (централна таблица):
- event_code=sale → продажба; sale_install_state: pending_mount | completed.
- service_installation → монтаж; service_maintenance → профилактика; service_on_site / service_in_shop → сервиз.
- consultation → консултация; supplier_order → поръчка към доставчик; item_added/item_removed → склад.

ДОСТАВЧИЦИ:
- CRM: contacts.contact_kind=supplier (Контакти → Доставчици). Сайтове в бележки.
- Каталози с sync: Bulclima (bulclima.com), Climacom (climacom.com), Condex (condex.bg), Bittel (bittel.bg).
- products.supplier_id → contacts.id; products.source_url → страница при доставчик.

INQUIRIES: status new|in_progress|done|cancelled|spam; source website|phone|etc.

KPI Примери: conversion inquiry→sale, install backlog, overdue work ratio, stock by brand.

ADMIN UI: пълен guide в ADMIN PANEL GUIDE — менюта, екрани, flows, обучение.
`.trim();
