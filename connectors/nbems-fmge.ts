/** One exact-bulletin FMGE licensing cycle; source changes require review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  indexUrl: string;
  bulletinUrl: string;
  bulletinSha256: string;
  applicationUrl: string;
  edition: string;
  applicationOpensOn: string;
  applicationOpensLocalTime: string;
  applicationClosesOn: string;
  applicationClosesLocalTime: string;
  officialTimeZone: string;
  medicalDegreeResultBy: string;
  examOn: string;
  plannedResultBy: string;
  totalFeeInr: number;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/nbems-fmge-oct-2026.json", import.meta.url), "utf8")) as Extraction;

/** Scope links to the October accordion, never the adjacent June edition. */
export function verifyFmgeOctoberIndex(html: string): void {
  const heading = 'id="headingoct26"';
  const next = 'id="headingjun26"';
  const start = html.indexOf(heading);
  const end = html.indexOf(next, start + heading.length);
  if (start < 0 || end < 0 || html.indexOf(heading, start + heading.length) !== -1) {
    throw new Error("FMGE October 2026 official index identity changed; review required");
  }
  const section = html.slice(start, end);
  const links = [...section.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const bulletin = links.filter((match) => match[1] === notice.bulletinUrl && /Information Bulletin/i.test(match[2]));
  const application = links.filter((match) => match[1] === notice.applicationUrl && /Application Link/i.test(match[2]));
  if (bulletin.length !== 1 || application.length !== 1 || !/October 2026/.test(section)) {
    throw new Error("FMGE October 2026 bulletin or application link changed; review required");
  }
}

export const nbemsFmge: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("FMGE original bulletin bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("FMGE official index redirected; review required");
  verifyFmgeOctoberIndex(index.text);

  const bulletin = await fetchBytes(notice.bulletinUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(bulletin.bytes).digest("hex");
  if (bulletin.bytes.subarray(0, 5).toString() !== "%PDF-" || bulletin.evidence.url !== notice.bulletinUrl ||
      bulletin.evidence.sha256 !== hash || hash !== notice.bulletinSha256) {
    throw new Error("FMGE October 2026 official bulletin changed; extracted fields withheld");
  }

  const opening = Date.parse(`${notice.applicationOpensOn}T${notice.applicationOpensLocalTime}:00+05:30`);
  // "Till 11:55 PM" includes that local minute; next minute is closed.
  const afterClosingMinute = Date.parse(`${notice.applicationClosesOn}T23:56:00+05:30`);
  const status = now.getTime() < opening ? "upcoming" as const :
    now.getTime() >= afterClosingMinute ? "closed" as const : "open" as const;
  const cycle = makeCycle({
    id: "nbems-fmge-october-2026", sourceId: source.id,
    title: "Foreign Medical Graduate Examination — October 2026",
    programme: "FMGE medical practice screening test",
    cycleLabel: `FMGE ${notice.edition}, bulletin v2.2`,
    authority: source.authority, pathway: "licensing", jurisdictionCode: "IN", jurisdictionName: "India",
    scopeLabel: "National medical licensing screening test for eligible foreign-trained medical graduates. This is one examination application cycle, not a government job vacancy or a licence issued on application.",
    outcome: "Qualified candidates may receive an FMGE pass certificate after in-person identity and credential checks. NMC or a State Medical Council decides provisional or permanent registration separately; passing does not guarantee a licence or job.",
    status,
    statusNote: "Official October 2026 FMGE index and exact v2.2 bulletin retained. New applicants close 25 September at 23:55 IST; later edit and document windows are for existing applicants. Founder review pending, including conflicting Nepalese nationality wording.",
    applicationWindow: { opensOn: notice.applicationOpensOn, closesOn: notice.applicationClosesOn,
      cutoffLocalTime: notice.applicationClosesLocalTime, cutoffInclusive: true,
      officialTimeZone: notice.officialTimeZone, precision: "minute",
      note: "Bulletin page 2: new online applications 11 September 2026 at 17:00 through 25 September 2026 at 23:55 IST. The 29–30 September edit window and 21 October deficient-document deadline do not reopen new applications." },
    qualifications: `Primary medical qualification recognized for medical enrolment in its awarding country, confirmed by the Indian Embassy; final examination result declared by ${notice.medicalDegreeResultBy}. Prior MBBS entry, NMC eligibility certificate or qualifying NEET-UG result, documents and exceptions require individual review (bulletin section 4).`,
    languageNote: "FMGE multiple-choice responses are in English only (section 5.1). Prior MBBS admission criteria mention English qualifying marks. Bulletin states no CEFR or universal spoken-English proficiency level; exam medium and prior academic marks are distinct.",
    citizenshipRule: "Bulletin section 4.1 permits Indian citizens or Overseas Citizens of India (OCI). Section 8.7 separately says non-OCI foreign nationals other than Nepalese cannot apply, suggesting a Nepalese exception that conflicts with section 4.1. Foreign citizens with OCI need document review; Nepalese non-OCI applicants need NBEMS clarification. Nationality alone cannot establish registration rights.",
    residenceRule: "Bulletin gives no general pre-application domicile requirement. Test cities are choices, not residence rules. Registration and practice rights are decided later by the relevant medical council.",
    selectionStages: ["Online application and examination fee", "Primary medical qualification and eligibility document check", `Computer-based FMGE on ${notice.examOn}`, "Result and in-person pass-certificate credential check", "Separate NMC or State Medical Council registration decision"],
    fee: `₹${notice.totalFeeInr.toLocaleString("en-IN")} total examination fee including 18% GST; payment gateway charges may apply (bulletin section 3).`,
    rules: { complete: false, asOn: notice.medicalDegreeResultBy,
      nationality: {
        allowed: ["IN"], ociAccepted: true, uncertain: ["NP"],
        evidence: "FMGE October 2026 official bulletin §4.1 (page 24) accepts Indian citizens or OCI. §8.7 (page 63) separately excludes non-OCI foreign nationals other than Nepalese, leaving Nepalese non-OCI permission unresolved.",
      },
      manualChecks: [
        { stage: "apply", text: "Check citizenship and OCI documentation, Indian-Embassy-confirmed primary medical qualification, 31 August 2026 final-result date, prior MBBS eligibility and NMC certificate/NEET route. Resolve section 4.1 versus 8.7 for Nepalese non-OCI applicants before any positive assessment." },
        { stage: "selection", text: "NBEMS must verify submitted documents and exam admission; English is the examination medium, with no published CEFR level. Admit card alone is provisional eligibility." },
        { stage: "outcome", text: "Confirm examination pass, in-person identity and credential verification, FMGE pass certificate, then independent NMC or State Medical Council registration requirements and permission to practise." },
      ],
    },
    venues: [{ kind: "unknown", name: "Tentative test-city choices published; individual examination centre is allotted later" }],
    sources: [
      evidenceSource(source, index.evidence, "NBEMS FMGE official examination index, October 2026 accordion", "HTML", "English and Hindi"),
      evidenceSource(source, bulletin.evidence, "FMGE October 2026 information bulletin v2.2, 129 pages", "PDF", "English and Hindi"),
    ],
    applicationUrl: notice.applicationUrl,
    examEvents: [{ label: "FMGE computer-based examination", date: notice.examOn, timezone: notice.officialTimeZone, verified: false, sourceUrl: notice.bulletinUrl }],
  });
  return { cycles: [cycle], evidence: [index.evidence, bulletin.evidence], complete: false, warnings: [
    "Only FMGE October 2026 is extracted; June 2026, future FMGE sessions, FDST and other NBEMS pathways remain gaps.",
    "Section 4.1 Indian/OCI eligibility and section 8.7 Nepalese exception conflict; no automatic positive Nepalese or foreign-citizen eligibility is asserted.",
    "English exam medium is not a CEFR requirement. Passing FMGE does not grant medical registration or government employment.",
    "Test-city list is tentative and individual centres are not published in this bulletin; no venue pins are inferred.",
  ] };
};
