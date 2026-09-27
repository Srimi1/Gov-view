/** One scanned Pune Divisional Commissioner legal-officer notice; draft-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; documentUrl: string; pdfSha256: string;
  indexDate: string; closesOn: string; vacancies: number;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/pune-divcomm-legal-officer-2026.json", import.meta.url), "utf8")) as Extraction;

/** Bind single legal-officer row to official scanned PDF; other page items cannot inherit its fields. */
export function verifyPuneLegalIndex(html: string): void {
  const rows = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => match[1])
    .filter((row) => /Legal Officer/i.test(stripTags(row)));
  if (rows.length !== 1 || !/recruitment of one Legal Officer \(contractual\)/i.test(stripTags(rows[0]))) {
    throw new Error("Pune Legal Officer index row missing or amended; review required");
  }
  const row = rows[0];
  const links = [...row.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => new URL(match[1], notice.indexUrl).href);
  if (!stripTags(row).includes(notice.indexDate) || links.length !== 1 || links[0] !== notice.documentUrl) {
    throw new Error("Pune Legal Officer date or official notice link changed; review required");
  }
}

export const puneDivcommLegal2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Pune Legal Officer scanned PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("Pune recruitment index redirected; review required");
  verifyPuneLegalIndex(index.text);
  const pdf = await fetchBytes(notice.documentUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== notice.documentUrl ||
      pdf.evidence.sha256 !== hash || hash !== notice.pdfSha256) {
    throw new Error("Pune Legal Officer PDF changed; extracted fields withheld");
  }
  const closed = civilDateIn("Etc/GMT+12", now) > notice.closesOn;
  const cycle = makeCycle({
    id: "pune-divcomm-legal-officer-2026", sourceId: source.id,
    title: "Legal Officer — Divisional Commissioner, Pune",
    cycleLabel: "2026 · Legal Officer contract", programme: "Pune Divisional Commissioner Legal Officer recruitment",
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-MH"],
    scopeLabel: "One 11-month contract at Divisional Commissioner's Office, Pune Division. Work location is not a published interview venue.",
    outcome: "Possible 11-month contractual Legal Officer appointment; notice says selected person is not a regular government employee.",
    status: closed ? "closed" : "uncertain",
    statusNote: closed ? "Published application receipt date has passed; later replacement notice not verified. Founder review pending." : "Paper application must reach Pune office by 31 August 2026 during office hours. Exact cutoff hour and official timezone are not stated. Founder review pending.",
    applicationWindow: { opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: null, officialTimeZone: null,
      precision: "date", note: "Scanned Marathi notice page 1 says applications must be received at Divisional Commissioner office by 31 August 2026 during office hours, excluding government holidays. No opening date or exact receipt hour is stated." },
    qualifications: "Notice page 1 requires a law degree from a recognised university, Bar Council membership, at least seven years' legal-practice experience, and age not above 45 at appointment. Detailed merit and document checks need founder review.",
    citizenshipRule: "The checked scanned notice page states no Indian-citizenship or foreign-citizen rule. International applicants must obtain authority confirmation before assuming they can apply or take the resulting appointment.",
    residenceRule: "No applicant domicile condition is stated in the checked notice page. Pune is contract work and submission location, not evidence of a residence eligibility rule.",
    languageNote: "Notice page 1 asks for adequate knowledge of Marathi, Hindi and English. It gives no formal certificate, CEFR level or test score; applicant ability and assessment method need verification.",
    selectionStages: ["Submit paper application and supporting documents to Pune office", "Shortlisting on qualifications and merits", "Interview for shortlisted candidates", "Appointment decision and document checks"],
    fee: "No application fee found in the checked notice page; confirm from full notice before relying on this.",
    salary: "Notice page 1 states ₹45,000 monthly honorarium plus ₹5,000 fixed allowance, total ₹50,000 monthly.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Check whether foreign citizens may apply; page 1 gives no nationality rule. Confirm law degree, Bar Council status, seven years' practice, age at appointment, paper submission and any other notice conditions." },
      { stage: "selection", text: "Confirm adequate Marathi, Hindi and English ability; no formal level or test is printed. Interview venue is not published in checked notice page." },
      { stage: "outcome", text: "Confirm foreign-citizen contract appointment permission, document checks and 11-month service terms with the authority." },
    ] },
    venues: [{ kind: "unknown", name: "Interview venue not published in checked notice page" }],
    sources: [
      evidenceSource(source, index.evidence, "Pune Division official recruitment page", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "Legal Officer 2026 scanned notice, decision and application form", "scanned PDF", "Marathi"),
    ],
    applicationUrl: notice.documentUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "Only one Pune Division notice staged. Other Maharashtra authorities and PSC notices remain coverage gaps.",
    "Scanned Marathi page was manually read; founder must confirm translation, eligibility, pay and any later notice before approval.",
    "Nationality, residence, interview venue, application cutoff hour and formal language level are unverified; no foreign-citizen match is inferred.",
  ] };
};
