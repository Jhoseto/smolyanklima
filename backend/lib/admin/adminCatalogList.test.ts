import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  canIncludeAccessories, listAdminAccessories, listAdminCatalogMerged, readCatalogRowsByIds, readCatalogStubs,
  readWithAdminBtuFallback, selectAdminProducts, type ProductCatalogStub,
} from "./adminCatalogList";
import { coolingKwRangeForBtu } from "../catalog/productBtu";
import { buildProductCatalogDisplayRows } from "./productCatalogDisplay";
import { applyAdminProductListChipFilters, parseProductListChipFilters } from "./productListQueryFilters";

function catalogClient(respond: (url: URL) => { rows: object[]; total?: number }) {
  return createClient("http://localhost", "test", {
    global: {
      fetch: async (input) => {
        const { rows, total } = respond(new URL(String(input)));
        return Response.json(rows, {
          headers: { "content-range": "*/" + (total ?? rows.length) },
        });
      },
    },
  });
}

test("BTU filters match explicit ratings and estimate only missing ratings, within the product page query", async () => {
  const btus = [9, 12];
  const ranges = btus.map((btu) => {
    const { min, max } = coolingKwRangeForBtu(btu)!;
    return `and(cooling_power_kw.gte.${min},cooling_power_kw.lte.${max})`;
  }).join(",");
  for (const legacy of [false, true]) {
    const queries: URL[] = [];
    const client = createClient("http://localhost", "test", { global: { fetch: async (input) => {
      const url = new URL(String(input));
      queries.push(url);
      if (legacy && queries.length === 1) {
        return Response.json({ code: "42703", message: "column product_specs.btu does not exist" }, { status: 400 });
      }
      return Response.json([{ id: "match" }], { headers: { "content-range": "500-500/501" } });
    } } });
    const result = await readWithAdminBtuFallback(btus, (hasBtu) =>
      selectAdminProducts(client, "id", btus, hasBtu).order("name").range(500, 999),
    );
    assert.ifError(result.error);
    assert.equal(result.count, 501);
    assert.equal(queries.length, legacy ? 2 : 1);
    for (const query of queries) {
      assert.equal(query.pathname, "/rest/v1/products");
      assert.equal(query.searchParams.get("select"), "id,product_specs!inner()");
      assert.equal(query.searchParams.get("offset"), "500");
      assert.equal(query.searchParams.has("id"), false);
    }
    assert.equal(queries[0].searchParams.get("product_specs.or"), `(btu.in.(9,12),and(btu.is.null,or(${ranges})))`);
    if (legacy) assert.equal(queries[1].searchParams.get("product_specs.or"), `(${ranges})`);
  }
});

test("accessories only match filters consistent with their displayed fields", () => {
  const filters = { ...parseProductListChipFilters({}), btuFilters: [] };
  assert.equal(canIncludeAccessories(filters), true);
  assert.equal(canIncludeAccessories({ ...filters, conditions: ["new", "used"], featuredFlags: ["regular"] }), true);
  assert.equal(canIncludeAccessories({ ...filters, hasSerial: "without", hasPurchasePrice: "without" }), true);
  assert.equal(canIncludeAccessories({ ...filters, conditions: ["used"] }), false);
  assert.equal(canIncludeAccessories({ ...filters, featuredFlags: ["featured"] }), false);
  assert.equal(canIncludeAccessories({ ...filters, btuFilters: [12] }), false);
  assert.equal(canIncludeAccessories({ ...filters, hasSerial: "with" }), false);
  assert.equal(canIncludeAccessories({ ...filters, typeId: "wall" }), false);
  assert.equal(canIncludeAccessories({ ...filters, containerId: "container" }), false);
});

test("accessory visibility and stock filters reach the query together", async () => {
  const client = catalogClient((url) => {
    assert.equal(url.searchParams.get("is_active"), "eq.false");
    assert.equal(url.searchParams.get("stock_status"), "in.(in_stock,on_order)");
    assert.equal(url.searchParams.get("order"), "price.desc,name.asc,id.asc");
    return { rows: [] };
  });
  await listAdminAccessories(client, {
    sortBy: "price", sortDir: "desc", page: 1, perPage: 10,
    stockStatuses: ["in_stock", "on_order"], publicCatalogFlags: ["hidden"],
  });
});

test("all four selected stock chips exclude sold units from the query and the count", async () => {
  const client = catalogClient((url) => {
    assert.equal(url.searchParams.get("stock_status"), "in.(in_stock,on_order,reserved,scrapped)");
    return { rows: [] };
  });
  const query = client.from("products").select("id", { count: "exact" });
  const chips = parseProductListChipFilters({ stockStatus: "in_stock,on_order,reserved,scrapped" });
  const result = await (applyAdminProductListChipFilters(query, chips) as typeof query);
  assert.ifError(result.error);
});

test("units received from a supplier order are only in the visible public-catalog group", async () => {
  for (const visibility of ["visible", "hidden"]) {
    const client = catalogClient((url) => {
      if (visibility === "visible") {
        assert.match(url.searchParams.get("or") ?? "", /supplier_order_work_item_id.not.is.null/);
      } else {
        assert.equal(url.searchParams.get("supplier_order_work_item_id"), "is.null");
      }
      return { rows: [] };
    });
    const query = client.from("products").select("id");
    const chips = parseProductListChipFilters({ publicCatalog: visibility });
    const result = await (applyAdminProductListChipFilters(query, chips) as typeof query);
    assert.ifError(result.error);
  }
});

test("the scrapped chip shows scrapped products in the rendered rows", () => {
  const items = ["scrapped", "in_stock", "out_of_stock"].map((stock_status) => ({
    id: stock_status, name: stock_status, stock_status, product_condition: "used",
  }));
  assert.deepEqual(buildProductCatalogDisplayRows(items).map((r) => r.row.id), ["in_stock"]);
  assert.deepEqual(buildProductCatalogDisplayRows(items, { showScrapped: true }).map((r) => r.row.id), ["scrapped", "in_stock"]);
});

test("mixed pages sort by numeric purchase price and keep stable ties and missing values", async () => {
  const products: ProductCatalogStub[] = [
    { id: "x", name: "X", purchase_price: 9 },
    { id: "z", name: "Z", purchase_price: 105 },
    { id: "y", name: "Y", purchase_price: 105 },
  ].map((p) => ({ ...p, price: 150, product_condition: "new", purchased_at: null, stock_location: "warehouse" }));
  const accessory = { id: "a", name: "A", price: 7 };
  const client = catalogClient((url) => ({
    rows: url.pathname.endsWith("/products") ? products : [accessory],
  }));
  async function readPage(sortDir: "asc" | "desc", page: number, perPage: number) {
    const sorted = [...products].sort((a, b) => {
      const diff = Number(a.purchase_price) - Number(b.purchase_price);
      return sortDir === "asc" ? diff : -diff;
    });
    return listAdminCatalogMerged(client, { sortBy: "purchase_price", sortDir, page, perPage },
      async (from, to) => ({ data: sorted.slice(from, to + 1), count: products.length, error: null }),
      async (ids) => products.filter((r) => ids.includes(r.id)),
    );
  }
  const first = await readPage("desc", 1, 2);
  const second = await readPage("desc", 2, 2);
  const ascending = await readPage("asc", 1, 4);
  assert.deepEqual(first.data.map((r) => r.id), ["a", "y"]);
  assert.deepEqual(second.data.map((r) => r.id), ["z", "x"]);
  assert.deepEqual(ascending.data.map((r) => r.id), ["x", "y", "z", "a"]);
  assert.equal(first.total, 4);
});

test("the combined catalog index includes rows beyond the server's response limit", async () => {
  const ids = Array.from({ length: 4200 }, (_, i) => i);
  const { rows } = await readCatalogStubs(async (from, to) => ({
    data: ids.slice(from, Math.min(to + 1, from + 750)), count: ids.length, error: null,
  }), 500);
  assert.deepEqual(rows, ids);
});

test("sorted prefixes stop after completing the cutoff tie and retain the true total", async () => {
  const groups = [0, 1, 1, 1, 1, 2, 3, 4, 5, 6];
  const { rows, total } = await readCatalogStubs(async (from, to) => ({
    data: groups.slice(from, Math.min(to + 1, from + 3)), count: groups.length, error: null,
  }), 2, (value) => value);
  assert.deepEqual(rows, [0, 1, 1, 1, 1, 2]);
  assert.equal(total, 10);
});

test("detail requests split long ID lists and preserve every row", async () => {
  const ids = Array.from({ length: 501 }, (_, i) => String(i));
  const sizes: number[] = [];
  const rows = await readCatalogRowsByIds(ids, async (batch) => {
    sizes.push(batch.length);
    return { data: batch, error: null };
  });
  assert.deepEqual(sizes, [100, 100, 100, 100, 100, 1]);
  assert.deepEqual(rows, ids);
});
