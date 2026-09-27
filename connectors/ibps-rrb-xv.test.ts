import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { IBPS_RRB_INDEX, ibpsRrbXv, parseIbpsRrbIndex, parseIbpsRrbPortal } from "./ibps-rrb-xv.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const base = new URL("../data/evidence/research/ibps-rrb-xv-", import.meta.url);
const read = (suffix: string) => readFileSync(new URL(`${base.href}${suffix}`, import.meta.url));
const index = read("page.html").toString();
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/ibps-rrb-xv-2026.json", import.meta.url), "utf8")) as {
  documents: { key: string; url: string }[]; portals: { assistant: string; officer: string };
};
const files = new Map(extraction.documents.map(({ key, url }) => [url, read(({
  "corrigendum-25sep": "corr-25sep.pdf", "vacancies-25sep": "vacancies-25sep.pdf",
  extension: "extension.pdf", "corrigendum-15sep": "corr-15sep.pdf", "vacancies-15sep": "vacancies-15sep.pdf",
  "corrigendum-09sep": "corr-09sep.pdf", "vacancies-09sep": "vacancies-09sep.pdf", window: "window.pdf", original: "notification.pdf",
} as Record<string, string>)[key])!]));
const pages = new Map<string, string>([
  [IBPS_RRB_INDEX, index],
  [extraction.portals.assistant, read("assistant-portal.html").toString()],
  [extraction.portals.officer, read("officer-portal.html").toString()],
]);
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-ibps-crp")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({
  url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType,
});
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { const text = pages.get(url); assert.ok(text, `unexpected page ${url}`); return { text, evidence: evidence(url, Buffer.from(text), "text/html") }; },
  fetchBytes: async (url) => { const bytes = files.get(url); assert.ok(bytes, `unexpected PDF ${url}`); return { bytes, evidence: evidence(url, bytes, "application/pdf") }; },
  ...override,
});

test("IBPS RRB XV index and distinct registration pages bind exact official notice set", () => {
  assert.equal(parseIbpsRrbIndex(index).documents.size, 9);
  assert.deepEqual(parseIbpsRrbPortal(pages.get(extraction.portals.assistant)!, "assistant"), { opensOn: "2026-09-01", closesOn: "2026-09-27" });
  assert.deepEqual(parseIbpsRrbPortal(pages.get(extraction.portals.officer)!, "officer"), { opensOn: "2026-09-01", closesOn: "2026-09-27" });
  assert.throws(() => parseIbpsRrbIndex(index.replace("CRP-RRBs-XV-notification.pdf", "CRP-RRBs-XV-new-notification.pdf")), /added or changed/);
  assert.throws(() => parseIbpsRrbPortal(pages.get(extraction.portals.assistant)!.replaceAll("27/09/2026", "28/09/2026"), "assistant"), /changed/);
});

test("IBPS RRB XV drafts preserve date precision and international-applicant uncertainty", async () => {
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  const result = await ibpsRrbXv(context());
  assert.equal(result.complete, false);
  assert.equal(result.cycles.length, 10);
  assert.equal(result.evidence.length, 12);
  assert.deepEqual(result.cycles.map((cycle) => cycle.applicationUrl), [extraction.portals.assistant, ...Array(9).fill(extraction.portals.officer)]);
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, 10);
  for (const cycle of result.cycles) {
    assert.equal(cycle.applicationWindow.closesOn, "2026-09-27");
    assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
    assert.equal(cycle.applicationWindow.precision, "date");
    assert.equal(cycle.changes.filter((change) => change.kind === "extended").length, 1);
    assert.ok(cycle.changes.some((change) => change.at === "2026-09-25" && change.kind === "updated"));
    assert.equal(cycle.venues[0].kind, "unknown");
    assert.equal(cycle.rules?.nationality, undefined);
    assert.equal(cycle.rules?.languages, undefined);
    assert.ok(cycle.rules?.manualChecks?.some((check) => check.text.includes("21 September 2026")));
    assert.equal(evaluateEligibility(cycle.rules, { nationality: "NP", education: "bachelor" }).canApply.result, "needs-verification");
  }
  assert.ok(result.cycles.slice(0, 2).every((cycle) => cycle.rules?.manualChecks?.some((check) => check.text.includes("selected RRB"))));
  const senior = result.cycles.slice(2);
  assert.equal(senior.length, 8);
  assert.deepEqual(senior.map((cycle) => cycle.rules?.experience?.minYears), [2, 1, 1, 2, 1, 1, 2, 5]);
  assert.ok(senior.every((cycle) => cycle.selectionStages[0] === "Single online examination" && cycle.selectionStages.includes("Common interview")));
  assert.ok(senior.every((cycle) => /English or Hindi.*No CEFR/.test(cycle.languageNote ?? "")));
  assert.ok(senior.every((cycle) => !cycle.rules?.manualChecks?.some((check) => check.text.includes("selected RRB"))));
  assert.match(senior.find((cycle) => cycle.id.endsWith("officer-scale-ii-ca"))?.qualifications ?? "", /Certified Associate.*Chartered Accountant/);
  assert.equal(evaluateEligibility(senior[7].rules, { nationality: "IN", experienceYears: 2 }).canApply.result, "does-not-match");
  assert.equal(result.cycles[0].selectionStages.some((stage) => stage === "Interview"), false);
  assert.equal(result.cycles[1].selectionStages.includes("Interview"), true);
});

test("IBPS changed official PDF blocks old applicant rules", async () => {
  const original = extraction.documents.find((document) => document.key === "extension")!.url;
  await assert.rejects(() => ibpsRrbXv(context({ fetchBytes: async (url) => {
    const bytes = url === original ? Buffer.concat([files.get(url)!, Buffer.from("changed")]) : files.get(url)!;
    return { bytes, evidence: evidence(url, bytes, "application/pdf") };
  } })), /PDF changed/);
});
