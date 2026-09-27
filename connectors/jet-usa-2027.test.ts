import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { jetUsa2027, verifyJetUsa2027Pages } from "./jet-usa-2027.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const urls = {
  timeline: "https://jetprogramusa.org/application-departure/",
  eligibility: "https://jetprogramusa.org/eligibility-criteria/",
  programme: "https://jetprogramusa.org/jet-program/",
  howTo: "https://jetprogramusa.org/how-to-apply/",
} as const;
const filenames = { timeline: "timeline", eligibility: "eligibility", programme: "program", howTo: "howto" } as const;
const pages = Object.fromEntries(Object.entries(filenames).map(([key, name]) => [key, readFileSync(new URL(`../data/evidence/research/jet-usa-2027-${name}.html`, import.meta.url), "utf8")])) as Record<keyof typeof urls, string>;
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[])
  .find((item) => item.id === "jp-jet-usa-2027")!;
const evidence = (url: string, bytes: Buffer): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType: "text/html", bytes: bytes.length,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => {
    const key = (Object.keys(urls) as (keyof typeof urls)[]).find((item) => urls[item] === url);
    assert.ok(key, `unexpected JET USA page ${url}`);
    const text = pages[key];
    return { text, evidence: evidence(url, Buffer.from(text)) };
  },
  ...override,
});

test("JET USA 2027 critical source wording gates dates, citizenship and role language", () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.doesNotThrow(() => verifyJetUsa2027Pages(pages));
  assert.throws(() => verifyJetUsa2027Pages({ ...pages, timeline: pages.timeline.replace("November 13, 2026", "November 14, 2026") }), /application dates changed/);
  assert.throws(() => verifyJetUsa2027Pages({ ...pages, eligibility: pages.eligibility.replace("Be a citizen of the United States", "Be a resident of the United States") }), /citizenship, qualification or language wording changed/);
  assert.throws(() => verifyJetUsa2027Pages({ ...pages, eligibility: pages.eligibility.replace("N1 or N2 is desirable", "N3 is sufficient") }), /citizenship, qualification or language wording changed/);
});

test("JET USA stages one Japan employment cycle with US-only route and role-specific language uncertainty", async () => {
  const result = await jetUsa2027(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.evidence.length, 4);
  const cycle = result.cycles[0];
  assert.equal(cycle.jurisdictionCode, "JP");
  assert.equal(cycle.pathway, "recruitment");
  assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.closesOn, "2026-11-13");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "23:59");
  assert.equal(cycle.applicationWindow.officialTimeZone, "Pacific/Honolulu");
  assert.match(cycle.outcome, /choose Assistant Language Teacher.*Coordinator for International Relations/);
  assert.match(cycle.languageNote!, /N1\/N2 is desirable/);
  assert.equal(cycle.applicationMethod, "online");
  assert.equal(cycle.sources.find((item) => item.format === "PDF")?.fetchStatus, "linked");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal((await jetUsa2027(context({ now: new Date("2026-09-20T12:00:00-10:00") }))).cycles[0].status, "upcoming");
  assert.equal((await jetUsa2027(context({ now: new Date("2026-11-14T00:00:00-10:00") }))).cycles[0].status, "closed");
});
