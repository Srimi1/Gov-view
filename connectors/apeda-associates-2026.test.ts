import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { apedaAssociates2026, verifyApedaPages } from "./apeda-associates-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const root = new URL("../data/evidence/research/", import.meta.url);
const pages = ["apeda-recruitment-2026.html", "apeda-recruitment-archive-2026.html"]
  .map((name) => readFileSync(new URL(name, root), "utf8"));
const pdfs = ["legal", "trade"].map((name) => readFileSync(new URL(`apeda-associate-${name}-2026.pdf`, root)));
const config = JSON.parse(readFileSync(new URL("../data/extractions/apeda-associates-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; archiveUrl: string; roles: { pdfUrl: string }[];
};
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-apeda-associates-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-26T19:13:00Z",
  sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html" });
function context(now = new Date("2026-09-27T00:00:00Z"), changed = false): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      const i = [config.indexUrl, config.archiveUrl].indexOf(url); assert.ok(i >= 0);
      return { text: pages[i], evidence: evidence(url, Buffer.from(pages[i])) };
    },
    fetchBytes: async (url) => {
      const i = config.roles.findIndex((role) => role.pdfUrl === url); assert.ok(i >= 0);
      const bytes = changed && i === 0 ? Buffer.concat([pdfs[i], Buffer.from("material change")]) : pdfs[i];
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("APEDA amendments, prior editions and byte changes require review", async () => {
  assert.equal(source.enabled, false); assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyApedaPages(...pages as [string, string]));
  const amendment = '<div class="itmelist">Extension of Associate Legal deadline<br><a href="/sites/default/files/extension.pdf">Download</a></div>';
  assert.throws(() => verifyApedaPages(pages[0] + amendment, pages[1]), /amendment/);
  assert.throws(() => verifyApedaPages(pages[0], pages[1] + amendment), /amendment/);
  assert.throws(() => verifyApedaPages(pages[0].replace("Advertisement_Associate_Legal_27_08_2026.pdf", "replacement.pdf"), pages[1]), /changed/);
  assert.throws(() => verifyApedaPages(pages[0], pages[1].replace("Advertisement_Associate_Trade_06032026.pdf", "Advertisement_Associate_Trade_2027.pdf")), /changed/);
  await assert.rejects(apedaAssociates2026(context(undefined, true)), /PDF changed/);
});

test("APEDA NCS leads are closed contracts with uncertain foreign and language eligibility", async () => {
  const result = await apedaAssociates2026(context());
  assert.equal(result.complete, false); assert.equal(result.cycles.length, 2);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 2);
  assert.equal(result.evidence.length, 4);
  for (const cycle of result.cycles) {
    assert.equal(cycle.status, "closed"); assert.equal(cycle.appointmentType, "contract");
    assert.equal(cycle.applicationMethod, "email");
    assert.equal(cycle.applicationWindow.opensOn, null);
    assert.equal(cycle.applicationWindow.officialTimeZone, null);
    assert.equal(cycle.rules?.nationality, undefined);
    assert.equal(cycle.rules?.languages, undefined); assert.equal(cycle.rules?.age, undefined);
    assert.equal(cycle.rules?.asOn, null); assert.equal(cycle.venues[0].kind, "unknown");
    const foreign = evaluateEligibility(cycle.rules, { nationality: "US", education: "master", experienceYears: 10 });
    assert.equal(foreign.canApply.result, "needs-verification");
    assert.equal(foreign.canEnterSelection.result, "needs-verification");
    assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  }
  assert.equal(result.cycles[0].applicationWindow.closesOn, "2026-09-09");
  assert.equal(result.cycles[0].applicationWindow.cutoffLocalTime, "17:00");
  assert.equal(result.cycles[1].applicationWindow.closesOn, "2026-08-24");
  assert.equal(result.cycles[1].applicationWindow.cutoffLocalTime, null);
  assert.match(result.cycles[0].qualifications, /LL\.B/);
  assert.match(result.cycles[1].qualifications, /post-Master/);
});

test("APEDA unknown deadline zones never become inferred Indian cutoffs", async () => {
  const finalLegalDay = await apedaAssociates2026(context(new Date("2026-09-09T20:00:00Z")));
  assert.equal(finalLegalDay.cycles[0].status, "uncertain");
  const afterAllZones = await apedaAssociates2026(context(new Date("2026-09-10T12:01:00Z")));
  assert.equal(afterAllZones.cycles[0].status, "closed");
  const finalTradeDay = await apedaAssociates2026(context(new Date("2026-08-24T14:00:00Z")));
  assert.equal(finalTradeDay.cycles[1].status, "uncertain");
});
