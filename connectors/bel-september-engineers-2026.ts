/** Exact BEL September engineer calls. Source-wide index and original PDFs require review after change. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface IndexPage { url: string; rowCount: number; rowsSha256: string; pager: number[] }
interface Role { id: string; advertisement: string; pdfUrl: string; pdfSha256: string;
  opensOn: string | null; closesOn: string; indexTitle: string }
const data = JSON.parse(readFileSync(new URL("../data/extractions/bel-september-engineers-2026.json", import.meta.url), "utf8")) as {
  indexPages: IndexPage[]; roles: Role[];
};
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const compact = (html: string) => stripTags(html).replace(/\s+/g, " ").trim();

/** Parse only observed public cards. Do not execute source scripts or read footer links as jobs. */
export function belNotificationCards(html: string, base: string): { title: string; text: string; urls: string[] }[] {
  return html.split('<div class="career-result-box">').slice(1).map((segment) => {
    let depth = 1;
    let end = -1;
    for (const tag of segment.matchAll(/<\/?div\b[^>]*>/g)) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      if (depth === 0) { end = tag.index + tag[0].length; break; }
    }
    const heading = /<h2>([\s\S]*?)<\/h2>/.exec(segment);
    if (end < 0 || !heading) throw new Error("BEL card structure changed; review required");
    const card = segment.slice(0, end);
    const urls = [...card.matchAll(/href="([^"]+)"/g)].map((link) => {
      const url = new URL(decodeEntities(link[1]), base);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("BEL card link scheme changed");
      return url.href;
    });
    return { title: compact(heading[1]), text: compact(card), urls };
  });
}

/** Observed page_num navigation only; javascript links are read as data, never evaluated. */
export function belPagination(html: string): number[] {
  if (!/function getPagination\(id\)/.test(html) || !/queryParams\.set\("page_num",id\)/.test(html)) {
    throw new Error("BEL pagination contract changed");
  }
  return [...html.matchAll(/onclick="return getPagination\(\s*(\d+)\s*\);"/g)].map((match) => Number(match[1]));
}

export function verifyBelIndexes(pages: string[]): void {
  if (pages.length !== data.indexPages.length || pages.length !== 11) throw new Error("BEL index pagination incomplete");
  const all = [];
  for (let i = 0; i < pages.length; i++) {
    const expected = data.indexPages[i];
    const cards = belNotificationCards(pages[i], expected.url);
    if (cards.length !== expected.rowCount || hash(JSON.stringify(cards)) !== expected.rowsSha256 ||
        JSON.stringify(belPagination(pages[i])) !== JSON.stringify(expected.pager)) {
      throw new Error("BEL notice cards or pagination changed; amendment review required");
    }
    all.push(...cards);
  }
  for (const role of data.roles) {
    const matches = all.filter((card) => card.urls.includes(role.pdfUrl));
    if (matches.length !== 1 || matches[0].title !== role.indexTitle ||
        !matches[0].text.includes(role.closesOn.split("-").reverse().join("-"))) {
      throw new Error("BEL selected call identity or deadline changed");
    }
  }
}

export const belSeptemberEngineers2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("BEL original PDF bytes required");
  const indexes = [];
  for (const page of data.indexPages) {
    const result = await fetchText(page.url, { accept: "text/html" });
    if (result.evidence.url !== page.url) throw new Error("BEL index redirected; review required");
    indexes.push(result);
  }
  verifyBelIndexes(indexes.map((page) => page.text));
  const evidence = indexes.map((page) => page.evidence);
  const cycles = [];
  for (const [i, role] of data.roles.entries()) {
    const pdf = await fetchBytes(role.pdfUrl, { accept: "application/pdf" });
    if (pdf.evidence.url !== role.pdfUrl || pdf.bytes.subarray(0, 5).toString() !== "%PDF-" ||
        hash(pdf.bytes) !== role.pdfSha256 || pdf.evidence.sha256 !== role.pdfSha256 ||
        pdf.evidence.bytes !== pdf.bytes.length) {
      throw new Error("BEL PDF changed; critical fields withheld");
    }
    evidence.push(pdf.evidence);
    const ghaziabad = i === 0;
    // Source timezone and cutoff are unstated. Never infer either from Indian office location.
    const earliestDate = civilDateIn("Pacific/Kiritimati", now);
    const latestDate = civilDateIn("Etc/GMT+12", now);
    const status = latestDate > role.closesOn ? "closed" as const :
      ghaziabad || earliestDate >= role.closesOn ? "uncertain" as const :
      role.opensOn && earliestDate < role.opensOn ? "upcoming" as const :
      role.opensOn && latestDate < role.opensOn ? "uncertain" as const : "open" as const;
    const qualifications = ghaziabad
      ? "Three-year diploma in Electronics/Electrical engineering or equivalent, pass class. 100% ex-servicemen: Indian Air Force Junior Warrant Officer or above with at least 15 years of service. Retirement dates conflict: table says on/before 1 August 2026, Hindi section 5 says 31 July, English section 5 says 1 July; later clause accepts probable discharge within three months of advertisement. All readings need authority reconciliation. Age on 1 August: general 50, OBC 53, SC/ST 55, with government-rule PwBD relaxation not quantified. Rank, branch equivalence, medical category, conduct and discharge evidence require review."
      : "Full-time BE/BTech/four-year BSc Engineering from AICTE-approved college or recognized university in specified Computer Science/IT or Electronics branches. General/OBC/EWS 60%; SC/ST/PwBD 50%. At least four years of post-qualification industrial experience by 1 August 2026; pre-degree work, academic/teaching, research, apprenticeship, banking/financial, nonprofit and curricular internships excluded. Domain-specific experience required; Database Administrator route additionally requires Microsoft SQL certification. Age 35 on 1 August, OBC +3, SC/ST +5, PwBD (at least 40%) +10, additive where applicable; ex-serviceman government-rule relaxation needs verification. Existing BEL fixed-term E-III employees cannot apply laterally to the same post.";
    cycles.push(makeCycle({
      id: role.id, sourceId: source.id,
      title: ghaziabad ? "Senior Assistant Engineer E-I — BEL Ghaziabad, ex-servicemen" : "Senior Engineer E-III — BEL Export Manufacturing SBU, Bengaluru",
      programme: ghaziabad ? "BEL Ghaziabad Senior Assistant Engineer" : "BEL Export Manufacturing Senior Engineer",
      cycleLabel: role.advertisement,
      authority: "Bharat Electronics Limited, Government of India enterprise under Ministry of Defence",
      pathway: "recruitment", appointmentType: "contract", jurisdictionCode: "IN", jurisdictionName: "India",
      scopeLabel: "Central public-sector enterprise recruitment. Unit/work locations do not create applicant domicile conditions.",
      outcome: ghaziabad
        ? "36 posts: 33 Electronics and 3 Electrical. Fixed tenure; body describes up to 15 years, renewable every five years or superannuation at 60, whichever earlier. Form title says fixed tenure five years; confirm initial appointment terms. Not permanent employment."
        : "12 posts across three mutually exclusive job codes: EMCS01 Computer Science database/software (5), EMEC02 Electronics embedded systems (5), EMCS03 Computer Science 3D visualization (2). Fixed term five years, extendable by two based on performance and project needs. Not permanent employment.",
      status, statusNote: ghaziabad
        ? "Receipt deadline 16 October 2026; retirement/discharge criteria conflict in original notice. First output requires review and authority clarification."
        : "Online registration 9–29 September 2026, with cutoff hour and timezone unstated. First output requires review.",
      applicationWindow: { opensOn: role.opensOn, closesOn: role.closesOn, cutoffLocalTime: null,
        officialTimeZone: null, precision: "date", note: ghaziabad
          ? "16 October is receipt deadline for postal/courier application, not postmark. Notice date 25 September is not a verified opening date. No cutoff time or official timezone printed."
          : "Printed online registration period 9–29 September. No cutoff time or official timezone printed; fee payment alone is not a completed application." },
      qualifications,
      citizenshipRule: ghaziabad
        ? "No explicit citizenship rule found in this notice. Required Indian Air Force service does not by itself prove a foreign citizen may apply or justify an invented nationality whitelist. International-applicant eligibility needs verification."
        : "Only Indian nationals are eligible to apply. Foreign citizenship, including OCI without Indian citizenship, is not an accepted route in this call.",
      residenceRule: "No applicant domicile restriction printed; Ghaziabad/Bengaluru unit addresses are not residence rules.",
      languageNote: ghaziabad
        ? "Notice is bilingual English/Hindi; no standardized human-language proficiency level printed. Languages-known form fields and English interpretation clause are not proficiency requirements."
        : "Retained notice body is English. General condition 27 says advertisement is available bilingually, but no Hindi notice body was retained; translation remains a gap. No standardized human-language proficiency level printed. C/C++, Python, Java, SQL and C# are technical skills, not human-language frameworks.",
      selectionStages: ghaziabad ? [
        "Send prescribed Annexure 1 form and supporting certificates by registered post, speed post or courier to Deputy General Manager (HR & Admin), BEL Ghaziabad; receipt by 16 October. Hand delivery rejected.",
        "Verify diploma, IAF service/rank, medical category, conduct, discharge, category and employer NOC. Resolve contradictory retirement dates before eligibility decision.",
        "Written test, then interview shortlisted in 1:7 ratio. Published examination venue unavailable.",
        "Document/antecedent and medical checks; fixed-tenure appointment subject to final employer decision and project posting across India.",
      ] : [
        "Select only one job code and register on BEL-linked jobapply portal 9–29 September. Pay applicable fee and complete online application; tests/interviews occur on the same day across codes.",
        "Verify completed degree, exact discipline, marks, four years of qualifying industrial experience, role skills/certification, category and employer NOC.",
        "Written test in Bengaluru only, followed by interview in 1:7 shortlist ratio. Selection weights written test 85%, interview 15%; exact centre and interview venue not published.",
        "Document/antecedent and medical checks before fixed-term appointment; extension depends on performance and project needs.",
      ],
      fee: ghaziabad ? "No fee amount or exemption rule stated in retained notice; absence does not establish free application."
        : "₹472 (₹400 plus 18% GST) for General/EWS/OBC. SC/ST/PwD/ex-servicemen exempt. Fee non-refundable.",
      salary: ghaziabad ? "E-I pay scale ₹30,000–120,000 plus company-rule allowances and benefits."
        : "E-III pay scale ₹50,000–160,000 plus company-rule allowances and benefits.",
      rules: { complete: false, asOn: "2026-08-01",
        ...(ghaziabad ? {} : { nationality: { allowed: ["IN"], evidence: "Original BGEM/2627/09/01 notice, general conditions 1: Only Indian Nationals are eligible to apply." } }),
        education: { minLevel: ghaziabad ? "diploma" : "bachelor", finalYearAllowed: false,
          evidence: ghaziabad ? "Completed three-year Electronics/Electrical diploma or equivalent required; discipline/equivalence remains manual."
            : "Completed qualifying engineering degree required; exact branch, institution recognition, marks and post-qualification experience remain manual." },
        // General experienceYears cannot certify military rank/service or post-degree industrial experience.
        manualChecks: [
          { stage: "apply", text: qualifications + (ghaziabad ? " Verify citizenship permission directly with BEL; do not resolve retirement conflict automatically." : " Verify Indian nationality and choose only one job code.") },
          { stage: "selection", text: "Check original documents, degree equivalence, category/disability and admissible age relaxations, employer permission/NOC, selection arrangements and any language expectations. No formal language level established." },
          { stage: "outcome", text: "Verify medical fitness, antecedents, document authenticity, final tenure and employer posting decision. Minimum criteria and selection do not guarantee appointment." },
        ] },
      workLocations: ghaziabad ? ["BEL Ghaziabad Unit; project posting across India"] : ["BEL Export Manufacturing SBU, Bengaluru"],
      venues: [{ kind: "unknown", name: ghaziabad ? "Written-test/interview venue not published" : "Written test: Bengaluru only; exact centre and interview venue not published" }],
      sources: [
        ...indexes.map((page, n) => evidenceSource(source, page.evidence, `BEL job notifications, page ${n + 1}`, "HTML", "English")),
        evidenceSource(source, pdf.evidence, `${role.advertisement} original notice${ghaziabad ? " and Annexure 1 form" : ""}`, "PDF", ghaziabad ? "English/Hindi" : "English"),
      ],
      applicationMethod: ghaziabad ? "post" : "online",
      applicationUrl: ghaziabad ? role.pdfUrl : "https://jobapply.in/BEL2026JALAHALLIEXPORT",
    }));
  }
  return { cycles, evidence, complete: false, warnings: [
    "Two distinct application cycles, 48 posts. Branches, mutually exclusive job codes, unit locations and linked forms do not multiply cycle totals.",
    "All eleven current index pages retained, but only two exact September notices extracted. Other calls, cancellations, DOCX documents, archive changes and certificate/payment attachments remain review/collection gaps.",
    "Ghaziabad table, Hindi and English section 5 print different retirement dates; currently-serving discharge clause adds another conflict. Authority clarification required; no eligibility/date reading silently selected.",
    "Bengaluru permits only Indian nationals. Ghaziabad citizenship permission is unstated despite mandatory IAF service. Neither publishes standardized human-language level.",
    "Bengaluru condition 27 describes bilingual availability, but retained nine-page notice body is English; Hindi counterpart not identified or fetched. Ghaziabad English/Hindi readings are retained together, including retirement conflict.",
    "Dates retain date precision and unknown official timezone. No inferred cutoff, cancellation from disappearance, automatic age relaxation, industrial-experience equivalence or examination pin.",
    "First output is draft-only. Bound card/pagination/PDF changes stop extraction for review; source remains disabled pending acceptance.",
  ] };
};
