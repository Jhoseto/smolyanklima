import test from "node:test";
import assert from "node:assert/strict";
import {
  type BackupFilePayload,
  validateBackupPayloadForRestore,
} from "./importPublicTablesBackup";

function backup(overrides: Partial<BackupFilePayload> = {}): BackupFilePayload {
  return {
    manifest: {
      format: "smolyanklima-full-json",
      formatVersion: 1,
      exportedAt: "2026-05-29T00:00:00.000Z",
      tables: ["brands", "products"],
      rowCounts: { brands: 1, products: 1 },
    },
    data: {
      brands: [{ id: "brand-1" }],
      products: [{ id: "product-1" }],
    },
    ...overrides,
  };
}

test("rejects backups that recorded table export errors", () => {
  const payload = backup({
    manifest: {
      ...backup().manifest,
      tableErrors: { products: "timeout" },
    },
  });

  assert.throws(() => validateBackupPayloadForRestore(payload, "replace"), /непълен/);
});

test("rejects backups whose data keys do not match manifest tables", () => {
  const payload = backup({
    data: {
      brands: [{ id: "brand-1" }],
    },
  });

  assert.throws(() => validateBackupPayloadForRestore(payload, "replace"), /manifest\.tables/);
});

test("rejects backups whose row counts do not match serialized rows", () => {
  const payload = backup({
    manifest: {
      ...backup().manifest,
      rowCounts: { brands: 1, products: 2 },
    },
  });

  assert.throws(() => validateBackupPayloadForRestore(payload, "replace"), /products/);
});

test("rejects replace restore when backup tables do not match current schema", () => {
  const payload = backup();

  assert.throws(
    () => validateBackupPayloadForRestore(payload, "replace", { currentTables: ["brands", "products", "orders"] }),
    /текущата схема/,
  );
});

test("allows complete backups for the current schema", () => {
  const payload = backup();

  assert.doesNotThrow(() =>
    validateBackupPayloadForRestore(payload, "replace", { currentTables: ["products", "brands"] }),
  );
});
