/** Compact schema catalog — всички public таблици (metadata only, no rows). */
export const DOMAIN_SCHEMA_CATALOG = {
  hub: "work_items е централната оперативна таблица (продажби, монтаж, сервиз, поръчки).",
  tables: {
    products: {
      purpose: "Отделни бройки климатици в склад/продадени",
      keys: ["id", "name", "slug", "brand_id", "type_id", "supplier_id", "price", "stock_status", "stock_location", "indoor_unit_serial", "outdoor_unit_serial", "source_url", "product_condition", "public_catalog"],
      links: { brand_id: "brands", supplier_id: "contacts", type_id: "product_types" },
      admin: "/admin/products/{id}",
    },
    product_specs: { purpose: "BTU, kW, SEER, размери", keys: ["product_id", "btu", "cooling_power_kw", "coverage_m2"] },
    work_items: {
      purpose: "Календар, продажби, сервиз, поръчки",
      keys: ["event_code", "type", "status", "due_date", "customer_name", "total_amount", "sale_install_state", "product_id", "contact_id"],
      event_codes: {
        sale: "Продажба",
        service_installation: "Монтаж",
        service_maintenance: "Профилактика",
        service_on_site: "Сервиз на терен",
        service_in_shop: "Сервиз в склад",
        consultation: "Консултация",
        supplier_order: "Поръчка от доставчик",
        item_added: "Добавяне на продукт",
        item_removed: "Премахване на продукт",
      },
      admin: "/admin",
    },
    inquiries: { purpose: "Запитвания от сайт/телефон", keys: ["status", "customer_name", "customer_phone", "service_type", "product_id"], admin: "/admin/inquiries/{id}" },
    contacts: { purpose: "CRM клиенти и доставчици", keys: ["contact_kind", "full_name", "phone", "email", "notes", "customer_status"], kinds: { client: "Клиент", supplier: "Доставчик" }, admin: "/admin/contacts?kind=supplier" },
    accessories: { purpose: "Аксесоари и резервни части", keys: ["name", "price", "supplier_id", "is_active"] },
    brands: { purpose: "Марки климатици", keys: ["name", "slug"] },
    product_types: { purpose: "Типове (стенен, мултисплит...)", keys: ["name"] },
    activity_logs: { purpose: "Audit trail", keys: ["action", "entity_type", "user_id", "created_at"], admin: "/admin/activity" },
    product_ratings: { purpose: "Рейтинги от клиенти", keys: ["product_id", "stars", "created_at"], admin: "/admin/ratings" },
    service_protocols: { purpose: "Приемо-предавателни протоколи", keys: ["status", "client_name"] },
    service_repair_protocols: { purpose: "Сервизни протоколи", keys: ["status"] },
    live_chats: { purpose: "Live чат с посетители", keys: ["status", "visitor_name"], admin: "/admin/chat" },
    email_outbox: { purpose: "Изходящи имейли", keys: ["status", "to_email", "subject"] },
    articles: { purpose: "Блог статии", keys: ["title", "slug", "is_published"], admin: "/admin/articles/{id}" },
    newsletter_subscribers: { purpose: "Бюлетин абонати", keys: ["email", "status", "confirmed_at"] },
    settings: { purpose: "Key-value системни настройки", keys: ["key", "value"] },
    product_catalog_settings: { purpose: "Singleton catalog UI + supplier sync timestamps", keys: ["bulclima_last_sync_at", "climacom_last_sync_at"] },
    admin_users: { purpose: "Персонал", keys: ["role", "name", "email"] },
    admin_agent_conversations: { purpose: "AI Agent чатове (master_admin)", keys: ["title", "admin_user_id", "deleted_at"], admin: "/admin/ai-agent" },
    admin_agent_messages: { purpose: "Съобщения в AI Agent чат", keys: ["role", "content", "conversation_id"] },
    admin_agent_query_templates: { purpose: "Запазени AI заявки (шаблони)", keys: ["title", "prompt", "admin_user_id"] },
    admin_agent_scheduled_reports: { purpose: "Планирани AI отчети", keys: ["frequency", "prompt", "next_run_at", "enabled"] },
  },
} as const;

export function domainSchemaJson(): string {
  return JSON.stringify(DOMAIN_SCHEMA_CATALOG);
}
