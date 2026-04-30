import type { SupabaseClient } from "@supabase/supabase-js";

/** Map constraint / uniqueness errors to a safe client message and status. */
export function mapProductDbError(raw: string): { status: number; error: string } | null {
  if (raw.includes("chk_products_old_price"))
    return { status: 400, error: "Старата цена трябва да е ≥ текущата цена или оставете полето за стара цена празно." };
  if (raw.includes("chk_specs_nonneg"))
    return { status: 400, error: "Едно от техническите полета е извън допустимия обхват." };
  if (raw.includes("products_slug_key") || (raw.includes("duplicate key") && raw.includes("(slug")))
    return { status: 400, error: "Вече има продукт с този идентификатор (slug)." };
  if (raw.includes("row-level security") || raw.includes("violates row-level security policy"))
    return { status: 403, error: "Нямате права за тази операция (admin достъп). Влезте отново в админ панела." };
  if (raw.includes("violates foreign key constraint"))
    return { status: 400, error: "Невалидна референция (марка/тип). Презаредете страницата и опитайте пак." };
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

/**
 * Validates merged price / old_price after a partial PATCH-style update.
 */
export async function mergedOldPriceInvalid(
  supabase: SupabaseClient,
  productId: string,
  partial: { price?: number; old_price?: number | null },
): Promise<boolean> {
  if (partial.price === undefined && partial.old_price === undefined) return false;
  const { data: cur } = await supabase.from("products").select("price, old_price").eq("id", productId).maybeSingle();
  if (!cur) return false;
  const nextPrice = partial.price !== undefined ? partial.price : Number(cur.price);
  const nextOld =
    partial.old_price !== undefined
      ? partial.old_price
      : cur.old_price != null
        ? Number(cur.old_price)
        : null;
  return nextOld != null && nextOld < nextPrice;
}
