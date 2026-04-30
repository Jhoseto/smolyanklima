import type { SupabaseClient } from "@supabase/supabase-js";

export type SpecsInput = {
  coverage_m2?: number | null;
  noise_db?: number | null;
  cooling_power_kw?: number | null;
  heating_power_kw?: number | null;
  refrigerant?: string | null;
  wifi?: boolean | null;
  energy_class_cool?: string | null;
  energy_class_heat?: string | null;
  seer?: number | null;
  scop?: number | null;
  warranty_months?: number | null;
};

export type ImageInput = { url: string; sort_order: number; is_main: boolean };

export async function upsertProductSpecs(
  supabase: SupabaseClient,
  productId: string,
  specs: SpecsInput,
): Promise<{ error: { message: string } | null }> {
  const row = {
    product_id: productId,
    coverage_m2: specs.coverage_m2 ?? null,
    noise_db: specs.noise_db ?? null,
    cooling_power_kw: specs.cooling_power_kw ?? null,
    heating_power_kw: specs.heating_power_kw ?? null,
    refrigerant: specs.refrigerant ?? null,
    wifi: specs.wifi ?? null,
    energy_class_cool: specs.energy_class_cool ?? null,
    energy_class_heat: specs.energy_class_heat ?? null,
    seer: specs.seer ?? null,
    scop: specs.scop ?? null,
    warranty_months: specs.warranty_months ?? null,
  };
  const { error } = await supabase.from("product_specs").upsert(row, { onConflict: "product_id" });
  return { error };
}

export async function replaceProductImages(
  supabase: SupabaseClient,
  productId: string,
  images: ImageInput[],
): Promise<{ error: { message: string } | null }> {
  const { error: delErr } = await supabase.from("product_images").delete().eq("product_id", productId);
  if (delErr) return { error: delErr };
  if (images.length === 0) return { error: null };
  const { error } = await supabase.from("product_images").insert(
    images.map((im, i) => ({
      product_id: productId,
      url: im.url,
      sort_order: im.sort_order ?? i,
      is_main: Boolean(im.is_main),
    })),
  );
  return { error };
}
