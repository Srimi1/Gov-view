import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { mpesbPcrt2026, verifyMpesbForm, verifyMpesbHome } from "./mpesb-pcrt-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const extraction = JSON.parse(readFileSync(new URL("../data/extractions/mpesb-pcrt-2026.json", import.meta.url), "utf8")) as Record<string, string>;
const home = readFileSync(new URL("../data/evidence/research/mpesb-home-2026-09-25.html", import.meta.url), "utf8");
const forms = readFileSync(new URL("../data/evidence/research/mpesb-forms-2026-09-25.html", import.meta.url), "utf8");
const rulebook = readFileSync(new URL("../data/evidence/research/mpesb-pcrt-2026-rulebook.pdf", import.meta.url));
const revised = readFileSync(new URL("../data/evidence/research/mpesb-pcrt-2026-revised-page.pdf", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-mp-esb-police-gd")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
function context(now = new Date("2026-09-25T00:00:00Z"), changedRulebook = false): ConnectorContext {
  return {
    source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.ok([extraction.homeUrl, extraction.formsUrl].includes(url));
      const text = url === extraction.homeUrl ? home : forms;
      return { text, evidence: evidence(url, Buffer.from(text), "text/html") };
    },
    fetchBytes: async (url) => {
      assert.ok([extraction.rulebookUrl, extraction.revisedUrl].includes(url));
      const bytes = url === extraction.rulebookUrl ? (changedRulebook ? Buffer.concat([rulebook, Buffer.from("changed")]) : rulebook) : revised;
      return { bytes, evidence: evidence(url, bytes, "application/pdf") };
    },
  };
}

test("MPESB live form binds one police cycle and both exact Hindi rulebook documents", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyMpesbHome(home));
  assert.doesNotThrow(() => verifyMpesbForm(forms));
  assert.throws(() => verifyMpesbHome(home.replace("PCRT_2026_Rulebook_Revised_Page_01_15092026.pdf", "other.pdf")), /changed/);
  assert.throws(() => verifyMpesbForm(forms.replace("06 Oct 2026", "07 Oct 2026")), /changed/);
  assert.throws(() => verifyMpesbForm(forms.replace("id=90", "id=91")), /changed/);
  assert.equal(createHash("sha256").update(rulebook).digest("hex"), extraction.rulebookSha256);
  assert.equal(createHash("sha256").update(revised).digest("hex"), extraction.revisedSha256);
  const result = await mpesbPcrt2026(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 4);
  await assert.rejects(mpesbPcrt2026(context(undefined, true)), /document changed/);
});

test("MP police draft excludes foreign citizens without inventing Hindi level or cutoff time", async () => {
  const cycle = (await mpesbPcrt2026(context())).cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.deepEqual(cycle.subdivisionCodes, ["IN-MP"]);
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-22");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-06");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.deepEqual(cycle.rules?.nationality?.allowed, ["IN"]);
  assert.equal(cycle.rules?.languages, undefined);
  assert.match(cycle.languageNote ?? "", /Hindi/);
  assert.match(cycle.applicationWindow.note ?? "", /correction/);
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "needs-verification");
  assert.equal((await mpesbPcrt2026(context(new Date("2026-10-07T11:59:00Z")))).cycles[0].status, "open");
  assert.equal((await mpesbPcrt2026(context(new Date("2026-10-07T12:00:00Z")))).cycles[0].status, "closed");
});
