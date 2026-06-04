/** Максимум id на една bulk заявка (сървър). Клиентът дели на парчета с BULK_CHUNK_SIZE. */
export const ADMIN_CATALOG_BULK_IDS_MAX = 200;

/** Размер на парче при масови операции от админ списъка (≤ BULK_IDS_MAX). */
export const ADMIN_CATALOG_BULK_CHUNK_SIZE = 200;
