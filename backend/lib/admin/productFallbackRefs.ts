import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fallback марка/тип за бързо въвеждане на артикули с непълна информация
 * (напр. употребявани климатици от контейнер, докато се уточнят данните).
 * Полетата „Марка“ и „Тип“ не са задължителни в UI — ако липсват, тук се
 * намира (или създава при първа нужда) placeholder запис, за да не се
 * нарушат NOT NULL ограниченията в `products`.
 */
const UNKNOWN_BRAND_NAME = "Неизвестна марка";
const UNKNOWN_BRAND_SLUG = "neizvestna-marka";
const UNKNOWN_TYPE_NAME = "Неизвестен тип";

export async function resolveFallbackBrandId(
  supabase: SupabaseClient,
  brandId: string | null | undefined,
): Promise<string | null> {
  if (brandId) return brandId;

  const { data: bySlug } = await supabase.from("brands").select("id").eq("slug", UNKNOWN_BRAND_SLUG).maybeSingle();
  if (bySlug) return bySlug.id as string;

  const { data: byName } = await supabase.from("brands").select("id").ilike("name", UNKNOWN_BRAND_NAME).maybeSingle();
  if (byName) return byName.id as string;

  const { data: inserted, error } = await supabase
    .from("brands")
    .insert({ name: UNKNOWN_BRAND_NAME, slug: UNKNOWN_BRAND_SLUG })
    .select("id")
    .single();
  if (!error && inserted) return inserted.id as string;

  // Race condition — паралелен request вече го е създал между SELECT и INSERT.
  const { data: retry } = await supabase.from("brands").select("id").ilike("name", UNKNOWN_BRAND_NAME).maybeSingle();
  return (retry?.id as string | undefined) ?? null;
}

export async function resolveFallbackTypeId(
  supabase: SupabaseClient,
  typeId: string | null | undefined,
): Promise<string | null> {
  if (typeId) return typeId;

  const { data: byName } = await supabase.from("product_types").select("id").ilike("name", UNKNOWN_TYPE_NAME).maybeSingle();
  if (byName) return byName.id as string;

  const { data: inserted, error } = await supabase
    .from("product_types")
    .insert({ name: UNKNOWN_TYPE_NAME })
    .select("id")
    .single();
  if (!error && inserted) return inserted.id as string;

  const { data: retry } = await supabase.from("product_types").select("id").ilike("name", UNKNOWN_TYPE_NAME).maybeSingle();
  return (retry?.id as string | undefined) ?? null;
}
