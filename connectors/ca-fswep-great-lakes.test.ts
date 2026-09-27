import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { caFswepGreatLakes, verifyGreatLakesCard } from "./ca-fswep-great-lakes.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const indexUrl = "https://www.canada.ca/en/public-service-commission/jobs/services/recruitment/students/federal-student-work-program.html";
const html = readFileSync(new URL("../data/evidence/research/ca-fswep-2026-09-25.html", import.meta.url), "utf8");
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "ca-fswep-great-lakes")!;
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    assert.equal(url, indexUrl);
    const bytes = Buffer.from(html);
    const evidence: Evidence = { url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: "text/html", bytes: bytes.length };
    return { text: html, evidence };
  },
  ...override,
});

test("Canada FSWEP card binds named 2027 programme, date, poster and general criteria", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyGreatLakesCard(html));
  assert.throws(() => verifyGreatLakesCard(html.replace("October 28, 2026", "October 29, 2026")), /changed/);
  assert.throws(() => verifyGreatLakesCard(html.replace("poster=2042", "poster=2043")), /changed/);
  assert.throws(() => verifyGreatLakesCard(html.replace("Preference will be given to Canadian citizens and permanent residents", "Citizens only")), /changed/);
  const result = await caFswepGreatLakes(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 1);
});

test("Canada pilot leaves international eligibility, language and cutoff zone unresolved", async () => {
  const cycle = (await caFswepGreatLakes(context())).cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-28");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.applicationUrl, "https://emploisfp-psjobs.cfp-psc.gc.ca/srs-sre/page01.html?poster=2042&lang=en");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "bachelor" }).canApply.result, "needs-verification");
  assert.equal((await caFswepGreatLakes(context({ now: new Date("2026-10-29T11:59:00Z") }))).cycles[0].status, "open");
  assert.equal((await caFswepGreatLakes(context({ now: new Date("2026-10-29T12:00:00Z") }))).cycles[0].status, "closed");
});
