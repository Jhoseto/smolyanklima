import assert from "node:assert/strict";
import test from "node:test";
import { RepairWriteSchema, repairProtocolWrite, type StoredRepair } from "./repairProtocolWorkflow";
import type { AdminRole } from "./db";

const received: StoredRepair = {
  id: "40000000-0000-4000-8000-000000000001",
  created_by: "40000000-0000-4000-8000-000000000002",
  updated_at: "2026-11-11T12:13:14.000006+00:00",
  date: "2026-11-11", client_name: "Клиент", service_kind: "client",
  product_id: "40000000-0000-4000-8000-000000000003", ac_model: "AX",
  vacuum_cleaning_done: false, pressure_cold_bar: 0, notes: "При приемане",
  signature_team: "intake-signature", status: "signed", workflow_stage: "received", issue_data: null,
};

function save(row: StoredRepair | null, input: Record<string, unknown>, role: AdminRole = "service_staff") {
  return repairProtocolWrite(row, RepairWriteSchema.parse(input), role);
}

test("a phase draft can contain a signature without completing intake or issue", () => {
  const draft = save(null, { complete: false, signature_team: "intake", pressure_cold_bar: 0 });
  assert.ok(draft.ok);
  assert.equal(draft.patch.status, "in_progress");
  assert.equal(draft.patch.workflow_stage, "intake");
  const completed = save(null, { complete: true, signature_team: "intake" });
  assert.ok(completed.ok);
  assert.equal(completed.patch.workflow_stage, "received");
  assert.equal(save(null, { complete: true }).ok, false);
  assert.equal(save({ ...received, workflow_stage: "intake", status: "prepared" }, { phase: "issue" }).ok, false);

  const first = save(received, { phase: "issue", complete: false, signature_team: "issue", vacuum_cleaning_done: true });
  assert.ok(first.ok);
  assert.equal(first.patch.workflow_stage, "issuing");
  assert.deepEqual(Object.keys(first.patch).sort(), ["issue_data", "workflow_stage"]);
  const issue = first.patch.issue_data!;
  assert.equal(issue.status, "in_progress");
  assert.equal(issue.product_id, received.product_id);
  assert.equal(issue.vacuum_cleaning_done, true);
  assert.equal(issue.pressure_cold_bar, undefined);
  assert.equal(issue.notes, undefined);
  assert.equal(received.vacuum_cleaning_done, false);

  const finish = save({ ...received, workflow_stage: "issuing", issue_data: issue }, {
    phase: "issue", complete: true, notes: "След ремонта", pressure_cold_bar: 7, date: "2026-11-13",
  });
  assert.ok(finish.ok);
  assert.equal(finish.patch.workflow_stage, "issued");
  assert.equal(finish.patch.issue_data?.signature_team, "issue");
  assert.equal(finish.patch.issue_data?.status, "signed");
  assert.equal(save(received, { phase: "issue", complete: true }).ok, false);
});

test("issue cannot replace the intake unit, reuse its signature, or rewrite signed intake", () => {
  assert.equal(save(received, { phase: "issue", ac_model: "unrelated" }).ok, false);
  assert.equal(save(received, { phase: "issue", product_id: null }).ok, false);
  assert.equal(save(received, { phase: "issue", service_kind: "recycle" }).ok, false);
  assert.equal(save(received, { phase: "issue", date: "2026-10-01" }).ok, false);
  assert.equal(save(received, { notes: "replace intake" }, "master_admin").ok, false);
  const recycle = save({ ...received, service_kind: "recycle" }, { phase: "issue", complete: false });
  assert.ok(recycle.ok);
  assert.equal(recycle.syncProduct, false);
  assert.equal(recycle.patch.issue_data?.signature_team, undefined);
});

test("stale updates conflict and a signed issue only accepts a confirmed correction", () => {
  const stale = save(received, { phase: "issue", expected_updated_at: "2026-11-11T12:13:14.000005+00:00" });
  assert.ok(!stale.ok && stale.status === 409);
  const issued: StoredRepair = { ...received, workflow_stage: "issued", issue_data: { status: "signed", signature_team: "issue" } };
  const correction = { phase: "issue", complete: true, expected_updated_at: received.updated_at, notes: "Корекция" };
  assert.equal(save(issued, correction).ok, false);
  assert.equal(save(issued, { ...correction, complete: false }, "master_admin").ok, false);
  assert.equal(save(issued, { ...correction, expected_updated_at: undefined }, "master_admin").ok, false);
  const revised = save(issued, correction, "office_staff");
  assert.ok(revised.ok);
  assert.equal(revised.patch.workflow_stage, "issued");
  assert.equal(revised.patch.issue_data?.signature_team, "issue");
});

test("historical records remain historical on correction and support issue of a legacy serial pair", () => {
  const historical: StoredRepair = {
    ...received, workflow_stage: "legacy_signed", serial_number: "AAA / BBB",
    indoor_unit_serial: null, outdoor_unit_serial: null,
  };
  assert.equal(save(historical, { complete: true }, "service_staff").ok, false);
  assert.equal(save(historical, { complete: false }, "master_admin").ok, false);
  const corrected = save(historical, { complete: true }, "office_staff");
  assert.ok(corrected.ok);
  assert.equal(corrected.patch.workflow_stage, "legacy_signed");
  const issue = save(historical, { phase: "issue", indoor_unit_serial: "AAA", outdoor_unit_serial: "BBB" });
  assert.ok(issue.ok);
  assert.equal(issue.patch.issue_data?.indoor_unit_serial, "AAA");
  assert.equal(issue.patch.workflow_stage, "issuing");
});

test("legacy request bodies retain autosigning, explicit draft status and recycling links", () => {
  const signed = save(null, { signature_team: "signature" });
  assert.ok(signed.ok);
  assert.equal(signed.patch.workflow_stage, "received");
  const recycle = save(null, { service_kind: "recycle", client_name: "Частен клиент", status: "prepared" });
  assert.ok(recycle.ok);
  assert.equal(recycle.patch.status, "prepared");
  assert.equal(recycle.patch.client_name, null);
  assert.equal(recycle.patch.is_japanese_brand, undefined);
  assert.equal(recycle.syncProduct, true);
});
