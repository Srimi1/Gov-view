import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { nitukNt08, verifyNitukNt08Index } from "./nituk-nt08-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/nituk-nt08-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; documentUrl: string; pdfSha256: string;
};
const index = readFileSync(new URL("../data/evidence/research/nituk-recruitments-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/nituk-nt08-2026.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-ut-nituk-nt08-2026")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, notice.indexUrl);
      return { text: index, evidence: evidence(url, Buffer.from(index), "text/html") };
    },
    fetchBytes: async (url) => {
      assert.equal(url, notice.documentUrl);
      const bytes = changed ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("NIT Uttarakhand exact register row and PDF gate all 2026 fields", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyNitukNt08Index(index));
  assert.throws(() => verifyNitukNt08Index(index.replace("21/09/2026", "22/09/2026")), /changed/);
  assert.throws(() => verifyNitukNt08Index(index.replace("17899664463960.pdf", "other.pdf")), /changed/);
  assert.throws(() => verifyNitukNt08Index(index.replace("<tr><td>09/2026", "<tr><td>08/2026")), /changed/);
  assert.equal(createHash("sha256").update(pdf).digest("hex"), notice.pdfSha256);
  const result = await nitukNt08(context());
  assert.equal(result.evidence.length, 2);
  assert.equal(result.complete, false);
  await assert.rejects(nitukNt08(context(true)), /PDF changed/);
});

test("NIT Uttarakhand counts portal choices, not vacancy pins, and separates foreign routes", async () => {
  const result = await nitukNt08(context());
  assert.equal(result.cycles.length, 15);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 15);
  assert.equal(result.cycles.reduce((count, cycle) => count + Number(/^(\d+) indicative/.exec(cycle.outcome)?.[1]), 0), 21);
  assert.equal(result.cycles.filter((cycle) => cycle.title.startsWith("Technical Assistant")).length, 5);
  assert.equal(result.cycles.filter((cycle) => cycle.title.startsWith("Technician (SG-II)")).length, 5);
  const mixed = result.cycles.find((cycle) => cycle.id.endsWith("superintendent"))!;
  const contract = result.cycles.find((cycle) => cycle.id.endsWith("junior-assistant"))!;
  assert.equal(mixed.appointmentType, undefined);
  assert.equal(contract.appointmentType, "contract");
  assert.equal(result.cycles.filter((cycle) => cycle.appointmentType === "contract").length, 4);
  assert.equal(mixed.applicationWindow.closesOn, "2026-11-04");
  assert.equal(mixed.applicationWindow.cutoffLocalTime, null);
  assert.equal(mixed.applicationWindow.officialTimeZone, null);
  assert.match(mixed.applicationWindow.note ?? "", /2026-11-11.*17:30/);
  assert.equal(mixed.rules?.nationality, undefined);
  assert.equal(evaluateEligibility(mixed.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.deepEqual(contract.rules?.nationality?.allowed, ["IN"]);
  assert.equal(evaluateEligibility(contract.rules, { nationality: "US" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(contract.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.equal(contract.rules?.languages, undefined);
  assert.match(contract.languageNote ?? "", /35 w\.p\.m\..*no typing language/);
  assert.equal(contract.venues[0].kind, "unknown");
  assert.equal((await nitukNt08(context(false, new Date("2026-11-06T00:00:00Z")))).cycles[0].status, "closed");
});
