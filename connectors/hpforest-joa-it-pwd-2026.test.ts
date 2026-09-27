import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { hpForestJoaItPwd2026, verifyHpForestRegister } from "./hpforest-joa-it-pwd-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/hpforest-joa-it-pwd-2026.json", import.meta.url), "utf8")) as {
  registerUrl: string; noticeUrl: string; noticeSha256: string;
};
const register = readFileSync(new URL("../data/evidence/research/hpforest-recruitments-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/hpforest-joa-it-pwd-2026.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-hp-forest-joa-it-pwd-2026")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html",
});
function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, data.registerUrl);
      return { text: register, evidence: evidence(url, Buffer.from(register)) };
    },
    fetchBytes: async (url) => {
      assert.equal(url, data.noticeUrl);
      const bytes = changed ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("HP Forest register and exact scanned PDF gate JOA extraction", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyHpForestRegister(register));
  assert.throws(() => verifyHpForestRegister(register.replace("JOA%20IT%20PWD.pdf", "changed.pdf")), /changed/);
  assert.throws(() => verifyHpForestRegister(register.replace("Physically handicapped quota", "Physically handicapped quota — corrigendum")), /changed/);
  assert.throws(() => verifyHpForestRegister(register.replace("</li>", "</li><li>Junior office Assistant corrigendum</li>")), /changed/);
  assert.equal(evidence(data.noticeUrl, pdf).sha256, data.noticeSha256);
  await assert.rejects(hpForestJoaItPwd2026(context(true)), /PDF changed/);
});

test("HP Forest conflict stays unresolved; foreign outcome fails Indian-citizen criterion", async () => {
  const result = await hpForestJoaItPwd2026(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.id, "hpforest-joa-it-pwbd-2026");
  assert.equal(cycle.appointmentType, "contract");
  assert.equal(cycle.status, "uncertain");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, null);
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.match(cycle.applicationWindow.note ?? "", /30 September 2026.*10 October 2026/);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.rules?.nationality?.stage, "outcome");
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US", residenceCountry: "IN", residenceSubdivision: "IN-HP" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", residenceCountry: "US", residenceSubdivision: "US-CA" }).canApply.result, "does-not-match");
  assert.equal((await hpForestJoaItPwd2026(context(false, new Date("2026-10-11T00:00:00Z")))).cycles[0].status, "closed");
});
