import assert from "node:assert/strict";
import test from "node:test";
import { filterSourceDirectory, readSourceFilters, sourceFilterSearch } from "./source-directory.ts";

const jurisdictions = [{ code: "IN-MP", name: "Madhya Pradesh" }, { code: "IN-PB", name: "Punjab" }];
const entries = [
  { id: "mp", name: "MP Board", authority: "MP", notes: "Hindi typing, Indian citizenship; Punjab applicants need review", jurisdictions: [jurisdictions[0]] },
  { id: "pb", name: "Punjab Board", authority: "Punjab", notes: "Punjabi requirement", jurisdictions: [jurisdictions[1]] },
  { id: "unscoped", name: "Federal Register", authority: "Union", notes: "Hindi examination medium", jurisdictions: [] },
];

test("state scope uses recorded jurisdiction, never a mention in eligibility research", () => {
  assert.deepEqual(filterSourceDirectory(entries, { query: "", jurisdiction: "IN-PB", includeUnscoped: false }).map(x => x.id), ["pb"]);
  assert.deepEqual(filterSourceDirectory(entries, { query: "Hindi", jurisdiction: "IN-MP", includeUnscoped: false }).map(x => x.id), ["mp"]);
});

test("sources without recorded state scope are opt-in for a selected state", () => {
  assert.deepEqual(filterSourceDirectory(entries, { query: "Hindi", jurisdiction: "IN-MP", includeUnscoped: true }).map(x => x.id), ["mp", "unscoped"]);
  assert.equal(filterSourceDirectory(entries, { query: "", jurisdiction: "", includeUnscoped: false }).length, 3);
  assert.deepEqual(filterSourceDirectory(entries, { query: "", jurisdiction: "IN-LD", includeUnscoped: false }), []);
});

test("shared source filters restore public fields and reject unknown jurisdiction codes", () => {
  const parsed = readSourceFilters("?state=IN-MP&sourceQuery=Hindi+typing&unscoped=1&citizenship=US&profileId=secret", jurisdictions);
  assert.deepEqual(parsed, { query: "Hindi typing", jurisdiction: "IN-MP", includeUnscoped: true });
  const search = sourceFilterSearch(parsed);
  assert.equal(search.includes("citizenship"), false);
  assert.equal(search.includes("profile"), false);
  assert.deepEqual(readSourceFilters(search, jurisdictions), parsed);
  assert.equal(readSourceFilters("?state=US-CA", jurisdictions).jurisdiction, "");
  assert.equal(readSourceFilters("?sourceQuery=" + "a".repeat(500), jurisdictions).query.length, 200);
});

test("clear filters restores every source and emits no private or saved state", () => {
  const cleared = { query: "", jurisdiction: "", includeUnscoped: false };
  assert.equal(sourceFilterSearch(cleared), "");
  assert.equal(filterSourceDirectory(entries, cleared).length, entries.length);
});
