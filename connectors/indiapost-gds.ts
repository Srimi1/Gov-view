/** One document-bound India Post GDS Schedule-II application cycle. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  indexUrl: string; siteChunkUrl: string;
  englishNoticeUrl: string; englishNoticeSha256: string;
  hindiNoticeUrl: string; hindiNoticeSha256: string;
  vacancyAnnexUrl: string; vacancyAnnexSha256: string;
  noticeNumber: string; schedule: string;
  applicationOpensOn: string; applicationClosesOn: string;
  cutoffLocalTime: string; officialTimeZone: string; tentativePostCount: number;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/indiapost-gds-schedule-ii-2026.json", import.meta.url), "utf8")) as Extraction;

/** Dynamic portal dates and document links must still identify this exact schedule. */
export function verifyIndiaPostGdsPortal(html: string, script: string): void {
  const chunkPath = new URL(notice.siteChunkUrl).pathname;
  if (!html.includes(chunkPath) || !html.includes("India Post GDS Online Recruitment")) {
    throw new Error("India Post GDS portal or application script changed; manual review required");
  }
  for (const pattern of [
    /T="July-2026",A="Gramin Dak Sevak \(GDS\) Online Engagement Schedule-II"/,
    /E="2026-09-02T00:01:00\+05:30",k="2026-09-21T17:00:00\+05:30"/,
    /D=e=>window\.open\(`\$\{S\}\$\{e\}`/,
    /D\("\/pdf\/descriptive-notification\.pdf"\)/,
    /D\("\/pdf\/descriptive-notification-hindi\.pdf"\)/,
    /D\("\/pdf\/Annexure-Ia\.pdf"\)/,
  ]) if (!pattern.test(script)) throw new Error("India Post GDS schedule, dates or PDF links changed; manual review required");
}

export const indiaPostGds: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("India Post GDS original PDF bytes required");
  const page = await fetchText(notice.indexUrl, { accept: "text/html" });
  const script = await fetchText(notice.siteChunkUrl, { accept: "application/javascript" });
  if (page.evidence.url !== notice.indexUrl || script.evidence.url !== notice.siteChunkUrl) {
    throw new Error("India Post GDS source redirected; manual review required");
  }
  verifyIndiaPostGdsPortal(page.text, script.text);
  const documents = await Promise.all([
    [notice.englishNoticeUrl, notice.englishNoticeSha256, "Official GDS Schedule-II English notification, 38 pages", "English"],
    [notice.hindiNoticeUrl, notice.hindiNoticeSha256, "Official GDS Schedule-II Hindi notification", "Hindi"],
    [notice.vacancyAnnexUrl, notice.vacancyAnnexSha256, "Official circle-wise tentative post count by language", "English"],
  ].map(async ([url, expectedHash, label, language]) => {
    const original = await fetchBytes(url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(original.bytes).digest("hex");
    if (original.bytes.subarray(0, 5).toString() !== "%PDF-" || original.evidence.url !== url ||
        original.evidence.sha256 !== hash || hash !== expectedHash) {
      throw new Error(`India Post GDS ${label} PDF changed; extracted terms withheld`);
    }
    return { evidence: original.evidence, label, language };
  }));
  const opensAt = Date.parse(`${notice.applicationOpensOn}T00:01:00+05:30`);
  const closesAt = Date.parse(`${notice.applicationClosesOn}T${notice.cutoffLocalTime}:00+05:30`);
  const status = now.getTime() < opensAt ? "upcoming" as const : now.getTime() > closesAt ? "closed" as const : "open" as const;
  const cycle = makeCycle({
    id: "indiapost-gds-schedule-ii-2026", sourceId: source.id,
    title: "Gramin Dak Sevak — Branch Postmaster, Assistant Branch Postmaster and Dak Sevak",
    cycleLabel: `India Post GDS ${notice.schedule}, notification ${notice.noticeNumber}`,
    programme: "Gramin Dak Sevak Online Engagement",
    authority: source.authority, pathway: "recruitment",
    jurisdictionCode: "IN", jurisdictionName: "India",
    scopeLabel: "Department of Posts national application schedule. Tentative post totals span postal circles; office locations are job postings, not published examination venues.",
    outcome: `${notice.tentativePostCount.toLocaleString("en-IN")} tentative posts across BPM, ABPM and Dak Sevak roles. GDS hold civil posts outside regular Central Government civil service; engagement terms differ from regular employment. One application schedule, not one opportunity per post or circle.`,
    status,
    statusNote: "Official portal, English/Hindi notification and circle-wise annex checked. Application and correction windows have passed. First connector output awaits founder review; later amendments and final post allocations need audit.",
    applicationWindow: { opensOn: notice.applicationOpensOn, closesOn: notice.applicationClosesOn,
      cutoffLocalTime: notice.cutoffLocalTime, officialTimeZone: notice.officialTimeZone, precision: "minute",
      note: "Online one-time registration 31 August–19 September 2026, 17:00 IST. Applications and fee payment 2–21 September 2026, 17:00 IST. Separate correction window 23–24 September 2026, 17:00 IST; correction did not reopen new applications." },
    qualifications: "Age 18–40 on 21 September 2026, subject to published category/disability relaxations. Secondary School Examination (Class X) with passes in Mathematics and English from a board recognized by the Government of India, a state or union territory in India; an equivalent qualification from another board is expressly ineligible. Applicant must have studied the post's local language through Class X, with specific alternatives and certificates for Arunachal Pradesh, Goa, Sikkim and Nagaland. Computer knowledge, cycling and adequate other livelihood means are also listed.",
    languageNote: "English pass in Class X is required for all GDS posts. Local language depends on chosen post and usually must have been studied through Class X (English notice §5.2.1 and Annexure-III; circle-wise annex lists languages). Arunachal Pradesh, Goa, Sikkim and Nagaland have additional or alternative government-certificate rules. No CEFR score or single nationwide local-language level is published; confirm chosen post's language before applying.",
    citizenshipRule: "Notification and retained portal do not state nationality or foreign-citizen eligibility. International applicants need Department of Posts confirmation for application and final engagement. An Indian-board qualification alone is not proof of nationality eligibility.",
    residenceRule: "No pre-application domicile rule is stated in the retained notification. Selected BPMs must reside in the post village and provide branch-office accommodation; ABPMs and Dak Sevaks must reside within the relevant delivery jurisdiction before or during engagement.",
    selectionStages: ["One-time registration and online application with post preferences", "Shortlisting from Class X marks and preferences", "Physical document verification", "Provisional offer and pre-engagement checks", "Final engagement after verification"],
    fee: "₹100 for applicants choosing posts in a division; female, SC/ST, persons with benchmark disabilities and transwomen applicants are exempt. Payment and final submission were due by 21 September 2026 at 17:00 IST (English notification, Annexure-II, page 22).",
    salary: "Initial Time Related Continuity Allowance: BPM ₹12,000–₹29,380; ABPM/Dak Sevak ₹10,000–₹24,470, plus applicable allowances (English notification, page 4).",
    rules: { complete: false, asOn: notice.applicationClosesOn,
      age: { min: 18, max: 40, evidence: "English notification, §5.1, pages 4–5: age on final application date, with category and disability relaxations. Individual relaxation must be reviewed." },
      education: { minLevel: "secondary", evidence: "English notification, §5.2.1(a), page 5: Class X passes in Mathematics and English from an Indian-government-recognized board; other equivalent boards excluded. Board recognition and subjects need manual verification." },
      manualChecks: [
        { stage: "apply", text: "Verify nationality permission, recognized Indian board, passes in Mathematics and English, age relaxations, post-specific local-language study or certificate, and fee exemption." },
        { stage: "selection", text: "Verify post-specific local-language evidence, Class X marks, post preferences and physical documents. No examination venue is published for this merit-based selection." },
        { stage: "outcome", text: "Verify nationality/work authorization, residence and branch-office accommodation where applicable, livelihood and cycling requirements, and final engagement documents." },
      ],
    },
    venues: [],
    sources: [
      evidenceSource(source, page.evidence, "India Post GDS official application portal", "HTML", "English"),
      evidenceSource(source, script.evidence, "Portal schedule, dates and official PDF link definitions", "HTML", "English"),
      ...documents.map(({ evidence, label, language }) => evidenceSource(source, evidence, label, "PDF", language)),
    ],
    applicationUrl: notice.indexUrl,
  });
  return { cycles: [cycle], evidence: [page.evidence, script.evidence, ...documents.map((item) => item.evidence)], complete: false,
    warnings: [
      "One registration/application schedule covers 23,757 tentative posts. Posts, circles, languages and venues do not create additional application cycles.",
      "Nationality and foreign-citizen permission are unstated; all three eligibility stages require confirmation.",
      "Local language varies by post and special provisions; no single language or CEFR threshold applies to this national cycle.",
      "This exact-document connector does not cover later GDS schedules, amendments or other Department of Posts notices.",
    ] };
};
