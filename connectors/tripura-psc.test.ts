import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { parseTripuraIndex, TRIPURA_INDEX, tripuraPsc } from "./tripura-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const html = readFileSync(new URL("../data/evidence/research/tpsc-advertisement-2026.html", import.meta.url), "utf8");
const urls = [...parseTripuraIndex(html)];
const files = new Map(urls.map(([key, url]) => [url, readFileSync(new URL(`../data/evidence/research/tpsc-${key.replace("/2026", "-2026").replace("-addendum", "-addendum")}.pdf`, import.meta.url))]));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-tr-recruitment")!;
const evidence = (url: string, bytes: Buffer, type: string): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType: type });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: html, evidence: evidence(url, Buffer.from(html), "text/html") }),
  fetchBytes: async (url) => { const bytes = files.get(url); assert.ok(bytes, `unexpected PDF: ${url}`); return { bytes, evidence: evidence(url, bytes, "application/pdf") }; },
  ...override,
});

test("Tripura index binds three ads and one addendum; later correction blocks old fields", () => {
  assert.equal(urls.length, 4);
  assert.equal(urls[0][0], "03/2026");
  const firstNotice = html.indexOf("/sites/default/files/Advt_03_2026_070526.pdf");
  const nextRow = html.indexOf("</li>", firstNotice);
  const injected = `${html.slice(0, nextRow)}<li><a href="/sites/default/files/new-03-2026.pdf">Corrigendum Advt. No-03/2026</a></li>${html.slice(nextRow)}`;
  assert.throws(() => parseTripuraIndex(injected), /duplicate or unsupported correction/);
  assert.throws(() => parseTripuraIndex(html.replace("/sites/default/files/Advt_02_2026_270426.pdf", "https://example.org/Advt_02_2026_270426.pdf")), /outside official PDF archive/);
});

test("Tripura draft preserves extension, nationality, PRTC and optional languages", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await tripuraPsc(context());
  assert.equal(result.cycles.length, 3);
  assert.equal(result.complete, false);
  const [tourist, technical, engineer] = result.cycles;
  assert.deepEqual(result.cycles.map((cycle) => cycle.status), ["closed", "closed", "closed"]);
  assert.equal(tourist.applicationWindow.closesOn, "2026-04-27");
  assert.equal(tourist.changes[0].kind, "extended");
  assert.match(tourist.changes[0].summary, /18 to 27 April/);
  assert.match(tourist.outcome, /2 Assistant Tourist/);
  assert.match(technical.outcome, /220/);
  assert.match(engineer.outcome, /8 Junior Engineer/);
  assert.match(engineer.outcome, /Grade I has 5; Grade II has 3/);
  assert.equal(technical.rules?.languages?.[0].language, "en");
  assert.equal(technical.rules?.languages?.[0].minimumLevel, undefined);
  assert.equal(tourist.rules?.languages, undefined);
  for (const cycle of result.cycles) {
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "does-not-match");
    assert.equal(cycle.rules?.residence, undefined);
    assert.ok(cycle.rules?.manualChecks?.some((check) => check.text.includes("PRTC")));
    assert.equal(cycle.venues[0].kind, "unknown");
  }
});

test("Tripura changed scan blocks old rules and local cutoff remains closed", async () => {
  const second = urls.find(([key]) => key === "02/2026")![1];
  await assert.rejects(() => tripuraPsc(context({ fetchBytes: async (url) => {
    const original = files.get(url)!;
    const bytes = url === second ? Buffer.concat([original, Buffer.from("changed")]) : original;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
  assert.equal((await tripuraPsc(context({ now: new Date("2026-04-27T17:29:00+05:30") }))).cycles[0].status, "uncertain");
  assert.equal((await tripuraPsc(context({ now: new Date("2026-04-27T17:30:00+05:30") }))).cycles[0].status, "closed");
});
