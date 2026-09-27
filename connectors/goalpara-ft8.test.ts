import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { goalparaFt8, verifyGoalparaFt8Index } from "./goalpara-ft8.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const index = readFileSync(new URL("../data/evidence/research/goalpara-recruitment-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/goalpara-ft8-copyist-2026.pdf", import.meta.url));
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/goalpara-ft8-copyist-2026.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((item) => item.id === "in-as-goalpara-ft8")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({ url, fetchedAt: "2026-09-25T04:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T04:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: index, evidence: evidence(url, Buffer.from(index), "text/html") }),
  fetchBytes: async (url) => ({ bytes: pdf, evidence: evidence(url, pdf, "application/pdf") }),
  ...override,
});

test("Goalpara FT-8 index binds original notice and result titles without candidate-list downloads", async () => {
  verifyGoalparaFt8Index(index);
  assert.throws(() => verifyGoalparaFt8Index(index.replace("Advertisement_0.pdf", "changed.pdf")), /register changed/);
  assert.throws(() => verifyGoalparaFt8Index(index.replace("Final selection for the post of Copyist TF-8, Goalpara", "3rd corrigendum for Copyist TF-8, Goalpara")), /register changed/);
  const fetched: string[] = [];
  await goalparaFt8(context({ fetchBytes: async (url) => {
    fetched.push(url);
    return { bytes: pdf, evidence: evidence(url, pdf, "application/pdf") };
  } }));
  assert.deepEqual(fetched, [extraction.advertisementUrl]);
});

test("Goalpara closed contractual Copyist separates nationality, language and district preference", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await goalparaFt8(context());
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 2);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "12:30");
  assert.equal(cycle.applicationWindow.officialTimeZone, "Asia/Kolkata");
  assert.match(cycle.scopeLabel, /temporary.*contractual/);
  assert.match(cycle.residenceRule, /tie-break preference/);
  assert.equal(cycle.rules?.languages?.length, 2);
  assert.match(cycle.rules!.languages![0].requirement, /no formal proficiency level/);
  assert.equal(cycle.venues[0].kind, "published");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "higher-secondary" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "higher-secondary" }).canApply.result, "needs-verification");
});

test("Goalpara changed scanned notice blocks old applicant rules", async () => {
  await assert.rejects(() => goalparaFt8(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /extracted rules withheld/);
});
