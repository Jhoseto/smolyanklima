import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { sanitizeIlikeTerm } from "@/lib/security/sanitizeSearchTerm";
import {
  CONTAINER_OPTIONAL_COLUMNS,
  buildContainerSelect,
  type ContainerDbRow,
  type PgError,
} from "@/lib/admin/containerOptionalColumns";

export type ContainerListFilters = {
  year?: number;
  q?: string;
  sortBy?: "name" | "year" | "arrival_date" | "created_at";
  sortDir?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type ContainerListRow = ContainerDbRow & {
  product_count: number;
  total_cost_eur: number | null;
};

export type ContainerProductRow = {
  id: string;
  name: string;
  indoor_unit_serial: string | null;
  outdoor_unit_serial: string | null;
  stock_status: string | null;
  price: number | null;
};

export type ContainerWithProducts = ContainerListRow & {
  products: ContainerProductRow[];
};

export type ContainerCostAggregate = {
  year: number | null;
  containerCount: number;
  totalProducts: number;
  totalCostEur: number;
  avgCostPerUnit: number | null;
  byContainer: Array<{
    id: string;
    name: string;
    year: number;
    product_count: number;
    total_cost_eur: number | null;
    avg_cost_per_unit: number | null;
  }>;
};

export function computeContainerTotalCost(row: {
  customs_duty?: number | null;
  vat_amount?: number | null;
  japan_price?: number | null;
  transport_to_bulgaria?: number | null;
  transport_to_smolyan?: number | null;
}): number | null {
  const parts = [
    row.customs_duty,
    row.vat_amount,
    row.japan_price,
    row.transport_to_bulgaria,
    row.transport_to_smolyan,
  ];
  if (parts.every((p) => p == null)) return null;
  return parts.reduce<number>((sum, p) => sum + (p ?? 0), 0);
}

async function fetchContainersWithColumns(
  supabase: SupabaseClient,
  run: (columns: readonly string[]) => Promise<{ data: ContainerDbRow[] | null; error: PgError; count: number | null }>,
): Promise<{ rows: ContainerDbRow[]; count: number }> {
  let columns: readonly string[] = CONTAINER_OPTIONAL_COLUMNS;
  let result = await run(columns);
  while (result.error) {
    const missing = columns.find((c) => isPostgrestMissingColumn(result.error, c));
    if (!missing) throw new Error(result.error?.message ?? "Container query failed");
    columns = columns.filter((c) => c !== missing);
    result = await run(columns);
  }
  return { rows: result.data ?? [], count: result.count ?? 0 };
}

async function attachProductCounts(
  supabase: SupabaseClient,
  rows: ContainerDbRow[],
): Promise<Map<string, number>> {
  const countsByContainer = new Map<string, number>();
  const ids = rows.map((r) => r.id);
  if (!ids.length) return countsByContainer;

  const { data: productRows } = await supabase.from("products").select("container_id").in("container_id", ids);
  for (const p of productRows ?? []) {
    const cid = (p as { container_id?: string | null }).container_id;
    if (!cid) continue;
    countsByContainer.set(cid, (countsByContainer.get(cid) ?? 0) + 1);
  }
  return countsByContainer;
}

function enrichContainerRow(row: ContainerDbRow, productCount: number): ContainerListRow {
  return {
    ...row,
    product_count: productCount,
    total_cost_eur: computeContainerTotalCost(row),
  };
}

export async function listContainers(
  supabase: SupabaseClient,
  filters: ContainerListFilters = {},
): Promise<{ data: ContainerListRow[]; total: number }> {
  const {
    year,
    q,
    sortBy = "year",
    sortDir = "desc",
    page = 1,
    perPage = 200,
  } = filters;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { rows, count } = await fetchContainersWithColumns(supabase, async (columns) => {
    let query = supabase.from("containers").select(buildContainerSelect(columns), { count: "exact" });
    if (year) query = query.eq("year", year);
    if (q?.trim()) {
      const term = sanitizeIlikeTerm(q.trim());
      if (term) query = query.or(`name.ilike.%${term}%,notes.ilike.%${term}%`);
    }
    const res = await query
      .order(sortBy, { ascending: sortDir === "asc" })
      .order("id", { ascending: true })
      .range(from, to);
    return { data: res.data as ContainerDbRow[] | null, error: res.error as PgError, count: res.count };
  });

  const counts = await attachProductCounts(supabase, rows);
  const data = rows.map((r) => enrichContainerRow(r, counts.get(r.id) ?? 0));
  return { data, total: count };
}

export async function getContainerByExactName(
  supabase: SupabaseClient,
  name: string,
): Promise<ContainerListRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { rows } = await fetchContainersWithColumns(supabase, async (columns) => {
    const res = await supabase
      .from("containers")
      .select(buildContainerSelect(columns))
      .ilike("name", trimmed)
      .limit(2);
    return { data: res.data as ContainerDbRow[] | null, error: res.error as PgError, count: res.data?.length ?? 0 };
  });

  const exact = rows.filter((r) => r.name.toLowerCase() === trimmed.toLowerCase());
  if (exact.length !== 1) return null;

  const counts = await attachProductCounts(supabase, [exact[0]]);
  return enrichContainerRow(exact[0], counts.get(exact[0].id) ?? 0);
}

export async function getContainerById(
  supabase: SupabaseClient,
  id: string,
): Promise<ContainerListRow | null> {
  let columns: readonly string[] = CONTAINER_OPTIONAL_COLUMNS;
  let result: { data: ContainerDbRow | null; error: PgError } = { data: null, error: null };

  async function runGet(cols: readonly string[]) {
    const res = await supabase.from("containers").select(buildContainerSelect(cols)).eq("id", id).maybeSingle();
    return { data: res.data as ContainerDbRow | null, error: res.error as PgError };
  }

  result = await runGet(columns);
  while (result.error) {
    const missing = columns.find((c) => isPostgrestMissingColumn(result.error, c));
    if (!missing) throw new Error(result.error?.message ?? "Container fetch failed");
    columns = columns.filter((c) => c !== missing);
    result = await runGet(columns);
  }
  if (!result.data) return null;

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("container_id", id);

  return enrichContainerRow(result.data, count ?? 0);
}

export async function getContainerWithProducts(
  supabase: SupabaseClient,
  id: string,
): Promise<ContainerWithProducts | null> {
  const container = await getContainerById(supabase, id);
  if (!container) return null;

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, indoor_unit_serial, outdoor_unit_serial, stock_status, price")
    .eq("container_id", id)
    .order("name");

  if (error) throw error;

  return {
    ...container,
    products: (products ?? []) as ContainerProductRow[],
  };
}

export async function aggregateContainerCosts(
  supabase: SupabaseClient,
  year?: number,
): Promise<ContainerCostAggregate> {
  const allData: ContainerListRow[] = [];
  let page = 1;
  while (true) {
    const { data, total } = await listContainers(supabase, {
      year,
      sortBy: "year",
      sortDir: "desc",
      page,
      perPage: 500,
    });
    allData.push(...data);
    if (data.length === 0 || allData.length >= total) break;
    page += 1;
  }

  let totalCostEur = 0;
  let totalProducts = 0;
  const byContainer = allData.map((c) => {
    const cost = c.total_cost_eur ?? 0;
    totalCostEur += cost;
    totalProducts += c.product_count;
    const avg = c.product_count > 0 && c.total_cost_eur != null ? c.total_cost_eur / c.product_count : null;
    return {
      id: c.id,
      name: c.name,
      year: c.year,
      product_count: c.product_count,
      total_cost_eur: c.total_cost_eur,
      avg_cost_per_unit: avg,
    };
  });

  byContainer.sort((a, b) => (b.total_cost_eur ?? 0) - (a.total_cost_eur ?? 0));

  return {
    year: year ?? null,
    containerCount: allData.length,
    totalProducts,
    totalCostEur,
    avgCostPerUnit: totalProducts > 0 ? totalCostEur / totalProducts : null,
    byContainer,
  };
}

export async function countContainersSummary(
  supabase: SupabaseClient,
): Promise<{ count: number; totalProducts: number }> {
  const { count } = await supabase.from("containers").select("id", { count: "exact", head: true });
  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .not("container_id", "is", null);
  return { count: count ?? 0, totalProducts: productCount ?? 0 };
}
