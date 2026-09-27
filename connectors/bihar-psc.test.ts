import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { BPSC_FEED, BPSC_HOME, biharPsc, checkBiharFeed } from "./bihar-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}`, import.meta.url));
const homepage = read("bpsc-home-2026-09-25.html").toString();
const feed = read("bpsc-tre4-search-2026-09-25.json").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/bpsc-tre4-15-2026.json", import.meta.url), "utf8")) as { documents: { key: string; url: string }[] };
const pdfs = new Map(extraction.documents.map((document) => [document.url, read(`bpsc-tre4-15-2026-${document.key}.pdf`)]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-br-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T12:00:00Z"), env: {}, log: () => {},
  fetchText: async (url, init) => {
    const text = url === BPSC_HOME ? homepage : url === BPSC_FEED ? feed : null;
    assert.ok(text, `unexpected BPSC page ${url}`);
    if (url === BPSC_FEED) {
      assert.equal(init?.method, "POST");
      assert.equal(init?.headers?.["Content-Type"], "application/x-www-form-urlencoded");
      assert.match(init.body ?? "", /search_term=TRE\+4\.0/);
    }
    return { text, evidence: evidence(url, Buffer.from(text), url === BPSC_HOME ? "text/html" : "application/json") };
  },
  fetchBytes: async (url) => {
    const bytes = pdfs.get(url);
    assert.ok(bytes, `unexpected BPSC PDF ${url}`);
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  },
  ...override,
});

test("BPSC TRE 4.0 official search binds replacement notice and exact attachment set", () => {
  assert.doesNotThrow(() => checkBiharFeed(feed));
  const changed = JSON.parse(feed);
  changed.data.posts[0].fields.home_date = "2026-09-23";
  assert.throws(() => checkBiharFeed(JSON.stringify(changed)), /identity changed/);
  changed.data.posts[0].fields.home_date = "2026-09-22";
  changed.data.posts[0].fields.home_view_download += '<a href="https://bpsc.bihar.gov.in/new-amendment.pdf">Amendment</a>';
  assert.throws(() => checkBiharFeed(JSON.stringify(changed)), /attachment set changed/);
});

test("BPSC stages one review-only teacher draft with date precision and international uncertainty", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await biharPsc(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 4);
  const cycle = result.cycles[0];
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.opensOn, "2026-09-25");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-26");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.match(cycle.outcome, /32,388/);
  assert.equal(cycle.venues[0].kind, "unknown");
  for (const stage of Object.values(evaluateEligibility(cycle.rules, { nationality: "US", education: "bachelor" }))) assert.equal(stage.result, "needs-verification");
  const closed = await biharPsc(context({ now: new Date("2026-10-27T00:00:00Z") }));
  assert.equal(closed.cycles[0].status, "closed");
});

test("BPSC changed original PDF blocks retained dates and applicant terms", async () => {
  const target = extraction.documents[0].url;
  await assert.rejects(() => biharPsc(context({ fetchBytes: async (url) => {
    const original = pdfs.get(url)!;
    const bytes = url === target ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
