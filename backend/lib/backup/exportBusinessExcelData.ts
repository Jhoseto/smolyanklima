import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";

const PAGE = 500;

/** Подредба на колоните — важните полета първи. */
export const SALE_EXPORT_COLUMNS = [
  "дата_продажба",
  "дата_монтаж",
  "купувач",
  "телефон_купувач",
  "продажна_цена",
  "марка",
  "модел",
  "продукт",
  "сериен_вътрешен",
  "сериен_външен",
  "доставчик",
  "фактура_доставчик",
  "дата_закупуване",
  "закупна_цена",
  "монтаж",
  "адрес_купувач",
  "бележки",
] as const;

export const STOCK_EXPORT_COLUMNS = [
  "марка",
  "модел",
  "продукт",
  "сериен_вътрешен",
  "сериен_външен",
  "доставчик",
  "фактура_доставчик",
  "дата_закупуване",
  "закупна_цена",
  "продажна_цена",
  "състояние",
  "място",
] as const;

type BrandJoin = { name?: string | null } | { name?: string | null }[] | null;
type SupplierJoin =
  | { full_name?: string | null; phone?: string | null }
  | { full_name?: string | null; phone?: string | null }[]
  | null;

type ProductEmbed = {
  id?: string;
  slug?: string;
  name?: string;
  model_code?: string | null;
  price?: number | null;
  purchase_price?: number | null;
  purchased_at?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  supplier_invoice_number?: string | null;
  product_condition?: string | null;
  brands?: BrandJoin;
  supplier?: SupplierJoin;
};

type ContactJoin = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
} | ContactJoin[] | null;

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function orderedRow(row: Record<string, unknown>, columns: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of columns) out[key] = row[key] ?? null;
  return out;
}

function saleMountLabel(row: {
  status?: string;
  sale_install_state?: string | null;
}): string {
  if (row.status === "cancelled") return "Отказана";
  if (row.sale_install_state === "pending_mount") return "Чака монтаж";
  if (row.sale_install_state === "completed") return "Завършен";
  if (row.status === "done") return "Завършен";
  return "Чака монтаж";
}

function productEmbedFields(product: ProductEmbed | null): Record<string, unknown> {
  const brand = pickOne(product?.brands ?? null);
  const supplier = pickOne(product?.supplier ?? null);
  return {
    продукт: product?.name ?? null,
    марка: brand?.name ?? null,
    модел: product?.model_code ?? null,
    сериен_вътрешен: product?.indoor_unit_serial ?? null,
    сериен_външен: product?.outdoor_unit_serial ?? null,
    доставчик: supplier?.full_name ?? null,
    фактура_доставчик: product?.supplier_invoice_number ?? null,
    дата_закупуване: product?.purchased_at ?? null,
    закупна_цена: product?.purchase_price ?? null,
  };
}

const PRODUCT_EMBED_FULL =
  "id,slug,name,model_code,price,purchase_price,purchased_at,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,product_condition,brands:brand_id(name),supplier:supplier_id(full_name,phone)";
const PRODUCT_EMBED_NO_SERIALS =
  "id,slug,name,model_code,price,purchase_price,purchased_at,supplier_invoice_number,product_condition,brands:brand_id(name),supplier:supplier_id(full_name,phone)";
const PRODUCT_EMBED_NO_SUPPLY =
  "id,slug,name,model_code,price,purchase_price,product_condition,brands:brand_id(name)";

function stripFromProductEmbed(embed: string, part: string): string {
  return embed.replace(part, "");
}

const STOCK_SELECT_FULL =
  "id,slug,name,model_code,product_condition,price,purchase_price,purchased_at,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,stock_location,brands:brand_id(name),supplier:supplier_id(full_name,phone)";
const STOCK_SELECT_NO_SERIALS =
  "id,slug,name,model_code,product_condition,price,purchase_price,purchased_at,supplier_invoice_number,stock_location,brands:brand_id(name),supplier:supplier_id(full_name,phone)";
const STOCK_SELECT_NO_SUPPLIER =
  "id,slug,name,model_code,product_condition,price,purchase_price,purchased_at,supplier_invoice_number,stock_location,brands:brand_id(name)";
const STOCK_SELECT_MIN =
  "id,slug,name,model_code,product_condition,price,stock_location,brands:brand_id(name)";

async function fetchAllSales(supabase: SupabaseClient): Promise<Record<string, unknown>[]> {
  let productEmbed = PRODUCT_EMBED_FULL;
  const selectWithContact = (embed: string) =>
    `id,created_at,due_date,status,sale_install_state,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,notes,title,products:product_id(${embed}),contacts:contact_id(full_name,phone,address)`;
  const selectNoContact = (embed: string) =>
    `id,created_at,due_date,status,sale_install_state,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,notes,title,products:product_id(${embed})`;
  const selectNoInstall = (embed: string) =>
    `id,created_at,due_date,status,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,notes,title,products:product_id(${embed})`;

  let select = selectWithContact(productEmbed);
  let withContact = true;
  let withInstallState = true;

  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("work_items")
      .select(select)
      .eq("event_code", "sale")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) {
      if (withContact && isPostgrestMissingColumn(error, "contact_id")) {
        select = selectNoInstall(productEmbed);
        withContact = false;
        continue;
      }
      if (withInstallState && isPostgrestMissingColumn(error, "sale_install_state")) {
        select = withContact ? selectNoContact(productEmbed) : selectNoInstall(productEmbed);
        withInstallState = false;
        continue;
      }
      if (productEmbed === PRODUCT_EMBED_FULL && isPostgrestMissingColumn(error, "indoor_unit_serial")) {
        productEmbed = PRODUCT_EMBED_NO_SERIALS;
        select = withContact
          ? selectWithContact(productEmbed)
          : withInstallState
            ? selectNoContact(productEmbed)
            : selectNoInstall(productEmbed);
        offset = 0;
        rows.length = 0;
        continue;
      }
      if (
        (productEmbed === PRODUCT_EMBED_FULL || productEmbed === PRODUCT_EMBED_NO_SERIALS) &&
        (isPostgrestMissingColumn(error, "supplier_id") ||
          isPostgrestMissingColumn(error, "supplier_invoice_number") ||
          isPostgrestMissingColumn(error, "purchased_at") ||
          isPostgrestMissingColumn(error, "purchase_price"))
      ) {
        productEmbed = PRODUCT_EMBED_NO_SUPPLY;
        select = withContact
          ? selectWithContact(productEmbed)
          : withInstallState
            ? selectNoContact(productEmbed)
            : selectNoInstall(productEmbed);
        offset = 0;
        rows.length = 0;
        continue;
      }
      if (isPostgrestMissingColumn(error, "supplier") && productEmbed.includes("supplier:")) {
        productEmbed = stripFromProductEmbed(productEmbed, ",supplier:supplier_id(full_name,phone)");
        select = withContact
          ? selectWithContact(productEmbed)
          : withInstallState
            ? selectNoContact(productEmbed)
            : selectNoInstall(productEmbed);
        offset = 0;
        rows.length = 0;
        continue;
      }
      throw new Error(error.message);
    }

    const batch = (data ?? []) as Record<string, unknown>[];
    for (const raw of batch) {
      const product = pickOne(raw.products as ProductEmbed | ProductEmbed[] | null);
      const contact = withContact ? pickOne(raw.contacts as ContactJoin) : null;
      const salePrice = raw.total_amount ?? raw.unit_price ?? product?.price ?? null;

      const row: Record<string, unknown> = {
        дата_продажба: raw.created_at ?? null,
        дата_монтаж: raw.due_date ?? null,
        купувач: raw.customer_name ?? contact?.full_name ?? null,
        телефон_купувач: raw.customer_phone ?? contact?.phone ?? null,
        продажна_цена: salePrice,
        ...productEmbedFields(product),
        монтаж: saleMountLabel({
          status: raw.status as string | undefined,
          sale_install_state: raw.sale_install_state as string | null | undefined,
        }),
        адрес_купувач: raw.customer_address ?? contact?.address ?? null,
        бележки: raw.notes ?? null,
      };
      rows.push(orderedRow(row, SALE_EXPORT_COLUMNS));
    }

    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  return rows;
}

async function fetchInStockProducts(supabase: SupabaseClient): Promise<Record<string, unknown>[]> {
  let select = STOCK_SELECT_FULL;
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select(select)
      .eq("stock_status", "in_stock")
      .order("name")
      .range(offset, offset + PAGE - 1);

    if (error) {
      if (select === STOCK_SELECT_FULL && isPostgrestMissingColumn(error, "indoor_unit_serial")) {
        select = STOCK_SELECT_NO_SERIALS;
        offset = 0;
        rows.length = 0;
        continue;
      }
      if (select.includes("supplier:") && isPostgrestMissingColumn(error, "supplier")) {
        select = STOCK_SELECT_NO_SUPPLIER;
        offset = 0;
        rows.length = 0;
        continue;
      }
      if (
        (isPostgrestMissingColumn(error, "purchased_at") ||
          isPostgrestMissingColumn(error, "purchase_price") ||
          isPostgrestMissingColumn(error, "supplier_invoice_number")) &&
        select !== STOCK_SELECT_MIN
      ) {
        select = STOCK_SELECT_MIN;
        offset = 0;
        rows.length = 0;
        continue;
      }
      throw new Error(error.message);
    }

    const batch = (data ?? []) as Record<string, unknown>[];
    for (const raw of batch) {
      const product = raw as ProductEmbed;
      const row: Record<string, unknown> = {
        ...productEmbedFields(product),
        продажна_цена: raw.price ?? null,
        състояние: raw.product_condition === "used" ? "Употребяван" : "Нов",
        място:
          raw.stock_location === "showroom"
            ? "Магазин"
            : raw.stock_location === "warehouse"
              ? "Склад"
              : (raw.stock_location as string | null) ?? null,
      };
      rows.push(orderedRow(row, STOCK_EXPORT_COLUMNS));
    }

    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  return rows;
}

export type BusinessExcelExport = {
  exportedAt: string;
  sales: Record<string, unknown>[];
  stock: Record<string, unknown>[];
  saleColumns: readonly string[];
  stockColumns: readonly string[];
};

export async function exportBusinessExcelData(supabase: SupabaseClient): Promise<BusinessExcelExport> {
  const [sales, stock] = await Promise.all([fetchAllSales(supabase), fetchInStockProducts(supabase)]);
  return {
    exportedAt: new Date().toISOString(),
    sales,
    stock,
    saleColumns: SALE_EXPORT_COLUMNS,
    stockColumns: STOCK_EXPORT_COLUMNS,
  };
}
