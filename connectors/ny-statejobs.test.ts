import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NY_INDEX, nyDate, nyLanguageRules, nyStateJobs, parseNyDetail, parseNyIndex, partitionNyVacancies } from "./ny-statejobs.ts";
import type { SourceConfig } from "./types.ts";

const read = (file: string) => readFileSync(new URL(`../data/evidence/research/${file}`, import.meta.url), "utf8");
const html = read("ny-statejobs-index.html");
const detail = read("ny-statejobs-language.txt");
const entries = parseNyIndex(html);
const spanish = entries.find((entry) => entry.id === "225041")!;
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((source) => source.id === "us-ny-statejobs")!;
const evidence = (url: string) => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: "a".repeat(64), contentType: "text/html", bytes: 100 });
const spanishIndex = html.replace(/(<tbody[^>]*>)[\s\S]*?(<\/tbody>)/i, (_all, start, end) => `${start}${[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].find((row) => row[1].includes('id=225041"'))![0]}${end}`);

test("NY dates are month-first, preserve date precision and reject invalid dates", () => {
  assert.equal(nyDate("10/08/26"), "2026-10-08");
  assert.equal(nyDate("02/29/2024"), "2024-02-29");
  assert.equal(nyDate("02/29/26"), null);
  assert.equal(nyDate("13/01/26"), null);
  assert.equal(nyDate("09/30/26 23:59"), null);
  assert.equal(spanish.postedOn, "2026-09-17");
  assert.equal(spanish.closesOn, "2026-09-30");
  assert.equal(entries.length, 1830);
});

test("NY duplicate IDs deduplicate; ambiguous separate postings are withheld rather than counted", () => {
  assert.deepEqual(parseNyIndex(spanishIndex.replace("</tbody>", spanishIndex.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)![1] + "</tbody>")), [spanish]);
  const { candidates, held } = partitionNyVacancies(entries);
  assert.ok(held.some((group) => group.some((entry) => entry.id === "225562") && group.some((entry) => entry.id === "225563")));
  assert.ok(!candidates.some((entry) => ["225562", "225563"].includes(entry.id)));
  const differentLocation = { ...spanish, id: "999999", url: spanish.url.replace("225041", "999999") };
  assert.equal(partitionNyVacancies([spanish, differentLocation]).candidates.length, 0);
});

test("NY index drift, off-domain links and conflicting identities fail closed", () => {
  assert.throws(() => parseNyIndex("<html>Maintenance</html>"), /table changed/);
  assert.throws(() => parseNyIndex(html.replace('href="vacancyDetailsView.cfm', 'href="https://evil.example/vacancyDetailsView.cfm')), /official link changed/);
  assert.throws(() => parseNyDetail(detail.replace("09&#x2f;30&#x2f;26", "10&#x2f;30&#x2f;26"), spanish), /mismatch/);
  assert.throws(() => parseNyDetail(detail, { ...spanish, id: "999999" }), /mismatch/);
});

test("NY index entities and Unicode detail titles identify the same post", () => {
  const index = spanishIndex.replaceAll("Offender Rehabilitation Coordinator", "Offender&rsquo;s Rehabilitation &ndash; Coordinator");
  const updatedDetail = detail.replaceAll("Offender Rehabilitation Coordinator", "Offender’s Rehabilitation – Coordinator");
  const entry = parseNyIndex(index)[0];
  assert.match(entry.title, /Offender’s Rehabilitation – Coordinator/);
  assert.equal(parseNyDetail(updatedDetail, entry).Title, entry.title);
});

test("NY language clause stays conditional, title-specific and without invented proficiency scale", () => {
  const fields = parseNyDetail(detail, spanish);
  const rules = nyLanguageRules(spanish, fields["Minimum Qualifications"]);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].language, "es");
  assert.equal(rules[0].stage, "selection");
  assert.equal(rules[0].minimumLevel, undefined);
  assert.equal(rules[0].framework, undefined);
  assert.match(rules[0].requirement, /NY HELPS route without an examination/);
  assert.ok(!/sign language/.test(rules[0].evidence));
  assert.deepEqual(nyLanguageRules(spanish, "Fluent Spanish desired"), []);
  assert.deepEqual(nyLanguageRules({ ...spanish, title: "Offender Rehabilitation Coordinator (Manual Communications)" }, fields["Minimum Qualifications"]), []);
});

test("NY drafts preserve uncertainty, full qualification alternatives and unknown selection venue", async () => {
  const result = await nyStateJobs({ source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {}, fetchText: async (url) => ({ text: url === NY_INDEX ? spanishIndex : detail, evidence: evidence(url) }) });
  const cycle = result.cycles[0];
  assert.equal(source.enabled, false);
  assert.equal(source.reviewRequired, true);
  assert.equal(cycle.status, "uncertain");
  assert.equal(cycle.applicationWindow.opensOn, null);
  assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.equal(cycle.applicationWindow.officialTimeZone, null);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.education, undefined);
  assert.match(cycle.qualifications, /Substitution: A master/);
  assert.equal(cycle.rules?.complete, false);
  assert.ok(cycle.venues.every((venue) => venue.kind === "unknown"));
  assert.ok(cycle.sources.every((source) => source.lastValidatedAt === null && source.verificationStatus === "pending-review"));
  assert.match(cycle.citizenshipRule, /not proof that every nationality/);
  assert.equal(cycle.applicationUrl, spanish.url);
  assert.equal(result.totalAvailable, 1);
});

test("NY all failed details cannot replace previous drafts; detail cap is enforced", async () => {
  let detailRequests = 0;
  await assert.rejects(() => nyStateJobs({ source: { ...source, maxRecords: 2 }, now: new Date(), env: {}, log: () => {}, fetchText: async (url) => {
    if (url !== NY_INDEX) { detailRequests += 1; throw new Error("Unavailable"); }
    return { text: html, evidence: evidence(url) };
  } }), /preserve previous/);
  assert.equal(detailRequests, 2);
});
