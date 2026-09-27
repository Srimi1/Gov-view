import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { nzGovJobs, verifyNzJob } from "./nz-gov-jobs.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const listings = JSON.parse(readFileSync(new URL("../data/extractions/nz-gov-jobs-2026.json", import.meta.url), "utf8")) as { url: string; reference: string }[];
const pages = [
  readFileSync(new URL("../data/evidence/research/nz-gov-probation-2026-09-25.html", import.meta.url), "utf8"),
  readFileSync(new URL("../data/evidence/research/nz-gov-msd-2026-09-25.html", import.meta.url), "utf8"),
];
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "nz-gov-jobs")!;
function context(now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      const index = listings.findIndex((item) => item.url === url);
      assert.notEqual(index, -1);
      const text = pages[index];
      const bytes = Buffer.from(text);
      const evidence: Evidence = { url, fetchedAt: now.toISOString(), sha256: createHash("sha256").update(bytes).digest("hex"), contentType: "text/html", bytes: bytes.length };
      return { text, evidence };
    },
  };
}

test("NZ pilot binds both official job articles, details and apply targets", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  for (const [index, listing] of listings.entries()) {
    assert.doesNotThrow(() => verifyNzJob(pages[index], listing as Parameters<typeof verifyNzJob>[1]));
    assert.throws(() => verifyNzJob(pages[index].replace("04-Oct-2026", "05-Oct-2026"), listing as Parameters<typeof verifyNzJob>[1]), /changed/);
    assert.throws(() => verifyNzJob(pages[index].replace("id=\"ApplyURL\"", "id=\"OtherURL\""), listing as Parameters<typeof verifyNzJob>[1]), /changed/);
  }
  assert.throws(() => verifyNzJob(pages[0].replace("legal right to work in New Zealand", "NZ citizenship only"), listings[0] as Parameters<typeof verifyNzJob>[1]), /changed/);
  assert.throws(() => verifyNzJob(pages[1].replace("Candidates must hold NZ citizenship or a Permanent Resident visa at the time of application", "All applicants welcome"), listings[1] as Parameters<typeof verifyNzJob>[1]), /changed/);
  const result = await nzGovJobs(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 2);
  assert.equal(result.evidence.length, 2);
});

test("NZ drafts keep foreign work rights, PR alternative, language and cutoff zone separate", async () => {
  const [probation, msd] = (await nzGovJobs(context())).cycles;
  assert.equal(probation.pathway, "recruitment");
  assert.equal(msd.pathway, "recruitment");
  assert.equal(probation.appointmentType, "permanent");
  assert.equal(msd.appointmentType, "permanent");
  assert.equal(probation.applicationWindow.closesOn, "2026-10-04");
  assert.equal(probation.applicationWindow.cutoffLocalTime, null);
  assert.equal(msd.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(probation.applicationWindow.officialTimeZone, null);
  assert.equal(msd.applicationWindow.officialTimeZone, null);
  assert.match(probation.citizenshipRule, /legal right to work/);
  assert.match(msd.citizenshipRule, /citizenship OR a Permanent Resident visa/);
  assert.equal(probation.rules?.nationality, undefined);
  assert.equal(msd.rules?.nationality, undefined);
  assert.equal(probation.rules?.languages, undefined);
  assert.equal(msd.rules?.languages, undefined);
  assert.equal(evaluateEligibility(probation.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(msd.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.equal(probation.venues[0].kind, "unknown");
  assert.equal(msd.venues[0].kind, "unknown");
  assert.equal((await nzGovJobs(context(new Date("2026-10-05T11:59:00Z")))).cycles[0].status, "open");
  assert.equal((await nzGovJobs(context(new Date("2026-10-05T12:00:00Z")))).cycles[0].status, "closed");
});
