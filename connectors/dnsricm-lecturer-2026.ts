/** DNS-RICM Patna's August 2026 Lecturer notice; exact, review-only cycle. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string;
  announcementUrl: string; announcementSha256: string;
  detailsUrl: string; detailsSha256: string;
  formUrl: string; formSha256: string;
  registerDate: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/dnsricm-lecturer-2026.json", import.meta.url), "utf8")) as Extraction;

/** Index rows establish source identity, but do not establish advertisement publication date. */
export function verifyDnsricmIndex(html: string): void {
  const expected = [notice.announcementUrl, notice.detailsUrl, notice.formUrl];
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const url of expected) {
    const matches = rows.filter(([, row]) =>
      stripTags(row).includes(notice.registerDate) &&
      [...row.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
        .some(([, href]) => new URL(href, notice.indexUrl).href === url));
    if (matches.length !== 1) throw new Error("DNS-RICM Lecturer register changed; review required");
  }
}

function verifyDocument(bytes: Buffer, url: string, actualUrl: string, expectedHash: string, kind: "PDF" | "JPEG", evidenceHash: string): void {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const magicMatches = kind === "PDF" ? bytes.subarray(0, 5).toString() === "%PDF-" :
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!magicMatches || actualUrl !== url || evidenceHash !== hash || hash !== expectedHash) {
    throw new Error(`DNS-RICM Lecturer ${kind} changed; review required`);
  }
}

export const dnsricmLecturer2026: Connector = async ({ source, fetchText, fetchBytes }) => {
  if (!fetchBytes) throw new Error("DNS-RICM original document bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("DNS-RICM register redirected; review required");
  verifyDnsricmIndex(index.text);
  const announcement = await fetchBytes(notice.announcementUrl, { accept: "image/jpeg" });
  const details = await fetchBytes(notice.detailsUrl, { accept: "application/pdf" });
  const form = await fetchBytes(notice.formUrl, { accept: "application/pdf" });
  verifyDocument(announcement.bytes, notice.announcementUrl, announcement.evidence.url, notice.announcementSha256, "JPEG", announcement.evidence.sha256);
  verifyDocument(details.bytes, notice.detailsUrl, details.evidence.url, notice.detailsSha256, "PDF", details.evidence.sha256);
  verifyDocument(form.bytes, notice.formUrl, form.evidence.url, notice.formSha256, "PDF", form.evidence.sha256);

  const sources = [
    evidenceSource(source, index.evidence, "DNS-RICM dated notice register", "HTML", "English"),
    evidenceSource(source, announcement.evidence, "Lecturer recruitment announcement", "image", "English"),
    evidenceSource(source, details.evidence, "Lecturer qualifications and terms", "PDF", "English"),
    evidenceSource(source, form.evidence, "Lecturer application form", "PDF", "English"),
  ];
  const cycle = makeCycle({
    id: "dnsricm-lecturer-august-2026", sourceId: source.id,
    title: "Contract Lecturer — DNS-RICM Patna",
    programme: "DNS-RICM contract Lecturer recruitment", cycleLabel: "August 2026 notice register entry",
    authority: source.authority, pathway: "recruitment", appointmentType: "contract", jurisdictionCode: "IN", jurisdictionName: "India",
    scopeLabel: "DNS-RICM institute recruitment in Patna, Bihar. Patna is workplace and postal destination, not a published selection venue or applicant domicile requirement.",
    outcome: "Five advertised contract Lecturer positions: Agricultural Economics (1), Finance and Accounting (1), MBA Agribusiness (2), and MBA Operations, Supply Chain and Logistics (1). Initial three-year term may extend to five years subject to performance and institute need.",
    status: "uncertain",
    statusNote: "Application deadline unresolved. Official announcement says within 21 days of publication without printing a publication date; institute register dates the links 14 August 2026. Employment News reports 27 September 2026, but that date and any extension have not been confirmed by the institute. Founder review required.",
    applicationWindow: { opensOn: null, closesOn: null, cutoffLocalTime: null, officialTimeZone: null, precision: "unknown",
      note: "Official announcement gives 21 days from advertisement publication, but does not print publication date or cutoff time. The 14 August register date is not treated as publication date. Employment News's 27 September listing conflicts with a date calculated from that register entry and is not an authority deadline." },
    qualifications: "Master's degree with at least 55% marks in Economics, Agriculture, Commerce or Business Administration; NET for Assistant Professor or qualifying Ph.D. exemption under cited UGC rules; teaching experience in relevant field. MBA/PGDBM preferred. Subject-specific fit and Ph.D. exemption require individual review.",
    citizenshipRule: "The advertisement gives no nationality restriction. The form asks nationality; this does not establish that foreign citizens may apply or receive appointment. International applicants need institute confirmation.",
    residenceRule: "The advertisement gives no applicant domicile requirement. The form asks domicile and permanent address; institute interpretation and ability to work in India need confirmation.",
    languageNote: "No required language, examination medium, language certificate or proficiency level is stated in the checked notice and detailed terms.",
    selectionStages: ["Send prescribed form and self-attested supporting copies by registered post", "Institute checks subject-specific qualifications and experience", "Interview and class demonstration before selection committee", "Original certificates checked before appointment"],
    fee: "No application fee stated in the checked documents; confirm with institute before posting.",
    salary: "Consolidated monthly remuneration ₹40,000–₹90,000, negotiable according to the detailed terms.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Confirm official publication date, deadline, postal receipt rule, subject fit, age reckoning date and any amendment with DNS-RICM. The notice states age not exceeding 38 but gives no age-as-of date. Foreign-citizen application permission is not stated." },
      { stage: "selection", text: "Confirm NET/Ph.D. exemption, teaching experience, interview/class demonstration and any language requirement. No language level is printed." },
      { stage: "outcome", text: "Confirm nationality, work authorization, domicile interpretation, original-certificate checks and contract appointment conditions with institute." },
    ] },
    venues: [{ kind: "unknown", name: "Interview and class demonstration venue not published" }],
    sources, applicationMethod: "post", applicationUrl: notice.formUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, announcement.evidence, details.evidence, form.evidence], complete: false, warnings: [
    "One advertisement counted as one cycle; five posts across four subjects are vacancies, not separate cycles. Subject-specific applications are not established.",
    "Official announcement lacks publication date and absolute deadline. Employment News reports 27 September 2026; institute confirmation or amendment is needed before any deadline can be shown as verified.",
    "Nationality and domicile are form fields, not eligibility permissions or restrictions. International applicant eligibility and formal language level remain unknown.",
  ] };
};
