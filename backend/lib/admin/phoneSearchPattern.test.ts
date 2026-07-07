import assert from "node:assert/strict";
import {
  extractBgMobileCore,
  phoneFlexibleIlikePatterns,
  queryLooksLikePhone,
} from "./phoneSearchPattern";

function ilikeMatch(pattern: string, text: string): boolean {
  const re = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`, "i");
  return re.test(text);
}

function assertFinds(query: string, stored: string) {
  const patterns = phoneFlexibleIlikePatterns(query);
  assert.ok(patterns.length > 0, `no patterns for query ${query}`);
  assert.ok(
    patterns.some((p) => ilikeMatch(p, stored)),
    `query "${query}" did not match stored "${stored}"`,
  );
}

const storedFormats = [
  "0898 686 698",
  "+359 898 686 698",
  "0898686698",
  "+359898686698",
];

const queries = [
  "0898686698",
  "0898 686 698",
  "+359898686698",
  "+359 898 686 698",
  "898686698",
  "359898686698",
  "98686698",
];

for (const q of queries) {
  assert.ok(queryLooksLikePhone(q), `expected phone query: ${q}`);
  for (const stored of storedFormats) {
    assertFinds(q, stored);
  }
}

assert.ok(!queryLooksLikePhone("ВАНС"));
console.log("phoneSearchPattern.test.ts OK");
