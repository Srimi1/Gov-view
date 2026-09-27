/** One joint 2026 application. Original Hindi extraction awaits human review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { civilDateIn } from "../lib/time.ts";
import { decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  homeUrl: string; dashboardUrl: string; formsUrl: string; rulebookUrl: string;
  rulebookSha256: string; applicationUrl: string; opensOn: string; closesOn: string;
  correctionClosesOn: string; examStartsOn: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/mpesb-steno-asi-2026.json", import.meta.url), "utf8")) as Extraction;
const text = (html: string) => stripTags(html).replace(/\s+/g, " ").trim();
const links = (html: string, base: string) => [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>/gi)]
  .map(match => new URL(decodeEntities(match[1] ?? match[2] ?? match[3]).trim(), base).href);

export function verifyStenoHome(html: string): void {
  const rows = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .filter(match => text(match[1]).includes("Subedar (Stenographer) & Asst. Sub-Inspector Recruitment Test For Police H.Q., Home (Police) -2026"));
  const row = rows[0]?.[1] ?? ""; const urls = links(row, notice.homeUrl);
  if (rows.length !== 1 || !text(row).includes("Start Date:24/09/2026") || urls.length !== 2 ||
      !urls.includes(notice.formsUrl) || !urls.includes(notice.rulebookUrl)) {
    throw new Error("MPESB Steno/ASI home row missing, duplicated or changed; review required");
  }
}

export function verifyStenoDashboard(html: string): void {
  const sections = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .filter(match => text(match[1]).includes("Subedar (Stenographer) & Asst. Sub-Inspector Recruitment Test For Police H.Q., Home (Police) -2026"));
  const section = sections[0]?.[1] ?? "";
  const sectionUrls = links(section, notice.dashboardUrl);
  const rows = [...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .filter(match => links(match[1], notice.dashboardUrl).includes(notice.rulebookUrl));
  const row = rows[0]?.[1] ?? ""; const urls = links(row, notice.dashboardUrl);
  const dates = text(row).match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? [];
  if (sections.length !== 1 || sectionUrls.length !== 2 || rows.length !== 1 || urls.length !== 2 || !urls.includes(notice.formsUrl) ||
      JSON.stringify(dates) !== JSON.stringify(["24/09/2026", "08/10/2026", "13/10/2026", "03/11/2026"]) ||
      !text(row).includes("Recruitment Test") || !text(row).includes("Start From 03/11/2026")) {
    throw new Error("MPESB Steno/ASI dashboard row missing, duplicated or changed; review required");
  }
}

export function verifyStenoForms(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const headers = rows.filter(row => /<th\b/i.test(row[1]) &&
    text(row[1]).includes("सूबेदार (अनुसचिवीय) शीघ्रलेखक एवं सहायक उप निरीक्षक (अनुसचिवीय)") && text(row[1]).includes("2026"));
  const header = headers[0]; const row = header ? rows[rows.indexOf(header) + 1]?.[1] ?? "" : "";
  const urls = links(row, notice.formsUrl); const value = text(row);
  if (headers.length !== 1 || !value.includes("आवेदन पत्र") || value.includes("संशोधन") ||
      !value.includes("24 Sep 2026") || !value.includes("08 Oct 2026") || urls.length !== 2 ||
      !urls.includes(notice.rulebookUrl) || !urls.includes(notice.applicationUrl)) {
    throw new Error("MPOnline Steno/ASI new-application identity or dates changed; review required");
  }
}

export const mpesbStenoAsi2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("MPESB Steno/ASI exact-byte PDF fetch required");
  const home = await fetchText(notice.homeUrl, { accept: "text/html" });
  const dashboard = await fetchText(notice.dashboardUrl, { accept: "text/html" });
  const forms = await fetchText(notice.formsUrl, { accept: "text/html" });
  if (home.evidence.url !== notice.homeUrl || dashboard.evidence.url !== notice.dashboardUrl || forms.evidence.url !== notice.formsUrl) {
    throw new Error("MPESB Steno/ASI register redirected; review required");
  }
  verifyStenoHome(home.text); verifyStenoDashboard(dashboard.text); verifyStenoForms(forms.text);
  const rulebook = await fetchBytes(notice.rulebookUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(rulebook.bytes).digest("hex");
  if (rulebook.bytes.subarray(0, 5).toString() !== "%PDF-" || rulebook.evidence.url !== notice.rulebookUrl ||
      rulebook.evidence.sha256 !== hash || hash !== notice.rulebookSha256 ||
      rulebook.evidence.bytes !== rulebook.bytes.length || !/application\/pdf/i.test(rulebook.evidence.contentType)) {
    throw new Error("MPESB Steno/ASI PDF changed; extracted fields withheld");
  }
  const earliest = civilDateIn("Etc/GMT+12", now), latest = civilDateIn("Pacific/Kiritimati", now);
  const status = latest < notice.opensOn ? "upcoming" : earliest > notice.closesOn ? "closed" :
    earliest >= notice.opensOn && latest < notice.closesOn ? "open" : "uncertain";
  const cycle = makeCycle({
    id: "mpesb-subedar-steno-asi-2026", sourceId: source.id,
    title: "Madhya Pradesh Police — Subedar (Stenographer) and ASI (Ministerial), 2026",
    programme: "MPESB Subedar Stenographer and Assistant Sub-Inspector Recruitment Test", cycleLabel: "2026 · joint application",
    authority: "Police Headquarters, Home (Police) Department, Government of Madhya Pradesh",
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-MP"],
    scopeLabel: "Madhya Pradesh police hiring scope. Cadres and work units do not identify examination venues.",
    outcome: "Possible Subedar (Ministerial Stenographer) or ASI (Ministerial) appointment following written, document, skill and medical checks. Class III classification and minimum service before transfer do not establish permanent tenure.",
    status, statusNote: "New applications 24 September–8 October; corrections end 13 October. First-stage exams start 3 November, not an assigned exam date. Complete Hindi rulebook and appointment conditions await founder review.",
    applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn, cutoffLocalTime: null, officialTimeZone: null, precision: "date",
      note: "Original p. 1 and both official registers give 8 October closing date. Clause 2.17(i), p. 29 says midnight on the final date; timezone and midnight interpretation remain unverified. No 23:59 or next-day cutoff invented. 13 October concerns corrections only." },
    qualifications: "Both roles require higher-secondary/10+2 qualification, CPCT with Hindi typing and specified recognized computer qualification routes. Subedar additionally requires a recognized Hindi shorthand examination at 100 words per minute. Qualification equivalence and documentary proof need review (pp. 9–10).",
    citizenshipRule: "Rulebook p. 6, clause 3(i): applicant must be an Indian citizen. Foreign citizens do not meet this condition for this joint police recruitment.",
    residenceRule: "Non-MP domiciled applicants may apply only for unreserved open vacancies, with no reservation or age-relaxation benefits and a maximum age of 33 on 8 October 2026 (p. 9). MP domicile supports specified concessions; it is not a blanket bar on other Indian applicants.",
    languageNote: "First-stage MCQ is in Hindi (p. 13). Both roles require CPCT certificate with Hindi typing; Subedar additionally requires recognized Hindi shorthand examination at 100 words per minute (p. 9). These are specific skills/certificates, not CEFR levels. Role-specific practical tests and equivalences require review.",
    selectionStages: ["Joint online application and certificates", "First-stage Hindi MCQ", "Police document verification and role-specific practical/skill tests", "Medical, character and final appointment checks"],
    fee: "First page distinguishes ESB examination fees, police departmental fees and MPOnline charges, with certain MP-domicile concessions. Full combined amount and applicant category need founder confirmation.",
    rules: { complete: false, asOn: null,
      nationality: { allowed: ["IN"], evidence: "Original MPESB Steno/ASI 2026 rulebook p. 6, clause 3(i): Indian citizenship mandatory." },
      education: { minLevel: "higher-secondary", evidence: "Original pp. 9–10: higher-secondary/10+2 qualification for both roles; additional computer/skill certificates remain mandatory." },
      languages: [
        { language: "hi", requirement: "CPCT certificate passed with Hindi typing", mandatory: true, stage: "apply", certificateRequired: true, evidence: "Original rulebook p. 9 specifies CPCT with Hindi typing for both roles; required certificates by 8 October are in clause 3(iii), p. 6.", sourceUrl: notice.rulebookUrl },
        { language: "hi", requirement: "First-stage written multiple-choice examination in Hindi", mandatory: true, stage: "selection", certificateRequired: false, evidence: "Original rulebook p. 13, clauses 8–9: first-stage Hindi MCQ.", sourceUrl: notice.rulebookUrl },
      ],
      manualChecks: [
        { stage: "apply", text: "Verify recognized 10+2 and computer qualification route, CPCT Hindi typing, certificates by 8 October, age/category/domicile and fee. Subedar applicants additionally need recognized Hindi shorthand qualification at 100 words per minute; do not apply that role condition to ASI alone." },
        { stage: "selection", text: "Verify Hindi MCQ ability, admit card/ID and assigned venue, documents and role-specific practical tests. Government employees need prior appointing-authority permission to participate in the examination (p. 7, clause 3(iv)). First-stage start date is not an individual test appointment." },
        { stage: "outcome", text: "Verify medical, character, family/service conditions and final appointment terms. Selected government employees need accepted resignation/release from previous service (p. 7, clause 3(iv)); exam success does not guarantee appointment." },
      ],
    },
    venues: [{ kind: "unknown", name: "Applicant examination and practical-test venues not assigned in this extraction" }],
    sources: [
      evidenceSource(source, home.evidence, "MPESB Steno/ASI 2026 current form and rulebook links", "HTML", "English/Hindi"),
      evidenceSource(source, dashboard.evidence, "MPESB Steno/ASI application, correction and exam-start dates", "HTML", "English/Hindi"),
      evidenceSource(source, forms.evidence, "MPOnline joint Steno/ASI 2026 new-application service", "HTML", "Hindi"),
      evidenceSource(source, rulebook.evidence, "MPESB Steno/ASI 2026 original Hindi rulebook", "PDF", "Hindi"),
    ],
    applicationMethod: "online", applicationUrl: notice.applicationUrl,
  });
  return { cycles: [cycle], evidence: [home.evidence, dashboard.evidence, forms.evidence, rulebook.evidence], complete: false, warnings: [
    "Exact-hash pilot covers one joint 2026 Steno/ASI application. Other ESB, MPPSC and departmental recruitment remain gaps.",
    "Hindi extraction awaits human review. Nationality, CPCT, role-specific shorthand and non-MP open-category route are separate conditions.",
    "Midnight wording lacks verified timezone; deadline boundary remains uncertain. Correction service never extends new applications.",
  ] };
};
