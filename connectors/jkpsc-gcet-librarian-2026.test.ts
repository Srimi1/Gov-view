import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { jkpscGcetLibrarian2026, verifyJkpscHome } from "./jkpsc-gcet-librarian-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/jkpsc-gcet-librarian-2026.json", import.meta.url), "utf8")) as Record<string, string | number>;
const root = new URL("../data/evidence/research/", import.meta.url);
const home = readFileSync(new URL("jkpsc-home-2026.html", root), "utf8");
const urls = [data.originalUrl, data.corrigendumUrl, data.augustExtensionUrl, data.septemberExtensionUrl] as string[];
const hashes = [data.originalSha256, data.corrigendumSha256, data.augustExtensionSha256, data.septemberExtensionSha256];
const documents = ["backlog", "corrigendum", "aug-extension", "extension"].map((name) =>
  readFileSync(new URL(`jkpsc-hed-${name}-2026.pdf`, root)));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-jk-recruitment")!;

const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z",
  sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url === data.homepageUrl ? "text/html" : "application/pdf" });

function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, data.homepageUrl);
      const bytes = Buffer.from(home);
      return { text: home, evidence: evidence(url, bytes) };
    },
    fetchBytes: async (url) => {
      const index = urls.indexOf(url);
      assert.ok(index >= 0);
      const bytes = changed && index === 3 ? Buffer.concat([documents[index], Buffer.from("changed")]) : documents[index];
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("JKPSC official links and exact scanned notices gate extraction", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyJkpscHome(home));
  assert.throws(() => verifyJkpscHome(home.replaceAll("nid=18041&type=n", "nid=18042&type=n")), /changed/);
  documents.forEach((pdf, index) => assert.equal(evidence(urls[index], pdf).sha256, hashes[index]));
  await assert.rejects(jkpscGcetLibrarian2026(context(true)), /PDF changed/);
});

test("GCET Librarian draft uses latest deadline and preserves international-applicant uncertainty", async () => {
  const result = await jkpscGcetLibrarian2026(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "closed");
  assert.equal(cycle.applicationWindow.opensOn, "2026-08-01");
  assert.equal(cycle.applicationWindow.closesOn, "2026-09-18");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.rules?.asOn, "2026-08-31");
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.residence, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.changes.filter((change) => change.kind === "extended").length, 2);
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US", residenceCountry: "US" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canEnterSelection.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  assert.equal((await jkpscGcetLibrarian2026(context(false, new Date("2026-09-18T12:00:00Z")))).cycles[0].status, "uncertain");
});
