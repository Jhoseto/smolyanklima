import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { collectTempexProductUrls } from "../lib/import/tempex/collectTempexProducts";
import { fetchTempexProduct, TempexNoPublishedPriceError } from "../lib/import/tempex/parseTempexProduct";
import { runTempexCatalogSync } from "../lib/import/tempex/syncTempexCatalog";
import { TempexRateLimitError } from "../lib/import/tempex/tempexHttp";
import { createTempexCachedFetcher } from "../lib/import/tempex/tempexCache";

async function main() {
  const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const fetchHtml = option("cache-dir") ? createTempexCachedFetcher(option("cache-dir")!) : undefined;
  const rawLimit = option("limit");
  const limit = rawLimit ? Number(rawLimit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error("Невалиден --limit");
  if (process.argv.includes("--dry-run")) {
    const entries = await collectTempexProductUrls(limit, (message) => console.log(message), fetchHtml);
    const products = [];
    const errors: string[] = [];
    const excluded: string[] = [];
    let next = 0;
    let stopped = false;
    await Promise.all(Array.from({ length: Math.min(3, entries.length) }, async () => {
      while (next < entries.length) {
        if (stopped) return;
        const entry = entries[next++]!;
        try { products.push(await fetchTempexProduct(entry, fetchHtml)); }
        catch (error) {
          if (error instanceof TempexNoPublishedPriceError) excluded.push(`${entry.url}: ${error.message}`);
          else errors.push(`${entry.url}: ${error instanceof Error ? error.message : String(error)}`);
          if (error instanceof TempexRateLimitError) stopped = true;
        }
        console.log(`[${products.length + errors.length + excluded.length}/${entries.length}] ${entry.url}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }));
    const summary = { productUrls: entries.length, parsed: products.length, excluded, categories: products.reduce<Record<string, number>>((counts, p) => ({ ...counts, [p.categorySlug]: (counts[p.categorySlug] ?? 0) + 1 }), {}), errors };
    if (option("output")) await writeFile(path.resolve(option("output")!), JSON.stringify({ summary, products }, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    if (errors.length) process.exitCode = 1;
    return;
  }
  dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env.local"), quiet: true });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Липсва SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary = await runTempexCatalogSync(db, { limit, fetchHtml, onProgress: (event) => console.log(`[${event.phase}] ${event.message}`) });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
