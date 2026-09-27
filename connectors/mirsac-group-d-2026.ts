/** Mizoram Remote Sensing Application Centre Group D notice, draft-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  registerUrl: string; detailUrl: string; noticeUrl: string; noticeSha256: string;
  formUrl: string; formSha256: string; advertisement: string; noticeDate: string;
  publishedOn: string; closesOn: string; positions: number;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/mirsac-group-d-2026.json", import.meta.url), "utf8")) as Extraction;

/** Keep exact current links and printed date; an amendment needs renewed review. */
export function verifyMirsacPages(registerHtml: string, detailHtml: string): void {
  const link = `<a href="${notice.detailUrl}" rel="bookmark">Recruitment for Group D (Provisional Employee) – 2 Posts</a>`;
  const registerEntries = registerHtml.split(link).length - 1;
  if (registerEntries !== 1 || !registerHtml.includes("September 22, 2026")) {
    throw new Error("MIRSAC recruitment register changed or duplicated; review required");
  }
  const article = /<div class="entry-content clear"[\s\S]*?<\/div><!-- \.entry-content \.clear -->/i.exec(detailHtml)?.[0];
  if (!article) throw new Error("MIRSAC recruitment detail article changed; review required");
  const text = stripTags(article).replace(/\s+/g, " ");
  if (!text.includes("2 (two) posts of Group ‘D’ on Provisional Employee engagement") ||
      !text.includes("30 October 2026") || !text.includes("during office hours") ||
      !article.includes(`href="${notice.noticeUrl}"`) || !article.includes(`href="${notice.formUrl}"`) ||
      /corrigendum|addendum|extension|revised/i.test(text)) {
    throw new Error("MIRSAC Group D post, date or document links changed; review required");
  }
}

export const mirsacGroupD2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("MIRSAC original notice and form bytes required");
  const [register, detail] = await Promise.all([
    fetchText(notice.registerUrl, { accept: "text/html" }),
    fetchText(notice.detailUrl, { accept: "text/html" }),
  ]);
  if (register.evidence.url !== notice.registerUrl || detail.evidence.url !== notice.detailUrl) {
    throw new Error("MIRSAC page redirected; review required");
  }
  verifyMirsacPages(register.text, detail.text);
  const [advertisement, form] = await Promise.all([
    fetchBytes(notice.noticeUrl, { accept: "application/pdf" }),
    fetchBytes(notice.formUrl, { accept: "application/pdf" }),
  ]);
  for (const [item, url, expected] of [
    [advertisement, notice.noticeUrl, notice.noticeSha256],
    [form, notice.formUrl, notice.formSha256],
  ] as const) {
    const sha256 = createHash("sha256").update(item.bytes).digest("hex");
    if (item.bytes.subarray(0, 5).toString() !== "%PDF-" || item.evidence.url !== url ||
        item.evidence.sha256 !== sha256 || sha256 !== expected) {
      throw new Error("MIRSAC Group D PDF changed; applicant rules withheld");
    }
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > notice.closesOn ? "closed" as const
    : today === notice.closesOn || today < notice.publishedOn ? "uncertain" as const
    : "open" as const;
  const sources = [
    evidenceSource(source, register.evidence, "MIRSAC current news and notices", "HTML", "English"),
    evidenceSource(source, detail.evidence, "MIRSAC Group D recruitment detail", "HTML", "English"),
    evidenceSource(source, advertisement.evidence, "MIRSAC advertisement 1 of 2026–2027, scanned original", "scanned PDF", "Mizo and English"),
    evidenceSource(source, form.evidence, "MIRSAC Group D provisional employee application form", "PDF", "English"),
  ];
  const cycle = makeCycle({
    id: "mirsac-group-d-pe-2026", sourceId: source.id,
    title: "Group D Provisional Employee — MIRSAC", programme: "MIRSAC Group D recruitment 2026–2027",
    cycleLabel: `Advertisement ${notice.advertisement}`, authority: source.authority,
    pathway: "recruitment", appointmentType: "temporary", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-MZ"],
    scopeLabel: "Mizoram Remote Sensing Application Centre provisional employment. Notice names Aizawl application-delivery office; final work posting and selection venue are not separately stated.",
    outcome: `${notice.positions} Group D Provisional Employee positions; ₹11,529 monthly remuneration plus ₹461 medical allowance (₹11,990 total). Notice does not state tenure or confer permanent-service status.`,
    status,
    statusNote: "Original signed one-page scan, form, authority article and news register retained. First connector output awaits founder review. No exact office closing clock time is printed.",
    applicationWindow: { opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: null, officialTimeZone: null, precision: "date",
      note: "Signed advertisement and authority article: applications due 30 October 2026 during office hours at MIRSAC, MINECO, Khatla, Aizawl. Opening date and exact office closing hour are not printed; 22 September is article publication date only." },
    qualifications: "High School Leaving Certificate (HSLC) from a recognized institution; working knowledge of Mizo language up to middle-school standard, per signed advertisement table. The form asks for proof of passing Mizo as a subject in Class VIII or above. Exact equivalence and documents require review.",
    citizenshipRule: "Signed advertisement and application form do not state a nationality or foreign-citizen rule. International applicant permission needs MIRSAC Recruitment Rules, 2018 or authority confirmation; permanent-address and identity fields alone cannot establish citizenship restriction.",
    residenceRule: "No Mizoram domicile or residence condition is printed in the retained advertisement or form. Aizawl is the delivery office, not evidence of applicant domicile.",
    languageNote: "Working knowledge of Mizo up to middle-school standard is required. Application form asks for a certificate or marksheet showing Mizo passed in Class VIII or above. No CEFR or other standardized proficiency level is specified.",
    selectionStages: ["Obtain official form and submit it with documents and applicable fee to MIRSAC office during office hours", "Selection stages and venue are not stated in retained notice; authority review required", "Document and Mizo-language proof verification before provisional engagement"],
    fee: "₹200 general; ₹150 SC/ST/OBC; persons with disabilities exempt. Pay with submitted form, as stated in signed advertisement.",
    salary: "₹11,529 monthly plus ₹461 medical allowance (₹11,990 total).",
    rules: { complete: false, asOn: null,
      education: { minLevel: "secondary", evidence: "MIRSAC advertisement 1 of 2026–2027, signed page 1, qualification row: HSLC from a recognized institution." },
      languages: [{ language: "lus", stage: "apply", mandatory: true, certificateRequired: true,
        requirement: "Working knowledge of Mizo up to middle-school standard; form asks for Mizo Class VIII-or-above pass certificate or marksheet. No CEFR equivalent is stated.",
        evidence: "Signed advertisement page 1, qualification row 5(2); official application form page 1, checklist item Mizo Proficiency.", sourceUrl: notice.noticeUrl }],
      manualChecks: [
        { stage: "apply", text: "Confirm citizenship/work authorization from MIRSAC Recruitment Rules, 2018; original notice and form do not decide foreign eligibility or domicile." },
        { stage: "apply", text: "Confirm HSLC, Mizo Class VIII-or-above proof, age 18–35 at authority's unstated reckoning date, applicable SC/ST five-year upper-age relaxation, complete documents and fee/exemption." },
        { stage: "selection", text: "Confirm selection method, venue and examination admission; none is published in this notice." },
        { stage: "outcome", text: "Confirm provisional employment terms, verification and final posting with MIRSAC." },
      ],
    },
    venues: [{ kind: "unknown", name: "Selection venue not published; Aizawl office is application-delivery address" }],
    sources, applicationMethod: "in-person", applicationUrl: notice.formUrl,
  });
  return { cycles: [cycle], evidence: [register.evidence, detail.evidence, advertisement.evidence, form.evidence], complete: false, warnings: [
    "Two provisional positions form one Group D application cycle; no extra opportunity count comes from vacancies.",
    "Foreign-citizen eligibility, applicant domicile and age reckoning date are unstated. Obtain MIRSAC Recruitment Rules, 2018 or authority confirmation before a positive or negative international verdict.",
    "Mizo working knowledge has a published middle-school standard and Class VIII proof wording; do not convert it to CEFR.",
    "The 30 October deadline ends during unspecified office hours. No cutoff time or official timezone is printed.",
    "Notice is a scanned Mizo/English original; visual founder review must confirm OCR and provisional-employment classification.",
    "Only advertisement 1 of 2026–2027 is bound; other MIRSAC and Mizoram authorities remain coverage gaps.",
  ] };
};
