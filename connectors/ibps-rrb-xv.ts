/** IBPS CRP-RRBs XV: exact notice set and review-only post choices. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence } from "./types.ts";
import { dayFirstDate, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Document { key: string; url: string; sha256: string }
interface Extraction {
  indexUrl: string; documents: Document[]; portals: { assistant: string; officer: string };
  opensOn: string; originalClosesOn: string; closesOn: string; ageAsOn: string; educationResultBy: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/ibps-rrb-xv-2026.json", import.meta.url), "utf8")) as Extraction;
export const IBPS_RRB_INDEX = extraction.indexUrl;

export function parseIbpsRrbIndex(html: string): { documents: Map<string, string>; portals: Extraction["portals"] } {
  if (!/Regional Rural Banks XV/i.test(stripTags(html))) throw new Error("IBPS RRB XV index identity changed");
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)].map((match) => match[1].replace(/&amp;/g, "&"));
  const pdfs = links.filter((href) => href.startsWith("https://www.ibps.in/wp-content/uploads/") && /\.pdf$/i.test(href));
  if (pdfs.length !== extraction.documents.length || new Set(pdfs).size !== pdfs.length) throw new Error("IBPS RRB XV PDF notice set changed; review required");
  const documents = new Map(extraction.documents.map((doc) => [doc.key, doc.url]));
  for (const href of pdfs) if (![...documents.values()].includes(href)) throw new Error("IBPS RRB XV added or changed an official PDF; review required");
  for (const doc of extraction.documents) if (!pdfs.includes(doc.url)) throw new Error(`IBPS RRB XV ${doc.key} PDF missing; review required`);
  const assistant = links.filter((href) => /^https:\/\/ibpsreg\.ibps\.in\/rrboaxvaug26\/?$/i.test(href));
  const officer = links.filter((href) => /^https:\/\/ibpsreg\.ibps\.in\/rrbxvaug26\/?$/i.test(href));
  if (assistant.length !== 1 || officer.length !== 1) throw new Error("IBPS RRB XV application paths missing or duplicated");
  return { documents, portals: extraction.portals };
}

/** Keep registration end distinct from editing, printing, fee and education dates. */
export function parseIbpsRrbPortal(html: string, path: "assistant" | "officer"): { opensOn: string; closesOn: string } {
  const identity = path === "assistant" ? /Office Assistants \(Multipurpose\)/i : /Officers \(Scale-I, II & III\)/i;
  if (!identity.test(stripTags(html))) throw new Error(`IBPS ${path} application page identity changed`);
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => stripTags(match[1]).replace(/\s+/g, " "));
  const oneDate = (label: RegExp) => {
    const found = rows.filter((row) => label.test(row));
    if (found.length !== 1) throw new Error(`IBPS ${path} ${label} date missing or duplicated`);
    const date = dayFirstDate(found[0]);
    if (!date) throw new Error(`IBPS ${path} date invalid`);
    return date;
  };
  const opensOn = oneDate(/^Commencement of online registration of application\b/i);
  const closesOn = oneDate(/^Closure of registration of application\b/i);
  const payment = rows.filter((row) => /^Online Fee Payment\b/i.test(row));
  if (payment.length !== 1 || !payment[0].includes("27/09/2026")) throw new Error(`IBPS ${path} fee window changed; review required`);
  if (opensOn !== extraction.opensOn || closesOn !== extraction.closesOn) throw new Error(`IBPS ${path} application window changed; review required`);
  return { opensOn, closesOn };
}

export const ibpsRrbXv: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("IBPS exact official PDF bytes required");
  const index = await fetchText(IBPS_RRB_INDEX, { accept: "text/html" });
  if (index.evidence.url !== IBPS_RRB_INDEX) throw new Error("IBPS RRB index redirected");
  const parsed = parseIbpsRrbIndex(index.text);
  const pageEvidence: Evidence[] = [index.evidence];
  for (const path of ["assistant", "officer"] as const) {
    const url = parsed.portals[path];
    const page = await fetchText(url, { accept: "text/html" });
    if (page.evidence.url !== url) throw new Error(`IBPS ${path} portal redirected; review required`);
    parseIbpsRrbPortal(page.text, path);
    pageEvidence.push(page.evidence);
  }
  const pdfEvidence = new Map<string, Evidence>();
  for (const document of extraction.documents) {
    const url = parsed.documents.get(document.key)!;
    const pdf = await fetchBytes(url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== url || pdf.evidence.sha256 !== hash || hash !== document.sha256) throw new Error(`IBPS RRB XV ${document.key} PDF changed; applicant rules withheld`);
    pdfEvidence.set(document.key, pdf.evidence);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status: OpportunityCycle["status"] = today > extraction.closesOn ? "closed" : today < extraction.opensOn ? "upcoming" : "uncertain";
  const sources = [
    evidenceSource(source, index.evidence, "IBPS Regional Rural Banks XV notice register", "HTML", "English"),
    ...extraction.documents.map((document) => evidenceSource(source, pdfEvidence.get(document.key)!, `CRP-RRBs XV ${document.key}`, "PDF", "English")),
  ];
  const portalSource = (path: "assistant" | "officer") => evidenceSource(source, pageEvidence[path === "assistant" ? 1 : 2], `IBPS ${path} registration dates`, "HTML", "English");
  const common = {
    authority: source.authority, pathway: "recruitment" as const,
    jurisdictionCode: "IN", jurisdictionName: "India",
    scopeLabel: "Participating Regional Rural Banks across India; 28 banks listed in Table A, with language requirement set by selected bank",
    status,
    statusNote: "21 September extension moves registration to 27 September 2026. 25 September corrigendum updates indicative vacancies only. Exact closing time is not stated. Founder review pending.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: null, officialTimeZone: "Asia/Kolkata", precision: "date" as const, note: "Original 21 September registration/fee end changed to 27 September by official extension PDF. No cutoff clock time printed. Original education-result deadline of 21 September remains in unchanged terms and needs founder confirmation." },
    citizenshipRule: "Indian citizens may apply. Subjects of Nepal or Bhutan, specified pre-1962 Tibetan refugees, and people of Indian origin who migrated from the listed countries may qualify only with a Government of India eligibility certificate (notification §B.I, PDF page 6). Nationality alone cannot establish every exception.",
    residenceRule: "No general domicile criterion identified in this notice. Choice of participating RRB and its local-language requirement matter; appointment conditions need review.",
    venues: [{ kind: "unknown" as const, name: "Examination centre is selected during application; exact venue not stated in this notice" }],
    sources, changes: [
      { at: "2026-09-09", kind: "updated" as const, summary: "Indicative bank vacancies updated; no new application cycle." },
      { at: "2026-09-15", kind: "updated" as const, summary: "Indicative bank vacancies updated again; 15 September Annexure supersedes earlier figures." },
      { at: "2026-09-21", kind: "extended" as const, summary: "Registration and fee-payment end extended from 21 to 27 September 2026; other terms unchanged." },
      { at: "2026-09-25", kind: "updated" as const, summary: "Indicative bank vacancies updated; 25 September Annexure supersedes earlier figures, with all other terms unchanged." },
    ],
  };
  const rulesFor = (path: "assistant" | "officer") => ({
    complete: false, asOn: extraction.ageAsOn,
    education: { minLevel: "bachelor" as const, evidence: `CRP-RRBs XV qualification table, PDF page 18: ${path === "assistant" ? "Office Assistant" : "Officer Scale I"} requires a bachelor's degree; result declared by 21 September 2026 under unchanged original terms.` },
    manualChecks: [
      { stage: "apply" as const, text: "Verify nationality category and Government of India eligibility certificate for Nepal/Bhutan subjects, specified Tibetan refugees or listed Indian-origin migrants (notification §B.I)." },
      { stage: "apply" as const, text: "Verify age on 1 September 2026 and all applicable category/disability/service relaxations; do not infer from registration extension." },
      { stage: "apply" as const, text: "Verify degree result was declared by 21 September 2026; extension notice changes registration and fees only, with other terms unchanged." },
      { stage: "outcome" as const, text: "Verify local language for the selected RRB from Table A. Standard VIII study or accepted certificate counts; the notice permits acquisition within six months after joining, extendable within probation. No CEFR level is given." },
    ],
  });
  const assistant = makeCycle({ ...common,
    id: "ibps-crp-rrbs-xv-2026-office-assistant", sourceId: source.id,
    title: "Office Assistant (Multipurpose)", cycleLabel: "CRP-RRBs XV, Group B",
    outcome: "Office Assistant posts in participating Regional Rural Banks; 25 September Annexure gives indicative bank vacancies, not a fixed total appointment guarantee.",
    qualifications: "Bachelor's degree in any discipline. Local language of selected RRB is essential: Table A lists languages for 28 banks, from Telugu in Andhra Pradesh to Bengali/Kokborok in Tripura. Standard VIII study or a certificate counts; acquisition after joining is allowed under stated time limits. No CEFR level. Computer knowledge desirable.",
    selectionStages: ["Online preliminary examination", "Online main examination", "Provisional allotment and eligibility/document checks; no interview listed for Office Assistants"],
    fee: "₹175 for SC/ST/PwBD/ESM/DESM; ₹850 for other candidates, including GST. Payment window extended to 27 September 2026.",
    rules: rulesFor("assistant"), sources: [...sources, portalSource("assistant")],
    applicationUrl: extraction.portals.assistant,
  });
  const officer = makeCycle({ ...common,
    id: "ibps-crp-rrbs-xv-2026-officer-scale-i", sourceId: source.id,
    title: "Officer Scale I (Assistant Manager)", cycleLabel: "CRP-RRBs XV, Group A",
    outcome: "Officer Scale I posts in participating Regional Rural Banks; 25 September Annexure gives indicative bank vacancies.",
    qualifications: "Bachelor's degree in any discipline; specified agriculture, technology, management, law, economics and accountancy degrees receive preference. Local language of selected RRB is essential under Table A; standard VIII study/certificate or stated post-joining acquisition route applies. No CEFR level. Computer knowledge desirable.",
    selectionStages: ["Online preliminary examination", "Online main examination", "Interview", "Provisional allotment and eligibility/document checks"],
    fee: "₹175 for SC/ST/PwBD; ₹850 for other candidates, including GST. Payment window extended to 27 September 2026.",
    rules: rulesFor("officer"), sources: [...sources, portalSource("officer")],
    applicationUrl: extraction.portals.officer,
  });
  const seniorSpecs = [
    { id: "officer-scale-ii-general-banking", title: "Officer Scale II — General Banking Officer (Manager)", qualification: "Bachelor's degree in any discipline with at least 50% aggregate marks; two years as an officer in a bank or financial institution.", experienceYears: 2, experienceKind: "as an officer in a bank or financial institution" },
    { id: "officer-scale-ii-it", title: "Officer Scale II — Information Technology Officer", qualification: "Bachelor's degree in Electronics, Communication, Computer Science, Information Technology or equivalent with at least 50% aggregate marks; one year of relevant experience. Listed programming certificates are desirable.", experienceYears: 1, experienceKind: "in the relevant IT field" },
    { id: "officer-scale-ii-ca", title: "Officer Scale II — Chartered Accountant", qualification: "Certified Associate of the Institute of Chartered Accountants of India; one year of experience as a Chartered Accountant.", experienceYears: 1, experienceKind: "as a Chartered Accountant" },
    { id: "officer-scale-ii-law", title: "Officer Scale II — Law Officer", qualification: "Law degree or equivalent with at least 50% aggregate marks; two years as an advocate or as a law officer in a bank or financial institution.", experienceYears: 2, experienceKind: "as an advocate or bank/financial-institution law officer" },
    { id: "officer-scale-ii-treasury", title: "Officer Scale II — Treasury Manager", qualification: "Chartered Accountant or MBA in Finance from a recognised university/institution; one year of relevant experience.", experienceYears: 1, experienceKind: "in the relevant treasury or finance field" },
    { id: "officer-scale-ii-marketing", title: "Officer Scale II — Marketing Officer", qualification: "MBA in Marketing from a recognised university; one year of relevant experience.", experienceYears: 1, experienceKind: "in the relevant marketing field" },
    { id: "officer-scale-ii-agriculture", title: "Officer Scale II — Agricultural Officer", qualification: "Bachelor's degree in Agriculture, Horticulture, Dairy, Animal Husbandry, Forestry, Veterinary Science, Agricultural Engineering, Pisciculture or equivalent with at least 50% aggregate marks; two years of relevant experience.", experienceYears: 2, experienceKind: "in the relevant agricultural field" },
    { id: "officer-scale-iii", title: "Officer Scale III — Senior Manager", qualification: "Bachelor's degree in any discipline with at least 50% aggregate marks; at least five years as an officer in a bank or financial institution.", experienceYears: 5, experienceKind: "as an officer in a bank or financial institution" },
  ] as const;
  const senior = seniorSpecs.map((spec) => makeCycle({ ...common,
    id: `ibps-crp-rrbs-xv-2026-${spec.id}`, sourceId: source.id,
    title: spec.title, cycleLabel: `CRP-RRBs XV, Group A · ${spec.title}`,
    outcome: `${spec.title} in a participating Regional Rural Bank; vacancies are indicative and allotment follows merit and bank preference.`,
    qualifications: `${spec.qualification} Qualification result date remains 21 September 2026 under the unamended original terms; founder confirmation pending.`,
    languageNote: "Single online examination offers an English or Hindi language section; other sections have the notice's stated Hindi/English media. No CEFR level is stated. The Table A local-language qualification is expressly for Office Assistants and Officer Scale I, not Scale II/III.",
    selectionStages: ["Single online examination", "Common interview", "Provisional allotment and eligibility/document checks"],
    fee: "₹175 for SC/ST/PwBD; ₹850 for other candidates, including GST. Payment window extended to 27 September 2026.",
    rules: {
      complete: false,
      asOn: extraction.ageAsOn,
      experience: { minYears: spec.experienceYears, evidence: `Original CRP-RRBs XV qualification table, PDF pages 17–18: ${spec.title} requires ${spec.experienceYears} year${spec.experienceYears === 1 ? "" : "s"} ${spec.experienceKind}.` },
      manualChecks: [
        { stage: "apply", text: "Verify nationality category and Government of India eligibility certificate for eligible non-Indian categories (notification §B.I)." },
        { stage: "apply", text: `Verify ${spec.title} specific degree, minimum marks, professional credential or accepted equivalence from original qualification table; degree result by 21 September 2026 needs founder confirmation.` },
        { stage: "apply", text: `Verify experience was ${spec.experienceKind}; a year count alone does not establish the required field or role.` },
        { stage: "apply", text: `Verify age on 1 September 2026, category and disability/service relaxations for ${spec.title}.` },
        { stage: "selection", text: "Choose the published English or Hindi language test option; no formal proficiency level is specified." },
      ],
    },
    sources: [...sources, portalSource("officer")],
    applicationUrl: extraction.portals.officer,
  }));
  return { cycles: [assistant, officer, ...senior], evidence: [...pageEvidence, ...pdfEvidence.values()], complete: false, warnings: [
    "Office Assistant has its own registration path. Officer Scale I, seven Scale II post choices and Scale III share the officer registration path; a candidate may apply for only one officer-cadre post.",
    "Officer Scale II/III require post-specific qualifications and experience; generic years cannot establish the required field. These remain manual checks before any positive eligibility verdict.",
    "Table A local-language qualification is specified for Office Assistant and Officer Scale I, not Scale II/III. Senior officer examinations offer English/Hindi language-section choice without a CEFR level.",
    "Nationality certificate exceptions and selected-bank local language cannot be inferred from nationality or residence alone; three-stage eligibility remains needs verification for those checks.",
    "25 September Annexure supersedes earlier indicative vacancies; no new application cycle. Bank rows do not inflate totals. Full vacancy reconciliation and 28-bank language mapping need founder review.",
    "Original degree-result condition says 21 September; 21 September extension changes registration and fee dates only. Founder must verify this interaction before publication.",
    "No official cutoff clock time was printed in retained extension or registration pages; date precision is preserved.",
  ] };
};
