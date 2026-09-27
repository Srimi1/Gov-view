import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { venueText } from "../lib/format.ts";
import { icmrNithrYp1Admin2026, verifyIcmrNithrRow } from "./icmr-nithr-yp1-admin-2026.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const data = JSON.parse(readFileSync(new URL("../data/extractions/icmr-nithr-yp1-admin-2026.json", import.meta.url), "utf8")) as Record<string, string | number>;
const root = new URL("../data/evidence/research/", import.meta.url);
const index = readFileSync(new URL("icmr-employment-2026.html", root), "utf8");
const urls = [data.englishUrl, data.hindiUrl] as string[];
const hashes = [data.englishSha256, data.hindiSha256];
const pdfs = ["icmr-nithr-yp1-admin-2026.pdf", "icmr-nithr-yp1-admin-2026-hindi.pdf"].map((name) => readFileSync(new URL(name, root)));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "in-icmr-nithr-yp1-admin-2026")!;

const evidence = (url: string, bytes: Buffer): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z",
  sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
  contentType: url === data.indexUrl ? "text/html" : "application/pdf" });

function context(changed = false, now = new Date("2026-09-25T00:00:00Z")): ConnectorContext {
  return { source, now, env: {}, log: () => {},
    fetchText: async (url) => {
      assert.equal(url, data.indexUrl);
      return { text: index, evidence: evidence(url, Buffer.from(index)) };
    },
    fetchBytes: async (url) => {
      const index = urls.indexOf(url);
      assert.ok(index >= 0);
      const bytes = changed && index === 1 ? Buffer.concat([pdfs[index], Buffer.from("changed")]) : pdfs[index];
      return { bytes, evidence: evidence(url, bytes) };
    },
  };
}

test("ICMR role row and both exact language notices gate extraction", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyIcmrNithrRow(index));
  assert.throws(() => verifyIcmrNithrRow(index.replaceAll("1790224152_yps_eng.pdf", "replacement.pdf")), /changed/);
  pdfs.forEach((pdf, index) => assert.equal(evidence(urls[index], pdf).sha256, hashes[index]));
  await assert.rejects(icmrNithrYp1Admin2026(context(true)), /PDF changed/);
});

test("ICMR walk-in keeps start time separate from cutoff and shows address without pin", async () => {
  const result = await icmrNithrYp1Admin2026(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.appointmentType, "contract");
  assert.equal(cycle.applicationMethod, "in-person");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-06");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.status, "upcoming");
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(cycle.venues[0].kind, "published-address");
  assert.match(venueText(cycle), /Nagpur Road.*map pin unavailable/);
  const foreign = evaluateEligibility(cycle.rules, { nationality: "US" });
  assert.equal(foreign.canApply.result, "needs-verification");
  assert.equal(foreign.canObtainOutcome.result, "needs-verification");
  assert.equal((await icmrNithrYp1Admin2026(context(false, new Date("2026-10-06T10:00:00Z")))).cycles[0].status, "uncertain");
  assert.equal((await icmrNithrYp1Admin2026(context(false, new Date("2026-10-07T00:00:00Z")))).cycles[0].status, "closed");
});
