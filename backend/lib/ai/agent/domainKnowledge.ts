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

АВТОПАРК (/admin/fleet):
- Следим: винетка, гражданска отговорност, технически преглед, каско (опционално).
- Alert нива: expired (изтекло) / critical (≤7 дни) / warning (≤30 дни) / ok / missing (липсва запис).
- Поддръжка (сервиз, масло, гуми…) vs ремонт (parts_cost + labor_cost + cost_eur).
- KPI: % МПС с критични срокове, разходи YTD (compliance + maintenance + repair + misc) — tools: aggregate_fleet_costs, get_fleet_summary.
- tools: get_fleet_summary, query_fleet_vehicles, query_fleet_compliance_alerts, aggregate_fleet_costs.

КОНТЕЙНЕРИ (/admin/containers):
- Доставки втора употреба от Япония; auto naming „Контейнер 2026" или „Контейнер 2026-2".
- Разходи: japan_price + customs_duty + vat_amount + transport_to_bulgaria + transport_to_smolyan.
- products.container_id → групиране на климатици по пратка/контейнер.
- KPI: брой климатици на контейнер, средна цена на бройка, най-скъп контейнер.
- tools: query_containers, get_container_detail, aggregate_container_costs.

ADMIN UI: пълен guide в ADMIN PANEL GUIDE — менюта, екрани, flows, обучение.
`.trim();
