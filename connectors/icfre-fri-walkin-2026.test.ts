import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { icfreFriWalkin2026, verifyIcfreFriIndex } from "./icfre-fri-walkin-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const extraction = JSON.parse(readFileSync(new URL("../data/extractions/icfre-fri-walkin-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; noticeUrl: string; noticeSha256: string;
};
const html = readFileSync(new URL("../data/evidence/research/icfre-updates-2026-09-25.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/icfre-fri-walkin-september-2026.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-uk-icfre-fri-walkin-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"),
  bytes: bytes.length, contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html",
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => ({ text: html, evidence: evidence(url, Buffer.from(html)) }),
    fetchBytes: async (url) => {
      const bytes = changed ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("FRI exact index row and PDF gate both walk-in dates", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyIcfreFriIndex(html));
  assert.throws(() => verifyIcfreFriIndex(html.replaceAll("21 Sep 2026", "22 Sep 2026")), /index changed/);
  assert.throws(() => verifyIcfreFriIndex(html.replaceAll("vacancy1114.44.pdf", "different.pdf")), /index changed/);
  assert.equal(evidence(extraction.noticeUrl, pdf).sha256, extraction.noticeSha256);
  assert.equal((await icfreFriWalkin2026(context())).evidence.length, 2);
  await assert.rejects(icfreFriWalkin2026(context(true)), /PDF changed/);
});

test("FRI walk-in dates are separate cycles with temporary type and uncertain foreign and language rules", async () => {
  const result = await icfreFriWalkin2026(context());
  assert.equal(result.cycles.length, 2);
  assert.deepEqual(result.cycles.map((item) => item.applicationWindow.closesOn), ["2026-10-01", "2026-10-05"]);
  assert.deepEqual(result.cycles.map((item) => item.applicationWindow.cutoffLocalTime), ["10:15", "10:15"]);
  for (const cycle of result.cycles) {
    assert.equal(cycle.pathway, "recruitment");
    assert.equal(cycle.appointmentType, "temporary");
    assert.equal(cycle.applicationMethod, "in-person");
    assert.equal(cycle.applicationWindow.officialTimeZone, null);
    assert.equal(cycle.rules?.nationality, undefined);
    assert.equal(cycle.rules?.languages, undefined);
    assert.equal(cycle.venues[0].kind, "published");
    const foreign = evaluateEligibility(cycle.rules, { nationality: "US" });
    assert.equal(foreign.canApply.result, "needs-verification");
    assert.equal(foreign.canEnterSelection.result, "needs-verification");
    assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  }
  assert.match(result.cycles[0].outcome, /does not guarantee subsequent employment/i);
  assert.equal((await icfreFriWalkin2026(context(false, new Date("2026-10-06T00:00:00Z")))).cycles.every((item) => item.status === "closed"), true);
});
