import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyBg } from "../slugify";
import type { ClimacomParsedProduct } from "./parseClimacomProduct";
import { inferClimacomAccessoryKind } from "./classifyClimacomItem";

async function uniqueAccessorySlug(supabase: SupabaseClient, base: string): Promise<string> {
  let slug = base || "aksesoar";
  let n = 0;
  while (n < 50) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const { data } = await supabase.from("accessories").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    n++;
  }
  return `${slug}-${Date.now()}`;
}

async function findExistingAccessory(
  supabase: SupabaseClient,
  brandId: string | null,
  name: string,
): Promise<{ id: string } | null> {
  let query = supabase.from("accessories").select("id").eq("name", name);
  if (brandId) query = query.eq("brand_id", brandId);
  const { data } = await query.maybeSingle();
  return data?.id ? { id: data.id as string } : null;
}

async function replaceAccessoryImages(
  supabase: SupabaseClient,
  accessoryId: string,
  imageUrls: string[],
): Promise<void> {
  await supabase.from("accessory_images").delete().eq("accessory_id", accessoryId);
  if (!imageUrls.length) return;
  const rows = imageUrls.slice(0, 12).map((url, i) => ({
    accessory_id: accessoryId,
    url,
    sort_order: i,
    is_main: i === 0,
  }));
  const { error } = await supabase.from("accessory_images").insert(rows);
  if (error) throw new Error(error.message);
}

export async function upsertClimacomAccessory(
  supabase: SupabaseClient,
  brandId: string | null,
  item: ClimacomParsedProduct,
): Promise<"created" | "updated" | "skipped"> {
  const existing = await findExistingAccessory(supabase, brandId, item.name);
  const baseSlug = slugifyBg(item.modelCode ?? item.name);
  const slug = existing?.id ? undefined : await uniqueAccessorySlug(supabase, baseSlug);

  const row: Record<string, unknown> = {
    name: item.name,
    brand_id: brandId,
    description: item.description,
    price: item.priceEur,
    kind: inferClimacomAccessoryKind(item.name),
    stock_status: "on_order",
    stock_quantity: 0,
    is_active: true,
    meta_title: item.name.slice(0, 200),
    meta_description: (item.description ?? item.name).slice(0, 160),
  };

  if (!existing) {
    row.slug = slug;
    const { data, error } = await supabase.from("accessories").insert(row).select("id").single();
    if (error || !data?.id) throw new Error(error?.message ?? "accessory insert failed");
    if (item.imageUrls.length) await replaceAccessoryImages(supabase, data.id as string, item.imageUrls);
    return "created";
  }

  const { error } = await supabase.from("accessories").update(row).eq("id", existing.id);
  if (error) throw new Error(error.message);
  if (item.imageUrls.length) await replaceAccessoryImages(supabase, existing.id, item.imageUrls);
  return "updated";
}
