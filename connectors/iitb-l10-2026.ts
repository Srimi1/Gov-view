/** IIT Bombay rolling faculty advertisement L-10/25-26; one review-only cycle. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; noticeUrl: string; eligibilityUrl: string; eligibilitySha256: string;
  specializationsUrl: string; specializationsSha256: string; applicationUrl: string;
  advertisement: string; closesOn: string; cutoffLocalTime: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/iitb-l10-2026.json", import.meta.url), "utf8")) as Extraction;

/** Require current index listing; disappearance signals review, never cancellation. */
export function verifyIitbFacultyIndex(html: string): void {
  const path = new URL(notice.noticeUrl).pathname;
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((match) => new URL(match[1], notice.indexUrl).pathname === path &&
      stripTags(match[2]).replace(/\s+/g, " ").includes(`Rolling Advertisement No. ${notice.advertisement}`));
  if (links.length !== 1) throw new Error("IIT Bombay rolling faculty index changed; review required");
}

/** Fail closed when a material advertisement clause, link or deadline changes. */
export function verifyIitbFacultyNotice(html: string): void {
  const text = stripTags(html).replace(/\s+/g, " ");
  const date = /<div class="field__label">Application Last Date<\/div>\s*<div class="field__item"><time\b[^>]*>([^<]+)<\/time>/i.exec(html)?.[1]?.trim();
  if (!text.includes(`Advertisement No. ${notice.advertisement}`) ||
      !/Indian nationals including Persons of Indian Origins \(PIOs\), Overseas Citizens of India \(OCIs\), and foreign nationals for faculty positions at the level of Assistant Professor, Associate Professor, and Professor/i.test(text) ||
      !/This is a rolling advertisement\. Applications will be processed periodically/i.test(text) ||
      !/Additional eligibility criteria are specified separately for each academic unit/i.test(text) ||
      !/Separate applications must be submitted on the portal for every academic unit/i.test(text) ||
      !/good communication skills/i.test(text) ||
      !/Appointment of Foreign Nationals will be on a contract basis for up to 5 years\. Permission from Govt\. of India is mandatory prior to joining the Institute/i.test(text) ||
      !/Political and security clearance from Ministries of External Affairs and Home Affairs is necessary in case of individuals with foreign passports/i.test(text) ||
      !html.includes(`href="${notice.applicationUrl}"`) ||
      !html.includes(`href="${notice.eligibilityUrl}"`) ||
      !html.includes(`href="${notice.specializationsUrl}"`) ||
      date !== "Thu, 31/12/2026 - 23:59" ||
      /corrigendum|cancellation|cancelled|extension/i.test(text.slice(text.indexOf(`Advertisement No. ${notice.advertisement}`), text.indexOf("Application Last Date")))) {
    throw new Error("IIT Bombay L-10 faculty terms or deadline changed; review required");
  }
}

export const iitbL102026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("IIT Bombay original PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  const ad = await fetchText(notice.noticeUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl || ad.evidence.url !== notice.noticeUrl) {
    throw new Error("IIT Bombay faculty source redirected; review required");
  }
  verifyIitbFacultyIndex(index.text);
  verifyIitbFacultyNotice(ad.text);
  const eligibility = await fetchBytes(notice.eligibilityUrl, { accept: "application/pdf" });
  const specializations = await fetchBytes(notice.specializationsUrl, { accept: "application/pdf" });
  for (const [item, url, expected] of [
    [eligibility, notice.eligibilityUrl, notice.eligibilitySha256],
    [specializations, notice.specializationsUrl, notice.specializationsSha256],
  ] as const) {
    const hash = createHash("sha256").update(item.bytes).digest("hex");
    if (item.bytes.subarray(0, 5).toString() !== "%PDF-" || item.evidence.url !== url ||
        item.evidence.sha256 !== hash || hash !== expected) {
      throw new Error("IIT Bombay L-10 PDF changed; review required");
    }
  }

  // The page prints 23:59 but does not name the governing timezone.
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > notice.closesOn ? "closed" as const :
    today === notice.closesOn && clockIn("Asia/Kolkata", now) >= notice.cutoffLocalTime ? "uncertain" as const : "open" as const;
  const sources = [
    evidenceSource(source, index.evidence, "IIT Bombay current faculty application index", "HTML", "English"),
    evidenceSource(source, ad.evidence, "IIT Bombay rolling faculty advertisement L-10/25-26", "HTML", "English"),
    evidenceSource(source, eligibility.evidence, "IIT Bombay academic-unit eligibility criteria L-10/25-26", "PDF", "English"),
    evidenceSource(source, specializations.evidence, "IIT Bombay areas of specialization L-10/25-26", "PDF", "English"),
  ];
  const cycle = makeCycle({
    id: "iitb-faculty-l10-2026", sourceId: source.id,
    title: "Rolling faculty recruitment — Assistant, Associate and Full Professor, IIT Bombay",
    programme: "IIT Bombay rolling faculty recruitment", cycleLabel: `Advertisement ${notice.advertisement}`,
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India",
    scopeLabel: "Central public technical institute in Mumbai, Maharashtra; applications are invited from Indian and foreign nationals. Mumbai is the institution location, not a published interview venue or applicant domicile condition.",
    outcome: "Faculty appointments at Assistant Professor, Associate Professor or Professor rank. Foreign nationals may be appointed on contracts of up to five years, subject to Government of India permission and applicable clearances; no appointment is guaranteed.",
    status,
    statusNote: "Current institute index, detailed advertisement and two academic-unit annexures retained. Rolling call is processed in batches; founder review pending.",
    applicationWindow: { opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: notice.cutoffLocalTime,
      officialTimeZone: null, precision: "minute", note: "Official advertisement metadata prints 31 December 2026, 23:59, without a named governing timezone. This is a rolling call processed periodically; 1 January notice date is not assumed to be application opening date." },
    qualifications: "General route: Ph.D. with first-class or equivalent preceding degree and excellent academic record. Grade I Assistant Professor normally needs three post-Ph.D. years; Grade II may cover shorter experience. Associate Professor normally needs six post-Ph.D. years, including three at Assistant Professor level; Professor needs ten, including four at Associate Professor level. IDC School of Design has published non-Ph.D. Assistant Professor exceptions. Every academic unit has additional criteria in the retained annexures; check exact unit and rank before applying.",
    citizenshipRule: "L-10/25-26 expressly invites Indian nationals, PIOs, OCIs and foreign nationals. Nationality alone does not grant appointment: foreign nationals need Government of India permission before joining; foreign-passport holders need political and security clearances at confirmation.",
    residenceRule: "No Indian or Maharashtra applicant domicile requirement appears in the advertisement. The Institute is in Mumbai; workplace, visa and travel arrangements need individual confirmation.",
    languageNote: "Advertisement asks for good communication skills but names no required language, exam medium, language certificate or proficiency level. English cannot be inferred as an eligibility rule from the page language.",
    selectionStages: ["Submit separate online application for each chosen academic unit", "Academic-unit and rank-specific qualification and research screening", "Shortlisted candidate interview, if invited", "For foreign nationals, Government of India permission before joining", "For foreign-passport holders, political and security clearance at confirmation"],
    fee: "No application fee stated in the checked advertisement; confirm in the official portal before submission.",
    salary: "Salary fixed according to experience and Government of India norms; no rank-specific amount in the checked advertisement.",
    rules: { complete: false, asOn: null,
      nationality: { allowed: ["*"], evidence: "IIT Bombay L-10/25-26 expressly invites Indian nationals, PIOs, OCIs and foreign nationals for faculty positions." },
      manualChecks: [
        { stage: "apply", text: "Check the chosen academic unit's annexed eligibility and specialization criteria, rank, degrees, publications, experience and required portal documents. IDC School of Design has an exception to the general Ph.D. rule. Separate applications are needed per unit." },
        { stage: "selection", text: "Confirm academic-unit screening and interview invitation. The advertisement names good communication skills but no language or formal proficiency level." },
        { stage: "outcome", text: "For foreign nationals, confirm Government of India permission before joining and, for foreign-passport holders, political/security clearances at confirmation. Appointment and up-to-five-year contract terms remain authority decisions." },
      ],
    },
    venues: [{ kind: "unknown", name: "Interview format and venue not published; Mumbai is institute location" }],
    sources, applicationMethod: "online", applicationUrl: notice.applicationUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, ad.evidence, eligibility.evidence, specializations.evidence], complete: false, warnings: [
    "One rolling advertisement is counted as one cycle. Three faculty ranks and separate unit applications are choices within the call; vacancy counts are not printed.",
    "Foreign nationals may apply, but Government of India permission and foreign-passport clearances affect appointment. No specific language or proficiency level is stated.",
    "General Ph.D. wording has IDC School of Design exceptions; unit-specific annexure requirements are not reduced to one automatic rule.",
    "The page prints 23:59 without a named governing timezone. Other IIT Bombay recruitment calls and later amendments remain gaps.",
  ] };
};
