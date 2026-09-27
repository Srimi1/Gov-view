/** Exact DYSL-SM and LRDE JRF calls; first output always requires review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface IndexPage { url: string; rowsSha256: string; rowCount: number }
interface Role {
  id: string; laboratory: string; advertisement: string; listedOn: string;
  detailUrl: string; pdfUrl: string; pdfSha256: string; walkInOn: string;
  willingnessOn: string | null; reporting: string; subdivision: string;
  address: string; city: string; positions: number; qualifications: string;
  languageNote: string; ageNote: string; asOn: string | null; tenure: string;
}
interface Extraction { indexPages: IndexPage[]; pagerUrls: string[]; roles: Role[] }
const data = JSON.parse(readFileSync(new URL("../data/extractions/drdo-jrf-september-2026.json", import.meta.url), "utf8")) as Extraction;
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const compact = (text: string) => stripTags(text).replace(/\s+/g, " ").trim();
const secureUrl = (url: string, base: string) => new URL(url.replace(/^http:/, "https:"), base).href;

/** Keep recruitment cards and result notices visible in evidence; extract only bound calls. */
export function drdoJrfIndexRows(html: string, base: string): { text: string; urls: string[] }[] {
  return [...html.matchAll(/<li class="col-lg-4 col-md-6">([\s\S]*?)<\/li>/g)].map((match) => ({
    text: compact(match[1]),
    urls: [...match[1].matchAll(/href="([^"]+)"/g)].map((link) => secureUrl(link[1], base)),
  }));
}

export function verifyDrdoJrfIndexes(pages: string[]): void {
  if (pages.length !== data.indexPages.length) throw new Error("DRDO index pagination incomplete");
  const all = [];
  for (let i = 0; i < pages.length; i++) {
    const config = data.indexPages[i];
    const rows = drdoJrfIndexRows(pages[i], config.url);
    const pager = [...new Set([...pages[i].matchAll(/href="(\?page=\d+)"/g)]
      .map((link) => new URL(link[1], config.url).href))].sort();
    if (rows.length !== config.rowCount || hash(JSON.stringify(rows)) !== config.rowsSha256 ||
        JSON.stringify(pager) !== JSON.stringify(data.pagerUrls)) {
      throw new Error("DRDO index rows or pagination changed; amendment review required");
    }
    all.push(...rows);
  }
  for (const role of data.roles) {
    const rows = all.filter((row) => row.urls.includes(role.detailUrl));
    const date = role.walkInOn.split("-").reverse().join("/");
    if (rows.length !== 1 || !rows[0].text.includes(role.advertisement) ||
        !rows[0].text.includes(`End Date ${date}`)) {
      throw new Error(`DRDO ${role.laboratory} call identity or event date changed`);
    }
  }
}

export function verifyDrdoJrfDetail(html: string, role: Role): void {
  const text = compact(html);
  const pdfs = [...html.matchAll(/<a\b[^>]*href="([^"]+\.pdf)"/gi)]
    .map((link) => secureUrl(link[1], role.detailUrl));
  if (!text.includes(role.advertisement) ||
      !text.includes(`Published Date ${role.listedOn.split("-").reverse().join("-")}`) ||
      !text.includes(`End Date ${role.walkInOn.split("-").reverse().join("-")}`) ||
      pdfs.length !== 1 || pdfs[0] !== role.pdfUrl) {
    throw new Error(`DRDO ${role.laboratory} detail changed; review required`);
  }
}

function verifyPdf(bytes: Buffer, evidence: Evidence, role: Role): void {
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || evidence.url !== role.pdfUrl ||
      hash(bytes) !== role.pdfSha256 || evidence.sha256 !== role.pdfSha256) {
    throw new Error(`DRDO ${role.laboratory} PDF changed; critical fields withheld`);
  }
}

export const drdoJrfSeptember2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("DRDO JRF original PDF bytes required");
  const indexes = [];
  for (const page of data.indexPages) {
    const result = await fetchText(page.url, { accept: "text/html" });
    if (result.evidence.url !== page.url) throw new Error("DRDO index redirected; review required");
    indexes.push(result);
  }
  verifyDrdoJrfIndexes(indexes.map((page) => page.text));
  const evidence = indexes.map((page) => page.evidence);
  const cycles = [];
  for (const role of data.roles) {
    const detail = await fetchText(role.detailUrl, { accept: "text/html" });
    if (detail.evidence.url !== role.detailUrl) throw new Error("DRDO JRF detail redirected; review required");
    verifyDrdoJrfDetail(detail.text, role);
    const pdf = await fetchBytes(role.pdfUrl, { accept: "application/pdf" });
    verifyPdf(pdf.bytes, pdf.evidence, role);
    evidence.push(detail.evidence, pdf.evidence);
    // Official zone is unstated. A whole-day safety margin avoids an inferred
    // Indian cutoff; event-day clock status remains uncertain.
    const lastCivilDate = civilDateIn("Etc/GMT+12", now);
    const firstCivilDate = civilDateIn("Pacific/Kiritimati", now);
    const status = lastCivilDate > role.walkInOn ? "closed" as const :
      firstCivilDate >= role.walkInOn || (role.willingnessOn && firstCivilDate >= role.willingnessOn)
        ? "uncertain" as const : "open" as const;
    const lrde = role.willingnessOn !== null;
    cycles.push(makeCycle({
      id: role.id, sourceId: source.id, title: `Junior Research Fellowship — DRDO ${role.laboratory}`,
      programme: `DRDO ${role.laboratory} Junior Research Fellowship`, cycleLabel: role.advertisement,
      authority: `DRDO ${role.laboratory}, Ministry of Defence, Government of India`,
      pathway: "recruitment", appointmentType: "temporary", jurisdictionCode: "IN", jurisdictionName: "India",
      subdivisionCodes: [role.subdivision],
      scopeLabel: `Indian-national research fellowship at ${role.laboratory}. Laboratory location is not an applicant domicile condition.`,
      outcome: `${role.positions} JRF ${role.positions === 1 ? "place" : "places"}; ${role.tenure} Fellowship does not confer any right to absorption in DRDO.`,
      status,
      statusNote: lrde
        ? "Walk-in 8 October 2026 follows advised willingness email by 25 September. Notice does not establish whether someone who missed that advisory can attend; verify with LRDE. First output awaits review."
        : "Walk-in 6 October 2026 at 09:30, with prescribed form and email submission step. No email deadline printed; first output awaits review.",
      applicationWindow: { opensOn: null, closesOn: role.walkInOn,
        cutoffLocalTime: lrde ? "09:30" : null, officialTimeZone: null, precision: lrde ? "minute" : "date",
        note: lrde
          ? "8 October is walk-in date, with reporting 08:30–09:30; late arrivals excluded. Willingness email was advised by 25 September, with no email cutoff time. Whether that email is prerequisite needs clarification. Official timezone unstated; index Start Date is not a verified application opening."
          : "6 October is walk-in date, starting 09:30 with latecomers excluded. Supporting documents must also be emailed, but no email receipt deadline is printed. Official timezone unstated; 09:30 is not repurposed as an email cutoff or separate closing time.",
      },
      qualifications: `${role.qualifications} ${role.ageNote}`,
      citizenshipRule: "Original notice expressly restricts applications to Indian nationals. Foreign citizenship, including OCI without Indian citizenship, is not an accepted nationality route in this call.",
      residenceRule: "No applicant domicile condition is printed. Office/venue address does not create a residence rule.",
      languageNote: role.languageNote,
      selectionStages: lrde ? [
        "Send willingness email, advised by 25 September, with JRF-ECE subject; confirm attendance eligibility if missed",
        "Report at LRDE Main Gate Reception 08:30–09:30 on 8 October with prescribed form, original documents, photo ID and required NOC",
        "Document verification from 09:00; written test if necessary and interview that day",
        "Selection panel and antecedent verification before joining; empanelment does not guarantee fellowship",
      ] : [
        "Email prescribed form and supporting documents in PDF below 10 MB; email deadline unspecified",
        "Bring original certificates, prescribed form, photo and self-attested copies to 6 October walk-in at 09:30; latecomers excluded",
        "Screening using valid GATE score where applicable, degree marks, desirable criteria and relevant experience; interview",
        "Selection panel valid one year; empanelment does not guarantee fellowship, and employed applicants need NOC",
      ],
      salary: lrde ? "₹37,000 per month plus admissible HRA." : "₹37,000 per month plus applicable HRA and other emoluments under DRDO rules.",
      fee: "No application fee stated in retained notice; no TA/DA for interview or joining.",
      rules: { complete: false, asOn: role.asOn,
        nationality: { allowed: ["IN"], evidence: `Original ${role.advertisement} notice expressly invites only Indian nationals.` },
        education: { minLevel: "bachelor", finalYearAllowed: false,
          evidence: "Completed qualifying engineering degree is required; first-class/division, discipline and GATE or postgraduate alternative need manual verification." },
        manualChecks: [
          { stage: "apply", text: `${role.qualifications} ${role.ageNote}${lrde ? " Confirm attendance route after 25 September willingness advisory." : " Candidates previously awarded JRF in any DRDO lab are ineligible; confirm email procedure and application date."}` },
          { stage: "selection", text: `Verify originals, valid qualification route, reporting ${role.reporting}, employer NOC and any selection-language expectations.${lrde ? " Non-English documents need self-attested English transcripts; this is a document rule, not a proficiency certificate." : " No language level is published."}` },
          { stage: "outcome", text: "Verify antecedents/documents, availability of fellowship, final tenure and admissible emoluments. Fellowship does not give permanent DRDO employment rights." },
        ],
      },
      workLocations: [role.address],
      venues: [{ kind: "published-address", name: role.address, city: role.city, subdivision: role.subdivision }],
      sources: [
        ...indexes.map((page, i) => evidenceSource(source, page.evidence, `DRDO current vacancy index, page ${i + 1}`, "HTML", "English")),
        evidenceSource(source, detail.evidence, `DRDO ${role.laboratory} JRF detail`, "HTML", "English"),
        evidenceSource(source, pdf.evidence, `${role.advertisement} original notice and application form`, "PDF", "English"),
      ],
      applicationMethod: "in-person", applicationUrl: role.pdfUrl,
    }));
  }
  return { cycles, evidence, complete: false, warnings: [
    "Two exact JRF calls produce two cycles and three fellowship places; repeated index notices and published venues never multiply cycles.",
    "Only DYSL-SM and LRDE are extracted from fourteen current index cards. Index contains result notices as well as applications; other DRDO calls and archive remain gaps.",
    "Both notices restrict applications to Indian nationals. Neither prescribes CEFR, JLPT or any other standardized language level; LRDE requires English transcripts of non-English documents.",
    "LRDE willingness email was advised by 25 September, before 8 October walk-in. Attendance after missing advisory is unresolved, so current application status is uncertain.",
    "DYSL-SM age is counted on actual application date, not walk-in date. LRDE age date is 1 September, with unquantified government-rule relaxations. Neither age limit is auto-applied.",
    "DYSL-SM original PDF prints MechanicalMechatronics without a separator in postgraduate disciplines. Exact wording is preserved and requires authority clarification before approval.",
    "Official deadline timezone is unstated; interview times are not invented email cutoffs. Exact PDF and current index/detail bindings stop changed claims for review.",
  ] };
};
