type ActivityLogRow = {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = {
  "work_item.create": "Нова работна задача",
  "work_item.update": "Промяна на работна задача",
  "work_item.delete": "Изтриване на работна задача",
  "product.create": "Нов продукт",
  "product.update": "Промяна на продукт",
  "product.price.update": "Промяна на цена на продукт",
  "product.delete": "Изтриване на продукт",
  "product.bulk.delete": "Масово изтриване на продукти",
  "product.bulk.show_public": "Масово показване в публичен каталог",
  "product.bulk.hide_public": "Масово скриване от публичен каталог",
  "product.restore_visibility_all": "Възстановяване на видимост на всички продукти",
  "product.featured.set": "Добавяне в топ продукти",
  "product.featured.remove": "Премахване от топ продукти",
  "product_catalog.settings_update": "Промяна на настройки на каталога",
  "contact.create": "Нов контакт",
  "contact.update": "Промяна на контакт",
  "contact.merge": "Обединяване на контакти",
  "inquiry.update": "Промяна на запитване",
  "article.create": "Нова блог статия",
  "article.update": "Промяна на блог статия",
  "article.delete": "Изтриване на блог статия",
  "accessory.create": "Нов аксесоар",
  "accessory.update": "Промяна на аксесоар",
  "accessory.bulk.delete": "Масово изтриване на аксесоари",
  "accessory.bulk.activate": "Масова активация на аксесоари",
  "accessory.bulk.deactivate": "Масова деактивиране на аксесоари",
  "brand.create": "Нова марка",
  "rating.adjust": "Корекция на рейтинг",
  "rating.delete": "Изтриване на рейтинг",
  "settings.upsert": "Промяна на системна настройка",
  "media.upload": "Качване на изображение",
  "email_outbox.drain": "Обработка на изходящи имейли",
  "backup.full_export": "Пълен JSON backup",
  "backup.business_export_xlsx": "Excel export на бизнес данни",
  "catalog.bittel_sync": "Синхронизация с Bittel",
  "catalog.bulclima_sync": "Синхронизация с Bulclima",
  "catalog.climacom_sync": "Синхронизация с Climacom",
  "catalog.condex_sync": "Синхронизация с Condex",
  "catalog.reclassify_accessories": "Прекласификация на аксесоари",
  "staff.create": "Нов служител",
  "staff.update": "Промяна на служител",
  "staff.delete": "Изтриване на служител",
  "profile.update": "Промяна на собствен профил",
  "supplier_order.create": "Нова поръчка от доставчик",
  "supplier_order.fulfill": "Доставена поръчка от доставчик",
  "service_protocol.create": "Нов протокол за монтаж",
  "service_protocol.update": "Промяна на протокол за монтаж",
  "service_protocol.delete": "Изтриване на протокол за монтаж",
  "service_protocol.email": "Изпращане на протокол за монтаж по имейл",
  "service_repair_protocol.create": "Нов сервизен протокол",
  "service_repair_protocol.update": "Промяна на сервизен протокол",
  "service_repair_protocol.delete": "Изтриване на сервизен протокол",
  "media.fetch_remote": "Сваляне на снимка от URL",
  "ai.product_draft": "AI чернова на продукт",
  "ai.accessory_draft": "AI чернова на аксесоар",
  "ai.product_dimensions": "AI определяне на размери",
  "ai.product_label_extract": "AI четене на етикет",
  "ai.product_photo_enhance": "AI подобряване на снимка",
  "ai.inquiry_reply": "AI чернова за отговор на запитване",
  "ai.contact_summary": "AI обобщение на контакт",
  "ai.product_image_search": "AI търсене на продуктови снимки",
};

const AI_TASK_LABELS: Record<string, string> = {
  product_draft: "AI чернова на продукт",
  accessory_draft: "AI чернова на аксесоар",
  product_dimensions: "AI определяне на размери",
  product_label_extract: "AI четене на етикет",
  product_photo_enhance: "AI подобряване на снимка",
  inquiry_reply: "AI чернова за отговор на запитване",
  contact_summary: "AI обобщение на контакт",
  product_image_search: "AI търсене на продуктови снимки",
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  product: "Продукт",
  contact: "Контакт",
  inquiry: "Запитване",
  work_item: "Работна задача",
  settings: "Настройки",
  email_outbox: "Имейл опашка",
  ai: "AI",
  article: "Статия",
  accessory: "Аксесоар",
  brand: "Марка",
  product_rating: "Рейтинг",
  product_catalog_settings: "Настройки на каталог",
  products: "Продукти",
  admin_user: "Админ потребител",
  media: "Медия",
  database: "База данни",
  service_protocol: "Протокол монтаж",
  service_repair_protocol: "Сервизен протокол",
  supplier_order: "Поръчка доставчик",
};

const FIELD_LABELS: Record<string, string> = {
  status: "Статус",
  priority: "Приоритет",
  due_date: "Краен срок",
  changedFields: "Променени полета",
  fields: "Променени полета",
  price: "Цена",
  slug: "Slug",
  name: "Име",
  title: "Заглавие",
  stock_status: "Наличност",
  sold_quantity: "Продадено количество",
  stock_quantity: "Количество на склад",
  show_in_public_catalog: "В публичен каталог",
  product_condition: "Състояние",
  condition: "Състояние",
  type: "Тип",
  assigned_to: "Назначен на",
  full_name: "Име",
  phone: "Телефон",
  additional_phones_count: "Допълнителни телефони",
  targetId: "Целеви контакт",
  sourceId: "Източник контакт",
  movedWorkItems: "Преместени задачи",
  affected: "Засегнати записи",
  ids: "Избрани записи",
  visible: "Видимост",
  active: "Активен",
  position: "Позиция в топ",
  badge: "Етикет",
  restoredStock: "Възстановена наличност",
  restoredActive: "Възстановена активност",
  defaultMountNewEur: "Монтаж (нов) €",
  defaultMountUsedEur: "Монтаж (втора уп.) €",
  key: "Ключ",
  hasValue: "Има стойност",
  hasDescription: "Има описание",
  hasSpecsUpdate: "Обновени спецификации",
  hasImagesUpdate: "Обновени снимки",
  kind: "Вид",
  folder: "Папка",
  url: "URL",
  publicId: "Cloudinary ID",
  processed: "Обработени",
  sent: "Изпратени",
  failed: "Неуспешни",
  skipped: "Пропуснати",
  format: "Формат",
  tables: "Таблици",
  rowCounts: "Редове по таблица",
  hadErrors: "Имаше грешки",
  sales: "Продажби",
  stockInStock: "Наличности",
  created: "Създадени",
  updated: "Обновени",
  productCount: "Продукти в източника",
  accessoriesCreated: "Създадени аксесоари",
  accessoriesUpdated: "Обновени аксесоари",
  errors: "Грешки",
  isPublished: "Публикувана",
  isFeatured: "Препоръчана",
  brand: "Марка",
  modelCode: "Модел",
  candidatesFound: "Намерени снимки",
  task: "Задача",
  style: "Стил",
  adjustments: "Корекции",
  protocol_number: "Номер протокол",
  client_name: "Клиент",
  email: "Имейл",
  productInstanceId: "Създаден продукт",
  productId: "Продукт",
  role: "Роля",
  is_active: "Активен",
  passwordChanged: "Сменена парола",
  rawEntityId: "Външен ID",
};

const WORK_ITEM_STATUS: Record<string, string> = {
  planned: "Планирано",
  in_progress: "В процес",
  done: "Изпълнено",
  cancelled: "Отказано",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Нисък",
  medium: "Среден",
  high: "Висок",
};

const INQUIRY_STATUS: Record<string, string> = {
  new: "Ново",
  in_progress: "В работа",
  done: "Приключено",
};

const STOCK_STATUS: Record<string, string> = {
  in_stock: "В наличност",
  out_of_stock: "Няма наличност",
  on_order: "По поръчка",
};

const PRODUCT_CONDITION: Record<string, string> = {
  new: "Нов",
  used: "Втора употреба",
};

const ACCESSORY_KIND: Record<string, string> = {
  accessory: "Аксесоар",
  spare_part: "Резервна част",
  consumable: "Разходен материал",
};

const ROLE_LABELS: Record<string, string> = {
  master_admin: "Администратор",
  office_staff: "Офис",
  service_staff: "Сервиз",
};

const PROTOCOL_STATUS: Record<string, string> = {
  prepared: "Подготвен",
  in_progress: "В процес",
  signed: "Подписан",
};

const WORK_ITEM_TYPE: Record<string, string> = {
  sale: "Продажба",
  service: "Услуга",
  stock_in: "Зареждане",
  stock_out: "Изход",
  task: "Задача",
};

const MEDIA_KIND: Record<string, string> = {
  product: "Продукт",
  accessory: "Аксесоар",
  staff: "Служител",
  blog: "Блог",
  brand: "Марка",
};

function formatDateBg(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value);
  const d = s.length <= 10 ? new Date(`${s.slice(0, 10)}T00:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("bg-BG");
}

function formatMoney(value: unknown): string | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} €`;
}

function formatBool(value: unknown): string {
  return value ? "Да" : "Не";
}

function formatFieldName(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

function formatEnumValue(key: string, value: unknown): string {
  const s = String(value);
  if (key === "status") return WORK_ITEM_STATUS[s] ?? INQUIRY_STATUS[s] ?? PROTOCOL_STATUS[s] ?? s;
  if (key === "priority") return PRIORITY_LABELS[s] ?? s;
  if (key === "role") return ROLE_LABELS[s] ?? s;
  if (key === "stock_status") return STOCK_STATUS[s] ?? s;
  if (key === "condition" || key === "product_condition") return PRODUCT_CONDITION[s] ?? s;
  if (key === "type") return WORK_ITEM_TYPE[s] ?? s;
  if (key === "kind") return ACCESSORY_KIND[s] ?? MEDIA_KIND[s] ?? s;
  if (key === "style") {
    if (s === "auto") return "Автоматичен";
    if (s === "studio_bright") return "Студио (ярък)";
    if (s === "minimal_pure") return "Минималистичен";
    return s;
  }
  if (typeof value === "boolean") return formatBool(value);
  if (key === "due_date" || key.endsWith("_at") || key.endsWith("Date")) return formatDateBg(value) ?? s;
  if (key === "price" || key.includes("Eur") || key === "purchasePrice" || key === "defaultMountNewEur" || key === "defaultMountUsedEur") {
    return formatMoney(value) ?? s;
  }
  if (key === "visible" || key === "active" || key === "isPublished" || key === "isFeatured" || key === "hasValue" || key === "hasDescription" || key === "hasSpecsUpdate" || key === "hasImagesUpdate" || key === "restoredStock" || key === "restoredActive" || key === "hadErrors") {
    return formatBool(value);
  }
  return s;
}

function formatChangedFields(fields: unknown): string | null {
  if (!Array.isArray(fields) || fields.length === 0) return null;
  const labels = fields.map((f) => formatFieldName(String(f)));
  return labels.join(", ");
}

function formatIdsSummary(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  return `${value.length} бр.`;
}

function detailLine(label: string, value: string): string {
  return `${label}: ${value}`;
}

function formatDetails(action: string, details: Record<string, unknown> | null | undefined): string[] {
  if (!details || Object.keys(details).length === 0) return [];

  const lines: string[] = [];
  const skip = new Set<string>();

  if (Array.isArray(details.changedFields)) {
    const formatted = formatChangedFields(details.changedFields);
    if (formatted) lines.push(detailLine("Променени полета", formatted));
    skip.add("changedFields");
  }

  if (Array.isArray(details.fields)) {
    const formatted = formatChangedFields(details.fields);
    if (formatted) lines.push(detailLine("Променени полета", formatted));
    skip.add("fields");
  }

  if (details.ids != null) {
    lines.push(detailLine("Избрани записи", formatIdsSummary(details.ids) ?? String(details.ids)));
    skip.add("ids");
  }

  if (typeof details.affected === "number") {
    lines.push(detailLine("Засегнати", `${details.affected} бр.`));
    skip.add("affected");
  }

  if (action.startsWith("catalog.") && !action.includes("reclassify")) {
    const syncParts: string[] = [];
    for (const key of ["created", "updated", "accessoriesCreated", "accessoriesUpdated", "skipped", "productCount"] as const) {
      if (typeof details[key] === "number") {
        syncParts.push(`${formatFieldName(key).toLowerCase()}: ${details[key]}`);
      }
    }
    if (Array.isArray(details.errors) && details.errors.length > 0) {
      syncParts.push(`грешки: ${details.errors.length}`);
    }
    if (syncParts.length) lines.push(syncParts.join(" · "));
    return lines;
  }

  if (action === "contact.merge") {
    if (details.movedWorkItems != null) {
      lines.push(detailLine("Преместени задачи", `${details.movedWorkItems} бр.`));
    }
    skip.add("movedWorkItems");
    skip.add("targetId");
    skip.add("sourceId");
  }

  if (action === "email_outbox.drain") {
    for (const key of ["processed", "sent", "failed", "skipped"] as const) {
      if (typeof details[key] === "number") {
        lines.push(detailLine(formatFieldName(key), `${details[key]} бр.`));
        skip.add(key);
      }
    }
  }

  if (action.startsWith("backup.")) {
    if (typeof details.sales === "number") lines.push(detailLine("Продажби", `${details.sales} бр.`));
    if (typeof details.stockInStock === "number") lines.push(detailLine("Наличности", `${details.stockInStock} бр.`));
    if (typeof details.tables === "number") lines.push(detailLine("Таблици", `${details.tables} бр.`));
    if (details.hadErrors != null) lines.push(detailLine("Имаше грешки", formatBool(details.hadErrors)));
    skip.add("sales");
    skip.add("stockInStock");
    skip.add("tables");
    skip.add("hadErrors");
    skip.add("format");
    skip.add("rowCounts");
  }

  if (action.startsWith("ai.")) {
    if (details.brand) lines.push(detailLine("Марка", String(details.brand)));
    if (details.modelCode) lines.push(detailLine("Модел", String(details.modelCode)));
    if (typeof details.candidatesFound === "number") {
      lines.push(detailLine("Намерени снимки", `${details.candidatesFound} бр.`));
    }
    skip.add("brand");
    skip.add("modelCode");
    skip.add("candidatesFound");
    skip.add("task");
    skip.add("usage");
    skip.add("style");
  }

  if (action === "product.featured.set") {
    if (details.position != null) lines.push(detailLine("Позиция", String(details.position)));
    if (details.badge != null && details.badge !== "") lines.push(detailLine("Етикет", String(details.badge)));
    skip.add("position");
    skip.add("badge");
    skip.add("restoredStock");
    skip.add("restoredActive");
  }

  if (action === "product_catalog.settings_update") {
    if (details.defaultMountNewEur != null) {
      lines.push(detailLine("Монтаж (нов)", formatMoney(details.defaultMountNewEur) ?? String(details.defaultMountNewEur)));
    }
    if (details.defaultMountUsedEur != null) {
      lines.push(detailLine("Монтаж (втора уп.)", formatMoney(details.defaultMountUsedEur) ?? String(details.defaultMountUsedEur)));
    }
    skip.add("defaultMountNewEur");
    skip.add("defaultMountUsedEur");
  }

  if (action === "media.upload") {
    if (details.kind) lines.push(detailLine("Вид", formatEnumValue("kind", details.kind)));
    if (details.slug) lines.push(detailLine("Файл", String(details.slug)));
    skip.add("kind");
    skip.add("slug");
    skip.add("folder");
    skip.add("publicId");
    skip.add("url");
  }

  const priorityKeys = ["status", "priority", "due_date", "type", "slug", "name", "title", "price", "full_name", "phone", "visible", "active", "key"];

  for (const key of priorityKeys) {
    if (skip.has(key) || details[key] === undefined) continue;
    const value = details[key];
    if (value == null || value === "") continue;
    lines.push(detailLine(formatFieldName(key), formatEnumValue(key, value)));
    skip.add(key);
  }

  for (const [key, value] of Object.entries(details)) {
    if (skip.has(key) || value == null || value === "") continue;
    if (typeof value === "object") continue;
    lines.push(detailLine(formatFieldName(key), formatEnumValue(key, value)));
  }

  return lines;
}

export function formatActivityAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith("ai.")) {
    const task = action.slice(3);
    return AI_TASK_LABELS[task] ?? `AI: ${task.replace(/_/g, " ")}`;
  }
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatActivityEntityType(entityType: string | null | undefined): string {
  if (!entityType) return "—";
  return ENTITY_TYPE_LABELS[entityType] ?? entityType.replace(/_/g, " ");
}

export function describeActivityLog(row: ActivityLogRow): {
  actionLabel: string;
  entityLabel: string;
  detailsText: string;
  technicalAction: string;
} {
  const actionLabel = formatActivityAction(row.action);
  const entityLabel = formatActivityEntityType(row.entity_type);
  const detailLines = formatDetails(row.action, row.details ?? null);

  if (row.entity_id && detailLines.length === 0) {
    detailLines.push(detailLine("Запис", `${row.entity_id.slice(0, 8)}…`));
  }

  return {
    actionLabel,
    entityLabel,
    detailsText: detailLines.join("\n"),
    technicalAction: row.action,
  };
}
