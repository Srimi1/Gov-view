import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { jkssbNotices, verifyJkssb08Pages, verifyJkssbClassIvPages } from "./jkssb-notices.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";

const advertisements = readFileSync(new URL("../data/evidence/research/jkssb-advertisements-2026-09-25.html", import.meta.url), "utf8");
const whatsNew = readFileSync(new URL("../data/evidence/research/jkssb-whatsnew-2026-09-25.html", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../data/evidence/research/jkssb-home-2026-09-25.html", import.meta.url), "utf8");
const pdf09 = readFileSync(new URL("../data/evidence/research/jkssb-09-2026-original.pdf", import.meta.url));
const pdf08 = readFileSync(new URL("../data/evidence/research/jkssb-08-2026-original.pdf", import.meta.url));
const instructions08 = readFileSync(new URL("../data/evidence/research/jkssb-08-2026-application-instructions.pdf", import.meta.url));
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/jkssb-class-iv-09-2026.json", import.meta.url), "utf8"));
const open08 = JSON.parse(readFileSync(new URL("../data/extractions/jkssb-08-2026-groups.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = registry.find((item) => item.id === "in-jk-jkssb")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({ url, fetchedAt: "2026-09-25T04:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T04:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const text = url === extraction.advertisementsUrl ? advertisements : url === extraction.whatsNewUrl ? whatsNew : homepage;
    return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
  },
  fetchBytes: async (url) => {
    const bytes = url === extraction.advertisementUrl ? pdf09 : url === open08.advertisementUrl ? pdf08 : instructions08;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("JKSSB exact notice requires official index, update register and original PDF", async () => {
  verifyJkssbClassIvPages(advertisements, whatsNew);
  verifyJkssb08Pages(advertisements, whatsNew, homepage);
  assert.throws(() => verifyJkssbClassIvPages(advertisements.replace("ADVT_09OF2026_01092026.pdf", "changed.pdf"), whatsNew), /changed/);
  assert.throws(() => verifyJkssbClassIvPages(advertisements, whatsNew.replace("advertisement notification no. 09 of 2026", "amended advertisement notification no. 09 of 2026")), /changed/);
  assert.throws(() => verifyJkssb08Pages(advertisements.replace("Advertisement_08OF2026_04082026.pdf", "changed.pdf"), whatsNew, homepage), /changed/);
  assert.throws(() => verifyJkssb08Pages(advertisements, whatsNew.replace("notice_09092026.pdf", "changed.pdf"), homepage), /changed/);
  assert.throws(() => verifyJkssb08Pages(advertisements, whatsNew, homepage.replace("Apply for Various Posts", "Old Posts")), /changed/);
  const result = await jkssbNotices(context());
  assert.equal(result.evidence.length, 6);
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 3);
});

test("JKSSB 09/2026 keeps domicile and foreign nationality separate", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const [cycle] = (await jkssbNotices(context())).cycles;
  assert.equal(cycle.status, "upcoming");
  assert.equal(cycle.applicationWindow.opensOn, "2026-10-05");
  assert.equal(cycle.applicationWindow.closesOn, "2026-11-03");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.precision, "date");
  assert.match(cycle.outcome, /2,863/);
  assert.match(cycle.qualifications, /Sanitation Worker: minimum 8th pass/);
  assert.match(cycle.residenceRule, /domicile certificate/);
  assert.match(cycle.citizenshipRule, /does not explicitly state a nationality rule/);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.residence, undefined);
  assert.match(cycle.rules!.languages![0].requirement, /no CEFR level/);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.applicationUrl, null);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", residenceCountry: "US", education: "higher-secondary" }).canApply.result, "needs-verification");
});

test("JKSSB date-only window changes status without an invented cutoff hour", async () => {
  const open = (await jkssbNotices(context({ now: new Date("2026-10-05T00:00:00Z") }))).cycles[0];
  const closed = (await jkssbNotices(context({ now: new Date("2026-11-03T18:30:00Z") }))).cycles[0];
  assert.equal(open.status, "open");
  assert.equal(closed.status, "closed");
});

test("JKSSB changed PDF withholds previously extracted eligibility and dates", async () => {
  await assert.rejects(() => jkssbNotices(context({ fetchBytes: async (url) => {
    const bytes = Buffer.concat([pdf09, Buffer.from("changed")]);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /extracted rules withheld/);
});

test("JKSSB 08/2026 groups district items without venue or international claims", async () => {
  const { cycles, warnings } = await jkssbNotices(context());
  const horticulture = cycles.find((cycle) => cycle.id === "jkssb-08-2026-horticulture-technician-grade-iv")!;
  const pharmacist = cycles.find((cycle) => cycle.id === "jkssb-08-2026-junior-pharmacist")!;
  assert.equal(horticulture.status, "open");
  assert.match(horticulture.outcome, /^45 advertised/);
  assert.match(pharmacist.outcome, /^211 advertised/);
  assert.match(warnings[0], /256 of 518/);
  assert.equal(horticulture.applicationWindow.closesOn, "2026-10-09");
  assert.equal(pharmacist.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(pharmacist.applicationWindow.cutoffInclusive, true);
  assert.equal(pharmacist.applicationWindow.precision, "minute");
  assert.match(pharmacist.qualifications, /10\+2 with Science/);
  assert.match(pharmacist.residenceRule, /domicile certificate/);
  assert.equal(pharmacist.rules?.nationality, undefined);
  assert.equal(pharmacist.rules?.residence, undefined);
  assert.match(pharmacist.rules!.languages![0].requirement, /No CEFR level/);
  assert.equal(pharmacist.venues[0].kind, "unknown");
  assert.equal(pharmacist.applicationUrl, open08.applicationUrl);
  assert.equal(evaluateEligibility(pharmacist.rules, { nationality: "US", residenceCountry: "US", education: "higher-secondary" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(pharmacist.rules, { nationality: "IN", education: "secondary" }).canApply.result, "does-not-match");
});

test("JKSSB 08/2026 23:59 local cutoff is inclusive at minute precision", async () => {
  const atCutoff = (await jkssbNotices(context({ now: new Date("2026-10-09T23:59:40+05:30") }))).cycles[2];
  const afterCutoff = (await jkssbNotices(context({ now: new Date("2026-10-10T00:00:00+05:30") }))).cycles[2];
  assert.equal(atCutoff.status, "open");
  assert.equal(afterCutoff.status, "closed");
});

test("JKSSB changed 08/2026 instructions withhold precise application cutoff", async () => {
  await assert.rejects(() => jkssbNotices(context({ fetchBytes: async (url) => {
    const original = url === extraction.advertisementUrl ? pdf09 : url === open08.advertisementUrl ? pdf08 : instructions08;
    const bytes = url === open08.instructionsUrl ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /extracted rules withheld/);
});
