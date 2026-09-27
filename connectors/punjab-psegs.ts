/** Punjab State e-Governance Society contract recruitment, pending founder review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  cycleId: string; stateIndexUrl: string; departmentIndexUrl: string;
  stateDetailedUrl: string; departmentDetailedUrl: string; detailedSha256: string;
  stateNewspaperUrl: string; departmentNewspaperUrl: string; newspaperSha256: string;
  opensOn: null; closesOn: string; cutoffLocalTime: string; ageAsOn: string;
  vacancies: number; monthlyGrossInr: number; initialContractYears: number;
  feeInr: number; minimumRelevantExperienceYears: number; officialApplicationInfoUrl: string;
}
const details = JSON.parse(readFileSync(new URL("../data/extractions/punjab-psegs-dgm-cyber-02-2026.json", import.meta.url), "utf8")) as Extraction;
export const PUNJAB_STATE_INDEX = details.stateIndexUrl;
export const PUNJAB_DIT_INDEX = details.departmentIndexUrl;
export const PUNJAB_PDFS = [details.stateDetailedUrl, details.departmentDetailedUrl, details.stateNewspaperUrl, details.departmentNewspaperUrl] as const;

function relevantLinks(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((match) => /DGM.*Cyber[\s-]+Security/i.test(stripTags(match[2])))
    .map((match) => match[1]);
}

export function checkPunjabStateIndex(html: string): void {
  const expected = [details.stateDetailedUrl, details.stateNewspaperUrl].sort();
  if (JSON.stringify(relevantLinks(html).sort()) !== JSON.stringify(expected)) {
    throw new Error("Punjab state DGM Cyber Security links changed; review required");
  }
  const position = html.indexOf(details.stateDetailedUrl);
  const row = html.slice(position, html.indexOf("</li>", position));
  if (position < 0 || !/Department of Good Governance and Information Technology/.test(row) || !/08-10-2026/.test(row)) {
    throw new Error("Punjab state DGM Cyber Security deadline or department changed; review required");
  }
}

export function checkPunjabDitIndex(html: string): void {
  const expected = [details.departmentDetailedUrl, details.departmentNewspaperUrl].sort();
  if (JSON.stringify(relevantLinks(html).sort()) !== JSON.stringify(expected)) {
    throw new Error("Punjab DGG&IT DGM Cyber Security links changed; review required");
  }
}

export const punjabPsegs: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Punjab PSeGS original PDF byte fetch required");
  const [state, department] = await Promise.all([
    fetchText(PUNJAB_STATE_INDEX, { accept: "text/html" }),
    fetchText(PUNJAB_DIT_INDEX, { accept: "text/html" }),
  ]);
  if (state.evidence.url !== PUNJAB_STATE_INDEX || department.evidence.url !== PUNJAB_DIT_INDEX) {
    throw new Error("Punjab official recruitment index redirected; review required");
  }
  checkPunjabStateIndex(state.text);
  checkPunjabDitIndex(department.text);
  const documents = await Promise.all(PUNJAB_PDFS.map((url) => fetchBytes(url, { accept: "application/pdf" })));
  for (let index = 0; index < PUNJAB_PDFS.length; index += 1) {
    const document = documents[index];
    const expected = index < 2 ? details.detailedSha256 : details.newspaperSha256;
    const hash = createHash("sha256").update(document.bytes).digest("hex");
    if (document.bytes.subarray(0, 5).toString() !== "%PDF-" || document.evidence.url !== PUNJAB_PDFS[index] ||
      document.evidence.sha256 !== hash || hash !== expected) {
      throw new Error("Punjab PSeGS PDF changed; extracted fields withheld");
    }
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > details.closesOn ? "closed" : "open";
  const cycle = makeCycle({
    id: details.cycleId,
    sourceId: source.id,
    title: "Punjab Deputy General Manager (Technical) Cyber Security 2026",
    cycleLabel: "PSeGS advertisement 02/2026",
    programme: "Punjab State e-Governance Society contract recruitment",
    authority: source.authority,
    pathway: "recruitment",
    jurisdictionCode: "IN",
    jurisdictionName: "India",
    subdivisionCodes: ["IN-PB"],
    scopeLabel: "One Punjab State e-Governance Society cyber security contract post based at Mohali; employer address is not a selection venue",
    outcome: `One Deputy General Manager (Technical) Cyber Security appointment on an initial ${details.initialContractYears}-year contract, potentially renewed year by year subject to performance and need`,
    status,
    statusNote: "Current Punjab state recruitment register and DGG&IT homepage link identical detailed and newspaper notices. Opening date is unprinted; founder review and off-domain form verification pending. Notice permits future postponement but announces none.",
    applicationWindow: {
      opensOn: details.opensOn,
      closesOn: details.closesOn,
      officialTimeZone: "Asia/Kolkata",
      cutoffLocalTime: details.cutoffLocalTime,
      cutoffInclusive: true,
      precision: "minute",
      note: "Detailed original advertisement page 2 and newspaper notice page 1: online submission on or before 8 October 2026 by 11:59 PM IST. Neither source prints an application opening date.",
    },
    qualifications: "Recognized B.E./B.Tech/B.Sc in IT, Computer Science or Electronics, or BCA, with at least 50%; 13 years relevant cyber security experience. Management MBA/PGDM/PGDBM/PGP is preferred, not mandatory. Working Punjabi is essential; Matric Punjabi or later specified test route applies.",
    citizenshipRule: "Neither official PDF states citizenship or a foreign-national application/appointment route. International applicants need PSeGS confirmation at application, selection and contract appointment stages.",
    residenceRule: "No Punjab domicile requirement is printed for this general-category post. Employer's Mohali address describes workplace, not applicant residence eligibility.",
    selectionStages: ["Online application and non-refundable fee proof", "Eligibility screening of degree, minimum marks, experience and Punjabi knowledge", "Scoring of qualifications and experience plus internal/external committee scrutiny", "Evaluation or interview invitation by email, then contract appointment checks"],
    fee: `₹${details.feeInr.toLocaleString("en-IN")} non-refundable, paid by RTGS as directed in official PDF page 2. Verify payment account and Google Form with PSeGS before sending money or documents; this draft links to the official notice, not the off-domain form.`,
    salary: `₹${details.monthlyGrossInr.toLocaleString("en-IN")} gross per month (official PDF page 1).`,
    rules: { complete: false, asOn: details.ageAsOn,
      age: { max: 42, evidence: "Original advertisement page 1: maximum 42 years as on 1 August 2026; no relaxation stated in this notice." },
      education: { minLevel: "bachelor", evidence: "Original advertisement page 1: B.E./B.Tech/B.Sc in specified IT/computer/electronics fields or BCA from recognized institution, with at least 50%. Field and marks require manual verification." },
      experience: { minYears: details.minimumRelevantExperienceYears, evidence: "Original advertisement page 1: 13 years minimum relevant experience specialized in cyber security; reported years need documentary field review." },
      languages: [{ language: "pa", stage: "apply", requirement: "Working knowledge of Punjabi essential. Matric Punjabi pass, or pass Punjab School Education Board/Department of Languages Punjabi test equivalent to Matric standard within six months after appointment (next available exam if none occurs then). No CEFR level.", evidence: "Original advertisement page 1, Note below qualification table.", sourceUrl: details.departmentDetailedUrl }],
      manualChecks: [
        { stage: "apply", text: "Confirm foreign-citizen application permission; notice does not state nationality. Verify exact degree field, minimum 50%, and 13 years of relevant cyber security work." },
        { stage: "apply", text: "Verify the off-domain Google Form and RTGS payment instructions directly with PSeGS before applying or paying; detailed PDF is official but form ownership is not checked by this connector." },
        { stage: "selection", text: "PSeGS must verify Punjabi working knowledge, experience evidence and committee evaluation; exact interview venue is not published." },
        { stage: "outcome", text: "If Punjabi was not passed at Matric, pass specified Punjabi test within six months after appointment, or next available exam if none is held then. Confirm international contract appointment permission." },
      ],
    },
    venues: [{ kind: "unknown", name: "Selection or interview venue not published; Mohali office is employer address only" }],
    sources: [
      evidenceSource(source, state.evidence, "Punjab government recruitment register", "HTML", "English"),
      evidenceSource(source, department.evidence, "DGG&IT Punjab official homepage", "HTML", "English and Punjabi"),
      evidenceSource(source, documents[0].evidence, "PSeGS detailed advertisement 02/2026, Punjab state portal", "PDF", "English"),
      evidenceSource(source, documents[1].evidence, "PSeGS detailed advertisement 02/2026, DGG&IT mirror", "PDF", "English"),
      evidenceSource(source, documents[2].evidence, "PSeGS newspaper notice, Punjab state portal", "PDF", "English"),
      evidenceSource(source, documents[3].evidence, "PSeGS newspaper notice, DGG&IT mirror", "PDF", "English"),
    ],
    applicationUrl: details.officialApplicationInfoUrl,
  });
  return { cycles: [cycle], evidence: [state.evidence, department.evidence, ...documents.map((document) => document.evidence)], complete: false, warnings: [
    "Only PSeGS advertisement 02/2026 is extracted; Punjab PSC, subordinate board, other departments, and later DGG&IT notices remain coverage gaps.",
    "The exact application opening date is not printed. Official current registers invite applications until 8 October 2026 at 23:59 IST; no earlier date was inferred.",
    "Nationality and foreign-national contract permission are not stated. Punjabi working knowledge is essential, with a stated post-appointment Matric-equivalent test alternative but no CEFR level.",
    "The official PDF directs applicants to a Google Form and RTGS account. Founder must confirm form ownership and payment account before publication; candidate-facing draft links to official PDF only.",
    "The notice permits future deferral or cancellation but does not announce either. Source disappearance cannot be treated as cancellation.",
  ] };
};
