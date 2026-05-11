/** Map constraint / uniqueness errors to a safe client message and status. */
export function mapProductDbError(raw: string): { status: number; error: string } | null {
  if (raw.includes("chk_products_purchase_price_nonneg"))
    return { status: 400, error: "Закупната цена не може да е отрицателна." };
  if (raw.includes("chk_products_condition"))
    return { status: 400, error: "Състоянието трябва да е 'new' или 'used'." };
  if (raw.includes("chk_specs_nonneg"))
    return { status: 400, error: "Едно от техническите полета е извън допустимия обхват." };
  if (
    raw.includes("products_slug_unique") ||
    raw.includes("products_slug_key") ||
    (raw.includes("duplicate key") && raw.includes("(slug"))
  )
    return { status: 400, error: "Вече има продукт с този идентификатор (slug)." };
  if (raw.includes("row-level security") || raw.includes("violates row-level security policy"))
    return { status: 403, error: "Нямате права за тази операция (admin достъп). Влезте отново в админ панела." };
  if (raw.includes("products_supplier_id_fkey"))
    return { status: 400, error: "Невалиден доставчик. Изберете контакт с тип „доставчик“ от Контакти." };
  if (raw.includes("violates foreign key constraint"))
    return { status: 400, error: "Невалидна референция (марка/тип/доставчик). Презаредете страницата и опитайте пак." };
  return null;
}

export function formatSupabaseError(err: unknown): { message: string; code?: string; details?: string; hint?: string } {
  const anyErr = err as any;
  return {
    message: String(anyErr?.message ?? "Unknown error"),
    code: typeof anyErr?.code === "string" ? anyErr.code : undefined,
    details: typeof anyErr?.details === "string" ? anyErr.details : undefined,
    hint: typeof anyErr?.hint === "string" ? anyErr.hint : undefined,
  };
}

