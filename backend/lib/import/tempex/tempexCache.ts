import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchTempexHtml, isTempexCatalogHtml, tempexUrl } from "./tempexHttp";

/** Optional CLI cache of public source pages; enables repeatable audits and restart without repeated site requests. */
export function createTempexCachedFetcher(directory: string): typeof fetchTempexHtml {
  const root = path.resolve(directory);
  return async (href) => {
    const url = tempexUrl(href).href;
    const filename = path.join(root, `${createHash("sha256").update(url).digest("hex")}.json`);
    try {
      const cached = JSON.parse(await readFile(filename, "utf8")) as { url: string; fetchedAt: string; html: string };
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (cached.url === url && age >= 0 && age < 24 * 60 * 60_000 && isTempexCatalogHtml(cached.html, new URL(url))) return cached.html;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const html = await fetchTempexHtml(url);
    await mkdir(root, { recursive: true });
    const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify({ url, fetchedAt: new Date().toISOString(), html }));
    await rename(temporary, filename);
    return html;
  };
}
