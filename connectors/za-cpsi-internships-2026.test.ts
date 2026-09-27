import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { verifyCpsiCircular, zaCpsiInternships2026 } from "./za-cpsi-internships-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/za-cpsi-internships-2026.json", import.meta.url), "utf8")) as {
  circularUrl: string; annexureUrl: string; annexureSha256: string;
};
const html = readFileSync(new URL("../data/evidence/research/za-dpsa-circular-34-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/za-dpsa-circular-34-2026-cpsi.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "za-dpsa-cpsi-internships-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html",
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, data.circularUrl);
      return { text: html, evidence: evidence(url, Buffer.from(html)) };
    },
    fetchBytes: async (url) => {
      assert.equal(url, data.annexureUrl);
      const bytes = changed ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("DPSA circular binds CPSI link and exact annexure bytes", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyCpsiCircular(html));
  assert.throws(() => verifyCpsiCircular(html.replace("18 September 2026", "19 September 2026")), /changed/);
  assert.throws(() => verifyCpsiCircular(html.replace("2026/34/b.pdf", "2026/34/revised.pdf")), /changed/);
  assert.equal(evidence(data.annexureUrl, pdf).sha256, data.annexureSha256);
  await assert.rejects(zaCpsiInternships2026(context(true)), /PDF changed/);
});

test("CPSI two post references remain distinct; international eligibility and cutoff zone stay uncertain", async () => {
  const result = await zaCpsiInternships2026(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 2);
  assert.deepEqual(result.cycles.map((cycle) => cycle.id), [
    "za-cpsi-internal-audit-intern-2026-0003", "za-cpsi-legal-services-intern-2026-0004",
  ]);
  for (const cycle of result.cycles) {
    assert.equal(cycle.appointmentType, "contract");
    assert.equal(cycle.status, "open");
    assert.equal(cycle.applicationWindow.opensOn, null);
    assert.equal(cycle.applicationWindow.closesOn, "2026-10-05");
    assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
    assert.equal(cycle.applicationWindow.officialTimeZone, null);
    assert.equal(cycle.venues[0].kind, "unknown");
    assert.deepEqual(cycle.workLocations, ["Pretoria, South Africa"]);
    assert.equal(cycle.rules?.nationality, undefined);
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
    assert.equal(cycle.rules?.languages, undefined);
  }
  assert.equal((await zaCpsiInternships2026(context(false, new Date("2026-10-05T12:00:00Z")))).cycles[0].status, "uncertain");
  assert.equal((await zaCpsiInternships2026(context(false, new Date("2026-10-06T00:00:00Z")))).cycles[0].status, "closed");
});
