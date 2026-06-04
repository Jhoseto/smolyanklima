import assert from "node:assert/strict";
import {
  buildAdminSearchOrFilter,
  phoneFlexibleIlikePattern,
  phoneFlexibleIlikePatterns,
} from "../lib/admin/phoneSearchPattern";
import {
  canServiceStaffAccessAcceptanceProtocol,
  canServiceStaffAccessRepairProtocol,
  scopeAcceptanceProtocolQueryForSession,
  scopeRepairProtocolQueryForSession,
} from "../lib/admin/serviceProtocolAccess";

function testPhonePatternFormats() {
  const patterns = phoneFlexibleIlikePatterns("0887 123 456");
  assert.ok(patterns.length >= 2, "BG phone search should include 0... and 359... variants");
  assert.equal(patterns[0], "%0%8%8%7%1%2%3%4%5%6%");
  assert.ok(patterns.includes("%3%5%9%8%8%7%1%2%3%4%5%6%"));
  assert.ok(patterns.every((pattern) => pattern.includes("%")));
  assert.ok(patterns.every((pattern) => !pattern.includes("*")));
  assert.equal(phoneFlexibleIlikePattern("+359 887 123 456"), "%0%8%8%7%1%2%3%4%5%6%");

  const postgrestFilter = buildAdminSearchOrFilter("0887 123 456", {
    textFields: ["client_name", "client_phone"],
    phoneFields: ["client_phone"],
  });
  assert.ok(postgrestFilter, "phone-like search should build a PostgREST OR filter");
  assert.ok(postgrestFilter.includes('client_phone.ilike."*0*8*8*7*1*2*3*4*5*6*"'));
  assert.ok(!postgrestFilter.includes("%0%8%8%7%1%2%3%4%5%6%"));
}

function testProtocolAccessRules() {
  assert.equal(canServiceStaffAccessAcceptanceProtocol({ created_by: "tech-a", work_item_id: null }, "tech-a"), true);
  assert.equal(canServiceStaffAccessAcceptanceProtocol({ created_by: "tech-b", work_item_id: "work-1" }, "tech-a"), true);
  assert.equal(canServiceStaffAccessAcceptanceProtocol({ created_by: "tech-b", work_item_id: null }, "tech-a"), false);
  assert.equal(canServiceStaffAccessAcceptanceProtocol(null, "tech-a"), false);

  assert.equal(canServiceStaffAccessRepairProtocol({ created_by: "tech-a" }, "tech-a"), true);
  assert.equal(canServiceStaffAccessRepairProtocol({ created_by: "tech-b" }, "tech-a"), false);
  assert.equal(canServiceStaffAccessRepairProtocol(null, "tech-a"), false);
}

function testProtocolQueryScopes() {
  const acceptanceQuery = {
    filters: [] as string[],
    or(filter: string) {
      this.filters.push(filter);
      return this;
    },
  };
  scopeAcceptanceProtocolQueryForSession(acceptanceQuery, { role: "service_staff", userId: "tech-a" });
  assert.deepEqual(acceptanceQuery.filters, ["created_by.eq.tech-a,work_item_id.not.is.null"]);

  const unscopedAcceptanceQuery = {
    filters: [] as string[],
    or(filter: string) {
      this.filters.push(filter);
      return this;
    },
  };
  scopeAcceptanceProtocolQueryForSession(unscopedAcceptanceQuery, { role: "office_staff", userId: "office-a" });
  assert.deepEqual(unscopedAcceptanceQuery.filters, []);

  const repairQuery = {
    filters: [] as Array<[string, string]>,
    eq(column: string, value: string) {
      this.filters.push([column, value]);
      return this;
    },
  };
  scopeRepairProtocolQueryForSession(repairQuery, { role: "service_staff", userId: "tech-a" });
  assert.deepEqual(repairQuery.filters, [["created_by", "tech-a"]]);

  const unscopedRepairQuery = {
    filters: [] as Array<[string, string]>,
    eq(column: string, value: string) {
      this.filters.push([column, value]);
      return this;
    },
  };
  scopeRepairProtocolQueryForSession(unscopedRepairQuery, { role: "master_admin", userId: "admin-a" });
  assert.deepEqual(unscopedRepairQuery.filters, []);
}

testPhonePatternFormats();
testProtocolAccessRules();
testProtocolQueryScopes();

console.log("Critical bug regression checks passed");
