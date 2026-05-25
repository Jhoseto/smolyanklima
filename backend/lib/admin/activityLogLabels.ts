import { saleCancelReasonLabel } from "@/lib/admin/saleCancelReason";

type ActivityLogRow = {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = {
  "work_item.create": "Ново събитие в календара",
  "work_item.update": "Промяна в календара",
  "work_item.delete": "Изтриване от календара",
  "product.create": "Добавен климатик в каталога",
  "product.update": "Редактиран климатик",
  "product.price.update": "Променена цена на климатик",
  "product.delete": "Изтрит климатик от каталога",
  "product.bulk.delete": "Масово изтриване на климатици",
  "product.bulk.show_public": "Климатици показани в публичния каталог",
  "product.bulk.hide_public": "Климатици скрити от публичния каталог",
  "product.restore_visibility_all": "Възстановена видимост на всички климатици",
  "product.featured.set": "Климатик добавен в топ продукти",
  "product.featured.remove": "Климатик премахнат от топ продукти",
  "product_catalog.settings_update": "Променени цени за монтаж в каталога",
  "contact.create": "Добавен клиент",
  "contact.update": "Редактиран клиент",
  "contact.merge": "Обединени дублирани клиенти",
  "inquiry.update": "Актуализирано запитване",
  "article.create": "Публикувана нова статия в блога",
  "article.update": "Редактирана блог статия",
  "article.delete": "Изтрита блог статия",
  "accessory.create": "Добавен аксесоар в каталога",
  "accessory.update": "Редактиран аксесоар",
  "accessory.bulk.delete": "Масово изтриване на аксесоари",
  "accessory.bulk.activate": "Аксесоари активирани",
  "accessory.bulk.deactivate": "Аксесоари деактивирани",
  "brand.create": "Добавена нова марка",
  "rating.adjust": "Коригиран рейтинг на продукт",
  "rating.delete": "Изтрит рейтинг на продукт",
  "settings.upsert": "Променена системна настройка",
  "media.upload": "Качено изображение",
  "email_outbox.drain": "Изпратени натрупани имейли",
  "backup.full_export": "Създаден пълен JSON backup",
  "backup.full_restore": "Възстановен JSON backup в базата",
  "backup.business_export_xlsx": "Експортирани бизнес данни в Excel",
  "catalog.bittel_sync": "Синхронизация с Bittel",
  "catalog.bulclima_sync": "Синхронизация с Bulclima",
  "catalog.climacom_sync": "Синхронизация с Climacom",
  "catalog.condex_sync": "Синхронизация с Condex",
  "catalog.reclassify_accessories": "Прекласификация на аксесоари",
  "staff.create": "Добавен служител",
  "staff.update": "Редактиран служител",
  "staff.delete": "Изтрит служител",
  "profile.update": "Променен собствен профил",
  "supplier_order.create": "Създадена поръчка към доставчик",
  "supplier_order.fulfill": "Получена и отразена поръчка от доставчик",
  "service_protocol.create": "Създаден приемно-предавателен протокол",
  "service_protocol.update": "Редактиран приемно-предавателен протокол",
  "service_protocol.delete": "Изтрит приемно-предавателен протокол",
  "service_protocol.email": "Изпратен протокол по имейл",
  "service_repair_protocol.create": "Създаден сервизен протокол",
  "service_repair_protocol.update": "Редактиран сервизен протокол",
  "service_repair_protocol.delete": "Изтрит сервизен протокол",
  "media.fetch_remote": "Свалено изображение от URL",
  "ai.product_draft": "AI чернова на климатик",
  "ai.accessory_draft": "AI чернова на аксесоар",
  "ai.product_dimensions": "AI определяне на размери",
  "ai.product_label_extract": "AI четене на етикет",
  "ai.product_photo_enhance": "AI подобряване на снимка",
  "ai.inquiry_reply": "AI чернова за отговор на запитване",
  "ai.contact_summary": "AI обобщение на клиент",
  "ai.product_image_search": "AI търсене на продуктови снимки",
};

const AI_TASK_LABELS: Record<string, string> = {
  product_draft: "AI чернова на климатик",
  accessory_draft: "AI чернова на аксесоар",
  product_dimensions: "AI определяне на размери",
  product_label_extract: "AI четене на етикет",
  product_photo_enhance: "AI подобряване на снимка",
  inquiry_reply: "AI чернова за отговор на запитване",
  contact_summary: "AI обобщение на клиент",
  product_image_search: "AI търсене на продуктови снимки",
};

/** Раздел в админ панела — колона „Раздел“ */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  product: "Каталог · климатик",
  contact: "Клиенти",
  inquiry: "Запитвания",
  work_item: "Календар",
  settings: "Настройки",
  email_outbox: "Имейли",
  ai: "AI помощник",
  article: "Блог",
  accessory: "Каталог · аксесоар",
  brand: "Каталог · марки",
  product_rating: "Каталог · рейтинги",
  product_catalog_settings: "Каталог · настройки",
  products: "Каталог",
  admin_user: "Екип",
  media: "Медия",
  database: "Резервни копия",
  service_protocol: "Протоколи · приемо-предаване",
  service_repair_protocol: "Протоколи · сервиз",
  supplier_order: "Поръчки",
};

const FIELD_LABELS: Record<string, string> = {
  status: "Статус",
  priority: "Приоритет",
  due_date: "Краен срок",
  changedFields: "Променени полета",
  fields: "Променени полета",
  price: "Цена",
  slug: "Адрес в сайта",
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
  publicId: "ID на снимка",
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
  completed_at: "Дата на завършване",
  sale_install_state: "Етап на продажба",
  cancel_reason: "Причина за отказ",
  installation_work_item_id: "Свързан монтаж",
  sale_work_item_id: "Свързана продажба",
  work_item_id: "Монтаж",
  restored_product_id: "Възстановен продукт",
  product_id: "Продукт",
  contact_id: "Контакт",
  inquiry_id: "Запитване",
  source: "Произход",
  event_code: "Вид събитие",
  customer_name: "Клиент",
  customer_phone: "Телефон",
  customer_address: "Адрес",
  scheduled_start: "Начало",
  scheduled_end: "Край",
  unit_price: "Единична цена",
  total_amount: "Обща сума",
  quantity: "Количество",
  notes: "Бележки",
  recipient: "Получател",
  subject: "Тема",
  mountDate: "Дата на монтаж",
  supplier_order_id: "Поръчка от доставчик",
  delivered_product_id: "Доставен продукт",
  purchasePrice: "Покупна цена",
  serial_number: "Сериен номер",
  indoor_unit_serial: "Сериен № вътрешно",
  outdoor_unit_serial: "Сериен № външно",
  paid_amount: "Платена сума",
  ac_model: "Модел климатик",
  mount_types: "Вид монтаж",
  materials: "Материали",
  cable_channels_m: "Кабелни канали (м)",
  signature_team: "Подпис екип",
  signature_client: "Подпис клиент",
  operation: "Операция",
};

const SOURCE_LABELS: Record<string, string> = {
  sale_installation: "Автоматично при монтаж",
  sale_cancelled: "При отказ на продажба",
  install_cancelled: "При отказ на монтаж",
};

const SALE_INSTALL_STATE_LABELS: Record<string, string> = {
  pending_mount: "Чака монтаж",
  completed: "Завършен",
};

const EVENT_CODE_LABELS: Record<string, string> = {
  sale: "Продажба",
  service_installation: "Монтаж",
  service_field: "Сервиз на терен",
  service_shop: "Сервиз в склад",
  maintenance: "Профилактика",
  consultation: "Консултация",
  supplier_order: "Поръчка от доставчик",
  stock_in: "Зареждане на склад",
  stock_out: "Изход от склад",
  item_added: "Добавяне в склад",
  item_removed: "Премахване от склад",
  product_add: "Добавяне на продукт",
  product_remove: "Премахване на продукт",
};

const UUID_FIELD_KEYS = new Set([
  "work_item_id",
  "installation_work_item_id",
  "sale_work_item_id",
  "restored_product_id",
  "product_id",
  "contact_id",
  "inquiry_id",
  "targetId",
  "sourceId",
  "productId",
  "productInstanceId",
  "delivered_product_id",
  "supplier_order_id",
  "entity_id",
]);

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
  draft: "Чернова",
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

function workItemEventCode(details: Record<string, unknown> | null | undefined): string {
  if (!details) return "";
  const fromEvent = details.event_code;
  if (fromEvent != null && String(fromEvent).trim()) return String(fromEvent);
  if (details.type === "sale") return "sale";
  return "";
}

function resolveWorkItemActionLabel(action: string, details: Record<string, unknown> | null | undefined): string | null {
  const eventCode = workItemEventCode(details);
  const status = details?.status != null ? String(details.status) : "";
  const saleState = details?.sale_install_state != null ? String(details.sale_install_state) : "";
  const operation = details?.operation != null ? String(details.operation) : "";

  if (action === "work_item.delete") {
    if (eventCode === "sale") return "Изтрита продажба";
    if (eventCode === "service_installation") return "Изтрит монтаж";
    if (eventCode) return `Изтрито календарно събитие: ${EVENT_CODE_LABELS[eventCode] ?? eventCode}`;
    return "Изтрито календарно събитие";
  }

  if (action === "work_item.create") {
    if (eventCode === "sale") return "Нова продажба";
    if (eventCode === "service_installation") return "Нов монтаж";
    if (eventCode === "item_added") return "Автоматично: продукт добавен в склад";
    if (eventCode === "item_removed") return "Автоматично: продукт премахнат от склад";
    if (eventCode) return `Ново календарно събитие: ${EVENT_CODE_LABELS[eventCode] ?? eventCode}`;
    return "Ново календарно събитие";
  }

  if (action === "work_item.update") {
    if (operation === "sale_cancelled" || (status === "cancelled" && details?.cancel_reason)) {
      const reason = details?.cancel_reason ? saleCancelReasonLabel(String(details.cancel_reason)) : null;
      if (reason && details?.restored_product_id) return `Отказана продажба (${reason}) · възстановен склад`;
      if (reason) return `Отказана продажба (${reason})`;
      if (details?.restored_product_id) return "Отказана продажба · възстановен склад";
      return "Отказана продажба";
    }
    if (operation === "install_cancelled" || (status === "cancelled" && eventCode === "service_installation")) {
      if (details?.restored_product_id) return "Отказан монтаж · възстановен склад";
      return "Отказан монтаж";
    }
    if (operation === "sale_completed" || (saleState === "completed" && status === "done")) {
      return "Завършена продажба — монтаж изпълнен";
    }
    if (details?.restored_product_id && status === "cancelled") {
      return "Отказ · възстановена наличност в склада";
    }
    if (eventCode === "sale") return "Редактирана продажба";
    if (eventCode === "service_installation") return "Редактиран монтаж";
    if (eventCode === "item_added") return "Актуализация: добавяне в склад";
    if (eventCode === "item_removed") return "Актуализация: премахване от склад";
    if (eventCode) return `Редактирано: ${EVENT_CODE_LABELS[eventCode] ?? eventCode}`;
    return "Редактирано календарно събитие";
  }

  return null;
}

function resolveWorkItemEntityLabel(details: Record<string, unknown> | null | undefined): string {
  const eventCode = workItemEventCode(details);
  if (eventCode === "sale") return "Продажба";
  if (eventCode === "service_installation") return "Монтаж";
  if (eventCode && EVENT_CODE_LABELS[eventCode]) return EVENT_CODE_LABELS[eventCode];
  if (details?.type === "sale") return "Продажба";
  return "Календар";
}

function resolveServiceProtocolActionLabel(action: string, details: Record<string, unknown> | null | undefined): string | null {
  const source = details?.source != null ? String(details.source) : "";
  const status = details?.status != null ? String(details.status) : "";

  if (action === "service_protocol.create") {
    if (source === "sale_installation") return "Автоматично създаден приемно-предавателен протокол";
    return "Създаден приемно-предавателен протокол";
  }
  if (action === "service_protocol.delete") {
    if (source === "sale_cancelled") return "Изтрит протокол при отказ на продажба";
    if (source === "install_cancelled") return "Изтрит протокол при отказ на монтаж";
    return "Изтрит приемно-предавателен протокол";
  }
  if (action === "service_protocol.update") {
    if (status === "signed") return "Подписан приемно-предавателен протокол";
    return "Редактиран приемно-предавателен протокол";
  }
  if (action === "service_protocol.email") return "Изпратен протокол по имейл до клиент";
  return null;
}

function resolveInquiryActionLabel(details: Record<string, unknown> | null | undefined): string | null {
  if (!details?.status) return null;
  const status = String(details.status);
  if (status === "done") return "Запитването е приключено";
  if (status === "in_progress") return "Запитването е поето в работа";
  if (status === "new") return "Запитването е отворено отново";
  return null;
}

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

function formatShortId(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "—";
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}…`;
}

function formatFieldName(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const snake = field.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  if (FIELD_LABELS[snake]) return FIELD_LABELS[snake];
  return field
    .replace(/_/g, " ")
    .replace(/\bid\b/gi, "ID")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEnumValue(key: string, value: unknown): string {
  const s = String(value);
  if (key === "cancel_reason") return saleCancelReasonLabel(s) ?? s;
  if (key === "sale_install_state") return SALE_INSTALL_STATE_LABELS[s] ?? s;
  if (key === "source") return SOURCE_LABELS[s] ?? s;
  if (key === "event_code") return EVENT_CODE_LABELS[s] ?? s;
  if (UUID_FIELD_KEYS.has(key) || key.endsWith("_id") || key.endsWith("Id")) {
    return formatShortId(value);
  }
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
  const skip = new Set<string>(["operation", "event_code", "type"]);

  if (details.title && String(details.title).trim()) {
    lines.push(detailLine("Заглавие", String(details.title)));
    skip.add("title");
  }

  if (Array.isArray(details.changedFields)) {
    const fieldsForList = details.changedFields.filter((f) => {
      const s = String(f);
      return s !== "cancel_reason" && s !== "operation";
    });
    const formatted = formatChangedFields(fieldsForList);
    if (formatted) lines.push(detailLine("Променени полета", formatted));
    for (const f of details.changedFields) {
      const s = String(f);
      if (s !== "cancel_reason" && s !== "operation") skip.add(s);
    }
    skip.add("changedFields");
  }

  if (Array.isArray(details.fields)) {
    const formatted = formatChangedFields(details.fields);
    if (formatted) lines.push(detailLine("Променени полета", formatted));
    for (const f of details.fields) skip.add(String(f));
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

  if (action.startsWith("service_protocol.") || action.startsWith("service_repair_protocol.")) {
    if (details.protocol_number) lines.push(detailLine("Номер", String(details.protocol_number)));
    if (details.client_name) lines.push(detailLine("Клиент", String(details.client_name)));
    if (details.source) lines.push(detailLine("Произход", formatEnumValue("source", details.source)));
    if (details.work_item_id) lines.push(detailLine("Монтаж", formatShortId(details.work_item_id)));
    if (details.email) lines.push(detailLine("Имейл", String(details.email)));
    skip.add("protocol_number");
    skip.add("client_name");
    skip.add("source");
    skip.add("work_item_id");
    skip.add("email");
    skip.add("status");
  }

  if (action === "work_item.update" || action === "work_item.create" || action === "work_item.delete") {
    if (details.restored_product_id) {
      lines.push(detailLine("Възстановен продукт", formatShortId(details.restored_product_id)));
      skip.add("restored_product_id");
    }
  }

  const priorityKeys = [
    "customer_name",
    "client_name",
    "full_name",
    "name",
    "cancel_reason",
    "status",
    "priority",
    "due_date",
    "slug",
    "phone",
    "price",
    "sale_install_state",
    "visible",
    "active",
    "key",
    "protocol_number",
  ];

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

export function formatActivityUser(user: { email?: string | null; name?: string | null } | null | undefined): {
  name: string;
  subtitle: string | null;
} {
  const name = user?.name?.trim() || null;
  const email = user?.email?.trim() || null;
  if (name) {
    const staffPhone = email?.match(/^staff_(\d+)@/i)?.[1];
    return {
      name,
      subtitle: staffPhone ? `Тел. ${staffPhone}` : null,
    };
  }
  if (email) {
    const staffPhone = email.match(/^staff_(\d+)@/i)?.[1];
    if (staffPhone) return { name: `Служител ${staffPhone}`, subtitle: null };
    return { name: email, subtitle: null };
  }
  return { name: "—", subtitle: null };
}

function resolveActionLabel(row: ActivityLogRow): string {
  const { action, entity_type, details } = row;

  if (entity_type === "work_item") {
    const specific = resolveWorkItemActionLabel(action, details ?? null);
    if (specific) return specific;
  }

  if (entity_type === "service_protocol") {
    const specific = resolveServiceProtocolActionLabel(action, details ?? null);
    if (specific) return specific;
  }

  if (entity_type === "inquiry" && action === "inquiry.update") {
    const specific = resolveInquiryActionLabel(details ?? null);
    if (specific) return specific;
  }

  return formatActivityAction(action);
}

function resolveEntityLabel(row: ActivityLogRow): string {
  const { entity_type, details } = row;

  if (entity_type === "work_item") {
    return resolveWorkItemEntityLabel(details ?? null);
  }

  if (entity_type === "product") return "Климатик";
  if (entity_type === "accessory") return "Аксесоар";
  if (entity_type === "contact") return "Клиент";
  if (entity_type === "inquiry") return "Запитване";
  if (entity_type === "service_protocol") return "Приемно-предавателен протокол";
  if (entity_type === "service_repair_protocol") return "Сервизен протокол";
  if (entity_type === "supplier_order") return "Поръчка от доставчик";
  if (entity_type === "admin_user") return "Служител";
  if (entity_type === "article") return "Блог статия";
  if (entity_type === "brand") return "Марка";
  if (entity_type === "product_rating") return "Рейтинг";

  return formatActivityEntityType(entity_type);
}

export function describeActivityLog(row: ActivityLogRow): {
  actionLabel: string;
  entityLabel: string;
  detailsText: string;
} {
  const actionLabel = resolveActionLabel(row);
  const entityLabel = resolveEntityLabel(row);
  const detailLines = formatDetails(row.action, row.details ?? null);

  if (row.entity_id && detailLines.length === 0) {
    detailLines.push(detailLine("Запис", formatShortId(row.entity_id)));
  }

  return {
    actionLabel,
    entityLabel,
    detailsText: detailLines.join("\n"),
  };
}
