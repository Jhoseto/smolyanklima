import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSalesHistoryReport } from "./computeSalesHistoryReport";
import { applySalesBgnToEur } from "./convertSalesBgnToEur";
import { replaceContactPhones } from "./contactPhones";
import { recordManualSale } from "./recordManualSale";

test("sales report excludes cancelled sales from monetary totals", () => {
  const report = computeSalesHistoryReport(
    [
      {
        id: "active-sale",
        status: "done",
        total_amount: 1200,
        purchase_price: 700,
        customer_name: "Client",
        due_date: "2026-02-02",
      },
      {
        id: "cancelled-sale",
        status: "cancelled",
        total_amount: 9000,
        purchase_price: 5000,
        customer_name: "Client",
        due_date: "2026-02-03",
      },
    ],
    2,
  );

  assert.equal(report.summary.saleCount, 2);
  assert.equal(report.summary.cancelledCount, 1);
  assert.equal(report.summary.totalRevenue, 1200);
  assert.equal(report.summary.totalPurchase, 700);
  assert.equal(report.summary.avgSale, 1200);
  assert.deepEqual(report.priceBuckets, [{ label: "€1200–2000", count: 1 }]);
  assert.equal(report.topClients[0]?.revenue, 1200);
  assert.equal(report.topClients[0]?.avgSale, 1200);
});

test("manual sales are marked as already recorded in EUR", async () => {
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const supabase = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          return {
            select() {
              return {
                async single() {
                  return { data: { id: `${table}-id` }, error: null };
                },
              };
            },
          };
        },
        delete() {
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  await recordManualSale(supabase, {
    productName: "Used AC",
    saleProductCondition: "used",
    customerName: "Client",
    saleDate: "2025-01-10",
    salePrice: 600,
    saleInstallState: "completed",
    createdBy: "admin-id",
  });

  assert.equal(inserts[0]?.table, "work_items");
  assert.equal(typeof inserts[0]?.payload.amounts_converted_from_bgn_at, "string");
});

test("BGN conversion skips rows already converted by a concurrent request", async () => {
  let guardedWorkItemUpdate = false;
  let productSelects = 0;
  const supabase = {
    from(table: string) {
      if (table !== "work_items") {
        productSelects += 1;
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select() {
          return {
            async eq(column: string, value: string) {
              assert.equal(column, "event_code");
              assert.equal(value, "sale");
              return {
                data: [
                  {
                    id: "sale-id",
                    product_id: "product-id",
                    due_date: "2025-01-01",
                    completed_at: null,
                    created_at: "2025-01-01T10:00:00Z",
                    unit_price: 195.58,
                    total_amount: 195.58,
                    purchase_price: 97.79,
                    amounts_converted_from_bgn_at: null,
                  },
                ],
                error: null,
              };
            },
          };
        },
        update() {
          return {
            eq(column: string, value: string) {
              assert.equal(column, "id");
              assert.equal(value, "sale-id");
              return this;
            },
            is(column: string, value: null) {
              assert.equal(column, "amounts_converted_from_bgn_at");
              assert.equal(value, null);
              guardedWorkItemUpdate = true;
              return this;
            },
            select() {
              return this;
            },
            async maybeSingle() {
              return { data: null, error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  const result = await applySalesBgnToEur(supabase);

  assert.equal(guardedWorkItemUpdate, true);
  assert.equal(result.workItemsUpdated, 0);
  assert.equal(result.productsUpdated, 0);
  assert.equal(productSelects, 0);
});

test("contact phone replacement restores previous rows after insert failure", async () => {
  const existingRows = [
    {
      contact_id: "contact-id",
      phone: "+359 888 111 222",
      label: "Основен",
      is_primary: true,
      sort_order: 0,
    },
  ];
  const insertAttempts: unknown[] = [];
  const supabase = {
    from(table: string) {
      assert.equal(table, "contact_phones");
      return {
        select() {
          return {
            eq: async () => ({ data: existingRows, error: null }),
          };
        },
        delete() {
          return {
            eq: async () => ({ error: null }),
          };
        },
        async insert(rows: unknown) {
          insertAttempts.push(rows);
          if (insertAttempts.length === 1) {
            return { error: { message: "constraint failed" } };
          }
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;

  const result = await replaceContactPhones(supabase, "contact-id", "+359 888 333 444", [
    { phone: "+359 888 555 666" },
  ]);

  assert.match(result.error ?? "", /constraint failed/);
  assert.equal(insertAttempts.length, 2);
  assert.deepEqual(insertAttempts[1], existingRows);
});
