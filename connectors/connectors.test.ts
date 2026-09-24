import assert from "node:assert/strict";
import test from "node:test";

import { cleanCity, departmentRegion, educationFromLevel, indexCommunes, parseCsv, rowToCycle, venueFor } from "./choisir-service-public.ts";
import { parseRobots, robotsAllows } from "./http.ts";
import { parseGuides } from "./jinji.ts";
import { markFailedRun, mergeSuccessfulRun } from "./merge.ts";
import { levelFromName, selectEntries, statusFor } from "./ssc.ts";
import { toCycle as teachingCycle } from "./teaching-vacancies.ts";
import type { Evidence, SourceConfig } from "./types.ts";
import { parseActiveList, parseExamPage } from "./upsc.ts";
import { clockTime, dayFirstDate, geocodeCity, regionAt } from "./util.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";

const source: SourceConfig = { id: "test", name: "Test", country: "IN", authority: "Test authority", homepage: "https://example.gov", connector: "x", cadenceHours: 24, licence: "", enabled: true };
const evidence: Evidence = { url: "https://example.gov/list", fetchedAt: "2026-09-24T10:00:00Z", sha256: "a".repeat(64), contentType: "text/html", bytes: 10 };

test("date and time helpers read Indian-style notices", () => {
  assert.equal(dayFirstDate("06/10/2026 - 6:00pm"), "2026-10-06");
  assert.equal(dayFirstDate("31/02/2026"), null);
  assert.equal(clockTime("- 6:00pm"), "18:00");
  assert.equal(clockTime("12:30 am"), "00:30");
});

test("UPSC: exam page fields and the active list, ignoring commented-out HTML", () => {
  const page = `<div>Name of Examination: Engineering Services (Preliminary) Examination, 2027 Date of Notification 16/09/2026 Date of Commencement of Examination 31/01/2027 Duration of Examination One Day Last Date for Receipt of Applications 06/10/2026 - 6:00pm Date of Upload 16/09/2026 Download Notification <a href="/sites/default/files/Notif-ESEP-2027.pdf">Notice</a></div>`;
  assert.deepEqual(parseExamPage(page), {
    name: "Engineering Services (Preliminary) Examination, 2027",
    notifiedOn: "2026-09-16",
    examStartsOn: "2027-01-31",
    lastDate: "2026-10-06",
    lastTime: "18:00",
    notificationUrl: "https://www.upsc.gov.in/sites/default/files/Notif-ESEP-2027.pdf",
  });
  const list = `<!-- <a href="active-exams/old">Old Examination, 2019</a> --><div class="view-content"><a href="/examinations/Civil%20Services%20Examination%2C%202027"><ul><li>Civil Services Examination, 2027</li></ul></a><a href="/examinations/answer-key">Answer Keys</a></div>`;
  assert.deepEqual(parseActiveList(list), [{ title: "Civil Services Examination, 2027", url: "https://www.upsc.gov.in/examinations/Civil%20Services%20Examination%2C%202027" }]);
});

test("SSC: calendar status, window selection and levels stated in exam names only", () => {
  const entry = { id: "1", headline: "Combined Graduate Level Examination, 2027", startDate: "2026-10-01", endDate: "2026-10-31" };
  assert.equal(statusFor(entry, "2026-09-24"), "upcoming");
  assert.equal(statusFor(entry, "2026-10-15"), "open");
  assert.equal(statusFor(entry, "2026-11-01"), "closed");
  assert.equal(selectEntries([entry, { ...entry, id: "old", endDate: "2026-06-01" }], "2026-09-24").length, 1);
  assert.equal(levelFromName(entry.headline)?.level, "bachelor");
  assert.equal(levelFromName("Combined Higher Secondary (10+2) Level Examination")?.level, "higher-secondary");
  assert.equal(levelFromName("Multi-Tasking Staff Examination"), null);
});

test("Teaching Vacancies: exact postcode pins, local closing time, official link", () => {
  const cycle = teachingCycle({
    title: "Class Teacher",
    url: "https://teaching-vacancies.service.gov.uk/jobs/class-teacher",
    datePosted: "2026-09-20",
    validThrough: "2026-10-09T09:00:00+01:00",
    occupationalCategory: "teacher",
    hiringOrganization: { name: "Example Primary" },
    jobLocation: { address: { addressLocality: "Stoke-on-Trent", postalCode: "ST1 6LG" } },
  }, { ...source, country: "GB" }, evidence, new Map([["ST1 6LG", { latitude: 53.045925, longitude: -2.158802 }]]));
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-09");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "09:00");
  assert.equal(cycle.venues[0].kind, "published");
  assert.equal(cycle.venues[0].kind === "published" && cycle.venues[0].precision, "exact");
  assert.equal(cycle.applicationUrl, "https://teaching-vacancies.service.gov.uk/jobs/class-teacher");
  assert.ok(cycle.subdivisionCodes?.[0]?.startsWith("GB-"));
});

test("Choisir le service public: CSV, education levels, departments, venues", () => {
  const rows = [...parseCsv('A;B\n"x;y";"say ""hi"""\n1;2\n')];
  assert.deepEqual(rows, [["A", "B"], ["x;y", 'say "hi"'], ["1", "2"]]);
  assert.equal(educationFromLevel("Niveau 7 Master/diplômes équivalents")?.level, "master");
  assert.equal(educationFromLevel(""), null);
  assert.equal(departmentRegion("Creuse (23)"), "FR-23");
  assert.equal(departmentRegion("Guyane (973)"), "FR-GF");
  const communes = indexCommunes([
    { nom: "Aubusson", codesPostaux: ["23200"], centre: { coordinates: [2.168, 45.955] }, codeDepartement: "23" },
    { nom: "Paris", codesPostaux: ["75004", "75018"], centre: { coordinates: [2.347, 48.859] }, codeDepartement: "75" },
    { nom: "Rennes", codesPostaux: ["35000"], centre: { coordinates: [-1.68, 48.112] }, codeDepartement: "35" },
    { nom: "Château-Chinon (Ville)", codesPostaux: ["58120"], centre: { coordinates: [3.93, 47.06] }, codeDepartement: "58" },
  ]);
  assert.equal(cleanCity("RENNES CEDEX 7"), "RENNES");
  assert.equal(cleanCity("PARIS 04"), "PARIS");
  for (const [place, city] of [["9 boulevard du Palais - PARIS 04", "Paris"], ["1 bis rue de Lutèce 75195 Paris cedex 04", "Paris"], ["108 Av du Gl LECLERC – BP 60321  35703  RENNES CEDEX 7", "Rennes"], ["92 boulevard Ney, 75018 PARIS", "Paris"]]) {
    const venue = venueFor(place, "", place.includes("RENNES") ? "FR-35" : "FR-75", communes);
    assert.equal(venue.kind === "published" && venue.city, city, place);
  }
  const cycle = rowToCycle({
    "Référence": "O033260101000002",
    "Intitulé du poste": "Cuisinier (H/F)",
    "Date de fin de publication par défaut": "31/12/9999",
    "Date de début de publication par défaut": "01/09/2026",
    "Localisation du poste": "Creuse (23)",
    "Lieu d'affectation": "1 rue Williams Dumazet : 23200 Aubusson",
    "Niveau d'études": "Niveau 3 Diplômes équivalents au CAP/BEP",
    "Nature de l'emploi": "Emploi réservé aux fonctionnaires et lauréats d'un concours territorial",
  }, { ...source, country: "FR" }, evidence, communes)!;
  assert.equal(cycle.applicationWindow.closesOn, null, "placeholder end date means no closing date");
  assert.equal(cycle.venues[0].kind === "published" && cycle.venues[0].city, "Aubusson");
  assert.equal(cycle.rules?.education?.minLevel, "secondary");
  assert.equal(cycle.rules?.manualChecks?.[0]?.stage, "apply");
});

test("Jinji: guide rows keep their exam family", () => {
  const html = `<table><tr><td rowspan="2">国家公務員採用<br>総合職試験</td><td>院卒者試験</td><td><a href="/content/1.pdf">受験案内</a></td><td>12／24</td></tr><tr><td>大卒程度試験</td><td><a href="/content/2.pdf">受験案内</a></td></tr></table>`;
  const guides = parseGuides(html);
  assert.equal(guides.length, 2);
  assert.equal(guides[1].name, "国家公務員採用総合職試験 大卒程度試験");
  assert.equal(guides[0].pdf, "https://www.jinji.go.jp/content/1.pdf");
});

test("robots.txt rules are honoured, including wildcards", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /admin\nDisallow: /*-jobs*?*\n\nUser-agent: GPTBot\nDisallow: /");
  assert.equal(robotsAllows(rules, "/api/v1/jobs.json"), true);
  assert.equal(robotsAllows(rules, "/admin/users"), false);
  assert.equal(robotsAllows(rules, "/teacher-jobs-in-leeds?page=2"), false);
});

test("offline geocoding and region lookup", () => {
  assert.equal(geocodeCity("Bangalore", "IN")?.subdivision, "IN-KA");
  assert.equal(regionAt("IN", 19.07, 72.88), "IN-MH");
  assert.equal(regionAt("IN", 0, 0), null);
});

const record = (id: string, closesOn: string | null, extra: Partial<OpportunityCycle> = {}): OpportunityCycle => ({
  id, fixture: false, title: id, cycleLabel: "", programme: "", authority: "", pathway: "recruitment", status: "open", statusNote: "",
  jurisdictionCode: "IN", jurisdictionName: "India", scopeLabel: "", outcome: "",
  applicationWindow: { opensOn: null, closesOn, officialTimeZone: "Asia/Kolkata", cutoffLocalTime: null, precision: "date" },
  qualifications: "", citizenshipRule: "", residenceRule: "", selectionStages: [], fee: "", rules: null, venues: [], sources: [],
  lastVerifiedAt: null, applicationUrl: null, changes: [], ...extra,
});

test("merge: new, extended, vanished (never cancelled), closed and dropped", () => {
  const now = new Date("2026-09-24T06:00:00Z");
  const today = () => "2026-09-24";
  const previous = [
    record("a", "2026-10-01", { changes: [{ at: "2026-09-01", kind: "created", summary: "" }] }),
    record("gone", "2026-10-30"),
    record("closed-recently", "2026-09-10"),
    record("closed-long-ago", "2026-07-01"),
  ];
  const merged = mergeSuccessfulRun({
    sourceId: "s", previous, fresh: [record("a", "2026-10-10"), record("new", "2026-11-01")], overrides: new Map([["new", { applicationWindow: { cutoffLocalTime: "17:00" } as OpportunityCycle["applicationWindow"] }]]), now, today,
  });
  const byId = Object.fromEntries(merged.map((item) => [item.id, item]));
  assert.equal(byId.a.changes.at(-1)?.kind, "extended");
  assert.equal(byId.new.changes[0].kind, "created");
  assert.equal(byId.new.applicationWindow.cutoffLocalTime, "17:00", "reviewer override wins");
  assert.equal(byId.new.applicationWindow.closesOn, "2026-11-01", "override merges, doesn't wipe fields");
  assert.equal(byId.gone.status, "uncertain");
  assert.match(byId.gone.statusNote, /No longer listed/);
  assert.equal(byId["closed-recently"].status, "closed");
  assert.equal(byId["closed-long-ago"], undefined);
});

test("failed runs keep records; two failures mark open ones stale", () => {
  const previous = [record("a", "2026-10-01"), record("b", "2026-08-01", { status: "closed" })];
  assert.deepEqual(markFailedRun(previous, 1, null), previous);
  const stale = markFailedRun(previous, 2, "2026-09-20T00:00:00Z");
  assert.equal(stale[0].status, "stale");
  assert.equal(stale[1].status, "closed");
});
