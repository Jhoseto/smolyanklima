/**
 * Търси реални снимки на продуктите чрез DuckDuckGo Image Search (подобно на Google Images).
 * Взема първите 1-3 снимки и ги качва в Cloudinary.
 *
 *   node scripts/sync-ddg-images.mjs
 *   node scripts/sync-ddg-images.mjs --only-stale
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONLY_STALE = process.argv.includes("--only-stale");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Липсва SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseCloudinaryUrl(raw) {
  const u = (raw || "").trim();
  const m = u.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/i);
  if (!m) return null;
  return { apiKey: decodeURIComponent(m[1]), apiSecret: decodeURIComponent(m[2]), cloudName: decodeURIComponent(m[3]) };
}

function setupCloudinary() {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  if (!fromUrl) return false;
  cloudinary.config({
    cloud_name: fromUrl.cloudName,
    api_key: fromUrl.apiKey,
    api_secret: fromUrl.apiSecret,
    secure: true,
  });
  return true;
}

const cloudinaryOk = setupCloudinary();

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchDDGImages(query, max = 3) {
  try {
    // 1. Get vqd token
    const res1 = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    const html = await res1.text();
    const vqdMatch = html.match(/vqd=["']([^"']+)["']/);
    if (!vqdMatch) throw new Error("No vqd found");
    const vqd = vqdMatch[1];

    // 2. Search images
    const res2 = await fetch(`https://duckduckgo.com/i.js?l=bg-bg&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,&p=1`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    const json = await res2.json();
    
    // Filter out logos, icons, and irrelevant images
    const valid = (json.results || []).filter(r => {
      const u = r.image.toLowerCase();
      if (u.includes("logo") || u.includes("icon") || u.includes("banner")) return false;
      return true;
    }).map(r => r.image);

    return valid.slice(0, max);
  } catch (e) {
    console.warn(`   ⚠ DDG грешка: ${e.message}`);
    return [];
  }
}

async function mirrorToCloudinary(remoteUrl, folderPath) {
  if (!cloudinaryOk) return remoteUrl;
  try {
    const r = await cloudinary.uploader.upload(remoteUrl, {
      folder: folderPath,
      resource_type: "image",
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    });
    return r.secure_url || remoteUrl;
  } catch (e) {
    console.warn(`   ⚠ Cloudinary: ${e.message} — оставям URL`);
    return remoteUrl;
  }
}

async function loadStaleProductRows() {
  const { data: products, error: e1 } = await sb.from("products").select("id, slug, name").order("slug");
  if (e1) throw e1;
  const { data: imgs, error: e2 } = await sb.from("product_images").select("product_id, url, is_main");
  if (e2) throw e2;

  const mainUrl = new Map();
  for (const im of imgs ?? []) {
    if (im.is_main && im.url) mainUrl.set(im.product_id, im.url);
  }

  return products.filter((p) => {
    const u = mainUrl.get(p.id);
    return !u || u.includes("picsum.photos");
  });
}

async function loadStaleAccessoryRows() {
  const { data: acc, error: e1 } = await sb.from("accessories").select("id, slug, name").order("slug");
  if (e1) throw e1;
  const { data: imgs, error: e2 } = await sb.from("accessory_images").select("accessory_id, url, is_main");
  if (e2) throw e2;

  const mainUrl = new Map();
  for (const im of imgs ?? []) {
    if (im.is_main && im.url) mainUrl.set(im.accessory_id, im.url);
  }

  return acc.filter((a) => {
    const u = mainUrl.get(a.id);
    return !u || u.includes("picsum.photos");
  });
}

async function syncProducts(rows) {
  console.log(`\n📷 Продукти: ${rows.length} бр.\n`);
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${p.slug} ... `);
    
    // Search query: brand + model
    const query = `климатик ${p.name}`;
    const urls = await fetchDDGImages(query, 3);
    
    if (urls.length === 0) {
      console.log("няма намерени снимки");
      failed++;
      continue;
    }

    await sb.from("product_images").delete().eq("product_id", p.id);

    const folder = `smolyanklima/klimatici/${p.slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 80)}`;
    const rowsIns = [];
    for (let j = 0; j < urls.length; j++) {
      const finalUrl = await mirrorToCloudinary(urls[j], folder);
      rowsIns.push({
        product_id: p.id,
        url: finalUrl,
        sort_order: j,
        is_main: j === 0,
      });
    }
    const { error: insErr } = await sb.from("product_images").insert(rowsIns);
    if (insErr) {
      console.log(`ГРЕШКА: ${insErr.message}`);
      failed++;
    } else {
      console.log(`${urls.length} снимки`);
      ok++;
    }
    await sleep(500);
  }
  console.log(`\n✓ Продукти готови: ${ok}, пропуснати/грешка: ${failed}`);
}

async function syncAccessories(rows) {
  console.log(`\n📷 Аксесоари: ${rows.length} бр.\n`);
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${a.slug} ... `);
    
    const query = a.name;
    const urls = await fetchDDGImages(query, 2);
    
    if (urls.length === 0) {
      console.log("няма намерени снимки");
      failed++;
      continue;
    }

    await sb.from("accessory_images").delete().eq("accessory_id", a.id);

    const folder = `smolyanklima/aksesoari/${a.slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 80)}`;
    const rowsIns = [];
    for (let j = 0; j < urls.length; j++) {
      const finalUrl = await mirrorToCloudinary(urls[j], folder);
      rowsIns.push({
        accessory_id: a.id,
        url: finalUrl,
        sort_order: j,
        is_main: j === 0,
      });
    }
    const { error: insErr } = await sb.from("accessory_images").insert(rowsIns);
    if (insErr) {
      console.log(`ГРЕШКА: ${insErr.message}`);
      failed++;
    } else {
      console.log(`${urls.length} снимки`);
      ok++;
    }
    await sleep(500);
  }
  console.log(`\n✓ Аксесоари готови: ${ok}, пропуснати/грешка: ${failed}`);
}

console.log(
  cloudinaryOk
    ? "Режим: DuckDuckGo Image Search → Cloudinary → Supabase"
    : "Режим: DuckDuckGo Image Search → Supabase (няма валиден CLOUDINARY_URL)",
);

let productRows;
let accessoryRows;

if (ONLY_STALE) {
  productRows = await loadStaleProductRows();
  accessoryRows = await loadStaleAccessoryRows();
  console.log(`Намерени за обновяване: ${productRows.length} продукта, ${accessoryRows.length} аксесоара`);
} else {
  const { data: p, error: e1 } = await sb.from("products").select("id, slug, name").order("slug");
  if (e1) throw e1;
  const { data: a, error: e2 } = await sb.from("accessories").select("id, slug, name").order("slug");
  if (e2) throw e2;
  productRows = p;
  accessoryRows = a;
}

await syncProducts(productRows);
await syncAccessories(accessoryRows);
console.log("\n✅ Готово.\n");
