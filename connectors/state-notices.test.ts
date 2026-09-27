import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { groupRpscCycles, parseRpscNotices, rpsc, RPSC_INDEX } from "./rpsc.ts";
import { parseUppscIndex, parseUppscLivePosts, uppsc, UPPSC_INDEX } from "./uppsc.ts";
import type { SourceConfig } from "./types.ts";

const read = (name: string) => readFileSync(new URL(`../data/evidence/research/${name}.html`, import.meta.url), "utf8");
const rajasthan = read("rpsc-advertisements");
const upIndex = read("uppsc-notifications");
const upHome = read("uppsc-ad-560"); // An advertisement link redirected to the official home page.
const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[];
const source = (id: string) => registry.find((source) => source.id === id)!;
const evidence = (url: string) => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: "a".repeat(64), contentType: "text/html", bytes: 100 });

test("RPSC corrections attach to a single original advertisement without increasing cycle totals", () => {
  const notices = parseRpscNotices(rajasthan, "2026-09-25");
  const grouped = groupRpscCycles(notices, "2026-09-25");
  const teacher = grouped.groups.find((group) => group.original.number === "07/2025-26")!;
  assert.equal(teacher.notices.length, 6);
  assert.equal(teacher.notices.filter((notice) => notice.kind === "advertisement").length, 1);
  assert.ok(grouped.warnings.some((warning) => /SCHOOL LECTURER.*2 original/.test(warning)));
  assert.deepEqual(parseRpscNotices(rajasthan.replace("</tbody>", rajasthan.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)![1] + "</tbody>")), parseRpscNotices(rajasthan));
  const ambiguous = groupRpscCycles([...notices, { ...teacher.original, url: "https://rpsc.rajasthan.gov.in/other.pdf", number: "99/2025-26" }], "2026-09-25");
  assert.ok(!ambiguous.groups.some((group) => group.original.number === "07/2025-26"));
});

test("RPSC preserves withdrawal evidence and never treats release date as opening date", async () => {
  const result = await rpsc({ source: source("in-rj-recruitment"), now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {}, fetchText: async (url) => ({ text: rajasthan, evidence: evidence(url) }) });
  const withdrawn = result.cycles.find((cycle) => /PHYSIOTHERAPIST/.test(cycle.title))!;
  assert.equal(withdrawn.status, "cancelled");
  assert.equal(withdrawn.applicationUrl, null);
  assert.ok(result.cycles.every((cycle) => cycle.status !== "open" && cycle.applicationWindow.opensOn === null && cycle.applicationWindow.closesOn === null));
  assert.ok(result.cycles.every((cycle) => cycle.sources.filter((source) => source.format === "PDF").every((source) => !source.sha256 && source.lastSuccessfulFetchAt === null)));
  assert.equal(new Set(result.cycles.map((cycle) => cycle.id)).size, result.cycles.length);
});

test("RPSC drift and unsafe document links fail before candidates are accepted", () => {
  assert.throws(() => parseRpscNotices("<html>Maintenance</html>"), /table changed/);
  assert.throws(() => parseRpscNotices(rajasthan.replace("Static/RecruitmentAdvertisements/", "https://evil.example/")), /outside the official/);
  assert.throws(() => parseRpscNotices(rajasthan.replace("Corrigendum No. 15/2026-27", "Unexpected amendment"), "2026-09-25"), /numbering needs review/);
});

test("UPPSC application deadline stays separate from fee reconciliation and modification", () => {
  const rows = parseUppscIndex(upIndex);
  assert.equal(rows.length, 2);
  const reopened = rows.find((entry) => entry.number === "D-6/E-1/2025")!;
  assert.equal(reopened.opensOn, "2026-09-21");
  assert.equal(reopened.closesOn, "2026-10-21");
  assert.equal(reopened.reconciliationClosesOn, "2026-10-28");
  assert.equal(reopened.modificationClosesOn, "2026-10-28");
  assert.equal(parseUppscLivePosts(upHome).length, 2);
});

test("UPPSC matches exact advertisement, names actual job, and ignores alert visibility dates", async () => {
  const run = (home: string) => uppsc({ source: source("in-up-recruitment"), now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {}, fetchText: async (url) => ({ text: url === UPPSC_INDEX ? upIndex : home, evidence: evidence(url) }) });
  const result = await run(upHome.replaceAll("Visible upto : 28/10/2026", "Visible upto : 31/12/2099"));
  assert.equal(result.cycles.length, 2);
  const inspector = result.cycles.find((cycle) => /INSPECTOR OF DRUGS/.test(cycle.title))!;
  assert.equal(inspector.cycleLabel, "D-6/E-1/2025");
  assert.equal(inspector.applicationWindow.closesOn, "2026-10-21");
  assert.equal(inspector.applicationWindow.cutoffLocalTime, null);
  assert.equal(inspector.applicationWindow.officialTimeZone, null);
  assert.equal(inspector.applicationMethod, "online");
  assert.match(inspector.languageNote ?? "", /do not state a language requirement/);
  assert.equal(inspector.rules?.complete, false);
  assert.equal(evaluateEligibility(inspector.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(inspector.rules, { nationality: "US" }).canObtainOutcome.result, "needs-verification");
  assert.match(inspector.statusNote, /reopened/);
  const onClosingDay = await uppsc({ source: source("in-up-recruitment"), now: new Date("2026-10-21T06:00:00Z"), env: {}, log: () => {},
    fetchText: async (url) => ({ text: url === UPPSC_INDEX ? upIndex : upHome, evidence: evidence(url) }) });
  assert.equal(onClosingDay.cycles.find((cycle) => cycle.id === inspector.id)?.status, "uncertain");
  await assert.rejects(() => run("<html>Maintenance</html>"), /No UPPSC post identities/);
});

test("UPPSC missing date fields and off-domain live alerts cannot produce confident records", () => {
  assert.throws(() => parseUppscIndex(upIndex.replaceAll("Lbl_ApplicationFormRegistration_LastDate", "Unknown_Date_Field")), /dates need review/);
  assert.equal(parseUppscLivePosts(upHome.replaceAll("href=CandidatePages/Notifications.aspx", "href=https://evil.example/CandidatePages/Notifications.aspx")).length, 0);
  assert.equal(source("in-up-recruitment").reviewRequired, true);
  assert.equal(source("in-rj-recruitment").reviewRequired, true);
});
