import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { ignouNonteaching2026, verifyIgnouNonteachingIndex } from "./ignou-nonteaching-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const details = JSON.parse(readFileSync(new URL("../data/extractions/ignou-nonteaching-69-2026.json", import.meta.url), "utf8")) as {
  indexUrl: string; documentUrl: string; documentSha256: string;
};
const html = readFileSync(new URL("../data/evidence/research/ignou-career-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/ignou-nonteaching-69-2026.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-dl-ignou-nonteaching-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T12:49:06Z", sha256: createHash("sha256").update(bytes).digest("hex"),
  bytes: bytes.length, contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html",
});
function context(now = new Date("2026-09-25T12:00:00Z"), changedPdf = false): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => ({ text: html, evidence: evidence(url, Buffer.from(html)) }),
    fetchBytes: async (url) => {
      const bytes = changedPdf ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("IGNOU index and exact PDF gate extracted advertisement", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.equal(evidence(details.documentUrl, pdf).sha256, details.documentSha256);
  assert.doesNotThrow(() => verifyIgnouNonteachingIndex(html));
  assert.throws(() => verifyIgnouNonteachingIndex(html.replace("02.11.2026", "03.11.2026")), /index.*changed/);
  assert.throws(() => verifyIgnouNonteachingIndex(`${html}<p>Corrigendum to non-teaching recruitment</p>`), /index.*changed/);
  await assert.rejects(ignouNonteaching2026(context(undefined, true)), /PDF changed/);
});

test("IGNOU draft separates twelve post choices, conditional foreign routes and unknown language level", async () => {
  const result = await ignouNonteaching2026(context());
  assert.equal(result.cycles.length, 12);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 12);
  assert.equal(result.cycles.reduce((sum, cycle) => sum + Number(/^\d+/.exec(cycle.outcome)?.[0] ?? 0), 0), 14);
  assert.equal(result.complete, false);
  for (const cycle of result.cycles) {
    assert.equal(cycle.applicationWindow.opensOn, "2026-10-03");
    assert.equal(cycle.applicationWindow.closesOn, "2026-11-02");
    assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59:59");
    assert.equal(cycle.applicationWindow.officialTimeZone, null);
    assert.equal(cycle.status, "upcoming");
    assert.equal(cycle.rules?.languages, undefined);
    assert.equal(cycle.venues[0].kind, "unknown");
    assert.equal(cycle.applicationUrl, null);
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "NP" }).canApply.result, "needs-verification");
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "does-not-match");
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "PK" }).canApply.result, "needs-verification");
    const pakistaniReason = evaluateEligibility(cycle.rules, { nationality: "PK" }).canApply.checks.find((check) => check.rule === "nationality")!.reason;
    assert.match(pakistaniReason, /Indian-origin migrants.*Nationality alone/i);
    assert.doesNotMatch(pakistaniReason, /conflict/i);
    assert.match(evaluateEligibility(cycle.rules, { nationality: "NP" }).canObtainOutcome.checks.find((check) => check.rule === "nationality")!.reason, /certificate.*before appointment/i);
  }
  assert.equal((await ignouNonteaching2026(context(new Date("2026-11-04T00:00:00Z")))).cycles.every((cycle) => cycle.status === "closed"), true);
});
