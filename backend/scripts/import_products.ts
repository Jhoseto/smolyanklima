import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

type FrontendProduct = {
  id: string;
  name: string;
  brand: string;
  type: string;
  category?: string;
  area?: string;
  energyCool?: string;
  energyHeat?: string;
  noise?: string;
  coolingPower?: string;
  heatingPower?: string;
  refrigerant?: string;
  wifi?: boolean;
  warranty?: string;
  description?: string;
  features?: string[];
  price: number;
};

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function slugify(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function parseNumber(input?: string) {
  if (!input) return null;
  const m = input.replace(",", ".").match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function parseWarrantyMonths(input?: string) {
  const years = input ? parseNumber(input) : null;
  if (!years) return null;
  return Math.round(years * 12);
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const m = new Map<string, T>();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    if (!m.has(k)) m.set(k, it);
  }
  return Array.from(m.values());
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRole);

  const frontendDbPath = path.resolve(__dirname, "../../frontend/data/db.ts");
  const mod = (await import(pathToFileURL(frontendDbPath).toString())) as { products: FrontendProduct[] };
  const products = mod.products ?? [];

  // Upsert brands
  const brandNames = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
  const brandRows = uniqueBy(brandNames.map((name) => ({ slug: slugify(name), name })), (r) => r.slug);
  if (brandRows.length) {
    const { error } = await supabase.from("brands").upsert(brandRows, { onConflict: "slug" });
    if (error) throw error;
  }
  const { data: brands } = await supabase.from("brands").select("id,slug,name");
  const brandIdByName = new Map((brands ?? []).map((b: any) => [b.name, b.id]));

  // Upsert product types
  const typeNames = Array.from(new Set(products.map((p) => p.type).filter(Boolean)));
  const typeRows = typeNames.map((name) => ({ name }));
  if (typeRows.length) {
    const { error } = await supabase.from("product_types").upsert(typeRows, { onConflict: "name" });
    if (error) throw error;
  }
  const { data: types } = await supabase.from("product_types").select("id,name");
  const typeIdByName = new Map((types ?? []).map((t: any) => [t.name, t.id]));

  // Insert products (climatics) or accessories (parts)
  for (const p of products) {
    const brandId = brandIdByName.get(p.brand);
    const typeId = typeIdByName.get(p.type);
    if (!brandId || !typeId) continue;

    const isAccessory = (p.type ?? "").includes("Аксесоар") || (p.type ?? "").includes("Резерв");
    if (isAccessory) {
      const kind = (p.type ?? "").includes("Резерв") ? "spare_part" : "accessory";
      // Ensure it doesn't remain in products table from previous imports.
      const { data: existingProd } = await supabase.from("products").select("id").eq("slug", p.id).maybeSingle();
      if (existingProd?.id) {
        await supabase.from("product_features").delete().eq("product_id", existingProd.id);
        await supabase.from("product_images").delete().eq("product_id", existingProd.id);
        await supabase.from("product_specs").delete().eq("product_id", existingProd.id);
        await supabase.from("products").delete().eq("id", existingProd.id);
      }

      const { data: aRow, error: aErr } = await supabase
        .from("accessories")
        .upsert(
          {
            slug: p.id,
            name: p.name,
            brand_id: brandId,
            kind,
            description: p.description ?? null,
            price: p.price,
            is_active: true,
            meta_title: `${p.name} | Smolyan Klima`,
            meta_description: (p.description || "").slice(0, 160) || null,
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single();
      if (aErr) throw aErr;

      const accId = (aRow as any).id as string;
      const mainUrl = `/images/${p.id}.jpg`;
      await supabase.from("accessory_images").delete().eq("accessory_id", accId).eq("url", mainUrl);
      const { error: imgErr } = await supabase.from("accessory_images").insert({
        accessory_id: accId,
        url: mainUrl,
        sort_order: 0,
        is_main: true,
      });
      if (imgErr) throw imgErr;
      continue;
    }

    const metaTitle = `${p.name} | Smolyan Klima`;
    const metaDescription = (p.description || "").slice(0, 160) || null;

    // Products: use slug = existing p.id (already URL-safe)
    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .upsert(
        {
          slug: p.id,
          name: p.name,
          brand_id: brandId,
          type_id: typeId,
          description: p.description ?? null,
          price: p.price,
          is_active: true,
          is_featured: false,
          meta_title: metaTitle,
          meta_description: metaDescription,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (prodErr) throw prodErr;

    const productId = (prod as any).id as string;

    // Specs
    const { error: specsErr } = await supabase
      .from("product_specs")
      .upsert(
        {
          product_id: productId,
          coverage_m2: parseNumber(p.area),
          noise_db: parseNumber(p.noise),
          cooling_power_kw: parseNumber(p.coolingPower),
          heating_power_kw: parseNumber(p.heatingPower),
          refrigerant: p.refrigerant ?? null,
          wifi: p.wifi ?? null,
          energy_class_cool: p.energyCool ?? null,
          energy_class_heat: p.energyHeat ?? null,
          warranty_months: parseWarrantyMonths(p.warranty),
        },
        { onConflict: "product_id" },
      );
    if (specsErr) throw specsErr;

    // Features + join table (idempotent)
    const feats = uniqueBy((p.features ?? []).map((name) => ({ slug: slugify(name), name })), (r) => r.slug);
    if (feats.length) {
      const { error: featErr } = await supabase.from("features").upsert(feats, { onConflict: "slug" });
      if (featErr) throw featErr;
      const { data: featRows, error: featFetchErr } = await supabase
        .from("features")
        .select("id,slug")
        .in("slug", feats.map((f) => f.slug));
      if (featFetchErr) throw featFetchErr;

      const links = (featRows ?? []).map((f: any) => ({ product_id: productId, feature_id: f.id }));
      if (links.length) {
        const { error: linkErr } = await supabase.from("product_features").upsert(links, { onConflict: "product_id,feature_id" });
        if (linkErr) throw linkErr;
      }
    }

    // Images: best-effort conventional path (frontend uses /images/${id}.jpg)
    const mainUrl = `/images/${p.id}.jpg`;
    // product_images has no unique constraint on (product_id, url), so do best-effort insert.
    await supabase.from("product_images").delete().eq("product_id", productId).eq("url", mainUrl);
    const { error: imgErr } = await supabase.from("product_images").insert({
      product_id: productId,
      url: mainUrl,
      sort_order: 0,
      is_main: true,
    });
    if (imgErr) throw imgErr;
  }

  console.log(`Imported/updated products: ${products.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

