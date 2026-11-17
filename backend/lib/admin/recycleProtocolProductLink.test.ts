import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { applyRecycleSerialsToProduct } from "./recycleProtocolProductLink";

const unit = { id: "unit", stock_status: "in_stock", product_condition: "used", indoor_unit_serial: null, outdoor_unit_serial: null };
type Unit = Omit<typeof unit, "indoor_unit_serial" | "outdoor_unit_serial"> & {
  indoor_unit_serial: string | null;
  outdoor_unit_serial: string | null;
};

function fixture(initial: Unit, concurrentSerials?: [string, string]) {
  let row = { ...initial };
  const updates: { filters: URLSearchParams; patch: Partial<Unit> }[] = [];
  const db = createClient("http://localhost", "test", { global: { fetch: async (input, init) => {
    const filters = new URL(String(input)).searchParams;
    if (init?.method === "PATCH") {
      const patch = JSON.parse(String(init.body)) as Partial<Unit>;
      updates.push({ filters, patch });
      if (concurrentSerials) {
        row = { ...row, indoor_unit_serial: concurrentSerials[0], outdoor_unit_serial: concurrentSerials[1] };
        return Response.json([]);
      }
      row = { ...row, ...patch };
      return Response.json([{ id: row.id }]);
    }
    return Response.json(filters.has("or") ? [] : [row]);
  } } });
  return { db, updates };
}

test("recycling fills only missing serials of the selected used, in-stock unit", async () => {
  const { db, updates } = fixture({ ...unit, indoor_unit_serial: "In01" });
  assert.deepEqual(await applyRecycleSerialsToProduct(db, "unit", "IN01", "Out01"), { ok: true, applied: true });
  assert.deepEqual(updates[0].patch, { outdoor_unit_serial: "Out01" });
  assert.equal(updates[0].filters.get("id"), "eq.unit");
  assert.equal(updates[0].filters.get("indoor_unit_serial"), "eq.In01");
  assert.equal(updates[0].filters.get("outdoor_unit_serial"), "is.null");
  assert.equal(updates[0].filters.get("product_condition"), "eq.used");
  assert.equal(updates[0].filters.get("stock_status"), "eq.in_stock");
  assert.deepEqual(await applyRecycleSerialsToProduct(db, "unit", "IN01", "Out01"), { ok: true, applied: false });
  assert.equal(updates.length, 1);
});

test("other catalog units can be linked without changing their warehouse serials", async () => {
  for (const row of [{ ...unit, product_condition: "new" }, { ...unit, stock_status: "on_order" }, { ...unit, stock_status: "out_of_stock" }]) {
    const { db, updates } = fixture(row);
    assert.deepEqual(await applyRecycleSerialsToProduct(db, "unit", "IN", "OUT"), { ok: true, applied: false });
    assert.equal(updates.length, 0);
  }
  const { db, updates } = fixture({ ...unit, indoor_unit_serial: "other" });
  assert.equal((await applyRecycleSerialsToProduct(db, "unit", "IN", "OUT")).ok, false);
  assert.equal(updates.length, 0);
});

test("an intervening write cannot replace another protocol's serial numbers", async () => {
  const different = fixture(unit, ["OTHER-IN", "OTHER-OUT"]);
  assert.equal((await applyRecycleSerialsToProduct(different.db, "unit", "IN", "OUT")).ok, false);
  const same = fixture(unit, ["IN", "OUT"]);
  assert.deepEqual(await applyRecycleSerialsToProduct(same.db, "unit", "IN", "OUT"), { ok: true, applied: false });
});
