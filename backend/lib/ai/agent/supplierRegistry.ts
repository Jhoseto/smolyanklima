import type { SupabaseClient } from "@supabase/supabase-js";
import { extractWebsiteUrls, hostnameFromUrl } from "@/lib/ai/agent/extractWebsiteUrls";
import { isPrivateOrLocalHost } from "@/lib/ai/agent/agentLimits";

export type CatalogSlug = "bulclima" | "climacom" | "condex" | "bittel";

export type SupplierRegistryEntry = {
  contactId: string;
  displayName: string;
  websiteUrls: string[];
  allowedHostnames: string[];
  email: string | null;
  phone: string | null;
  catalogSlug: CatalogSlug | null;
  productCount: number;
  accessoryCount: number;
};

const CATALOG_HOST_MAP: Record<string, CatalogSlug> = {
  "bulclima.com": "bulclima",
  "www.bulclima.com": "bulclima",
  "climacom.com": "climacom",
  "www.climacom.com": "climacom",
  "condex.bg": "condex",
  "www.condex.bg": "condex",
  "bittel.bg": "bittel",
  "www.bittel.bg": "bittel",
};

function slugFromHostnames(hostnames: string[]): CatalogSlug | null {
  for (const h of hostnames) {
    const slug = CATALOG_HOST_MAP[h] ?? CATALOG_HOST_MAP[h.replace(/^www\./, "")];
    if (slug) return slug;
  }
  return null;
}

let cached: { at: number; entries: SupplierRegistryEntry[] } | null = null;
const CACHE_MS = 15 * 60 * 1000;

export async function loadSupplierRegistry(
  db: SupabaseClient,
  force = false,
): Promise<SupplierRegistryEntry[]> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) {
    return cached.entries;
  }

  const { data: contacts, error } = await db
    .from("contacts")
    .select("id,full_name,email,phone,address,notes")
    .eq("contact_kind", "supplier")
    .order("full_name");

  if (error) throw new Error(error.message);

  const entries: SupplierRegistryEntry[] = [];

  for (const c of contacts ?? []) {
    const websiteUrls = extractWebsiteUrls(c.notes, c.address);
    const allowedHostnames = websiteUrls
      .map((u) => hostnameFromUrl(u))
      .filter((h): h is string => Boolean(h))
      .filter((h) => !isPrivateOrLocalHost(h));

    const [{ count: productCount }, { count: accessoryCount }] = await Promise.all([
      db.from("products").select("id", { count: "exact", head: true }).eq("supplier_id", c.id),
      db.from("accessories").select("id", { count: "exact", head: true }).eq("supplier_id", c.id),
    ]);

    entries.push({
      contactId: c.id,
      displayName: c.full_name,
      websiteUrls,
      allowedHostnames,
      email: c.email ?? null,
      phone: c.phone ?? null,
      catalogSlug: slugFromHostnames(allowedHostnames),
      productCount: productCount ?? 0,
      accessoryCount: accessoryCount ?? 0,
    });
  }

  cached = { at: Date.now(), entries };
  return entries;
}

export function findSupplierByContactId(
  entries: SupplierRegistryEntry[],
  contactId: string,
): SupplierRegistryEntry | undefined {
  return entries.find((e) => e.contactId === contactId);
}

export function isUrlAllowedForSupplier(
  entry: SupplierRegistryEntry,
  url: string,
): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (isPrivateOrLocalHost(host)) return false;
  return entry.allowedHostnames.some(
    (h) => h === host || h.replace(/^www\./, "") === host.replace(/^www\./, ""),
  );
}

export function compactSupplierListForPrompt(entries: SupplierRegistryEntry[]): string {
  if (entries.length === 0) return "Няма регистрирани доставчици в Контакти.";
  return entries
    .map(
      (e) =>
        `- ${e.displayName} (id=${e.contactId}): sites=[${e.allowedHostnames.join(", ") || "—"}], products=${e.productCount}, accessories=${e.accessoryCount}${e.catalogSlug ? `, catalog=${e.catalogSlug}` : ""}`,
    )
    .join("\n");
}

export function invalidateSupplierRegistryCache() {
  cached = null;
}
