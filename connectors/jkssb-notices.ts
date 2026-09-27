/** Two exact JKSSB advertisements, with post-family groups from 08/2026. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { EducationLevel } from "../lib/eligibility/types.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  advertisementsUrl: string;
  whatsNewUrl: string;
  advertisementUrl: string;
  advertisementSha256: string;
  noticeNumber: string;
  noticeDate: string;
  opensOn: string;
  closesOn: string;
  officialTimeZone: string;
  advertisedPosts: number;
  ageAsOn: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/jkssb-class-iv-09-2026.json", import.meta.url), "utf8")) as Extraction;
interface Group {
  id: string; title: string; salary: string; qualification: string; minEducation: EducationLevel;
  instructionPage: number; advertisementPages: number[];
  rows: { item: number; district: string; vacancies: number }[];
}
interface Open08Extraction {
  advertisementsUrl: string; whatsNewUrl: string; homepageUrl: string; applicationUrl: string;
  advertisementUrl: string; advertisementSha256: string; instructionsUrl: string; instructionsSha256: string;
  noticeNumber: string; noticeDate: string; instructionsDate: string; opensOn: string; closesOn: string;
  cutoffLocalTime: string; officialTimeZone: string; advertisedPosts: number; ageAsOn: string; groups: Group[];
}
const open08 = JSON.parse(readFileSync(new URL("../data/extractions/jkssb-08-2026-groups.json", import.meta.url), "utf8")) as Open08Extraction;
const originalUpdateTitle = "Notification regarding Advertisement for UT/Divisional/District Cadre posts belonging to various Department(s), Jammu & Kashmir vide advertisement notification no. 09 of 2026 dated 01.09.2026";

function links(html: string, base: string): { url: string; title: string }[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: new URL(match[1], base).href, title: stripTags(match[2]).replace(/\s+/g, " ").trim() }));
}

/** Original 08/2026 plus its later application instructions must remain linked. */
export function verifyJkssb08Pages(advertisements: string, whatsNew: string, homepage: string): void {
  const listed = links(advertisements, open08.advertisementsUrl)
    .filter((link) => /\b08 of 2026\b/i.test(link.title));
  const updates = links(whatsNew, open08.whatsNewUrl)
    .filter((link) => /\b08 of 2026\b|\(518\)\s+posts\b/i.test(link.title));
  const original = updates.find((link) => link.url === open08.advertisementUrl);
  const instructions = updates.find((link) => link.url === open08.instructionsUrl);
  if (listed.length !== 1 || listed[0].url !== open08.advertisementUrl ||
      !listed[0].title.includes("04/08/2026") || updates.length !== 2 ||
      !original?.title.includes("no. 08 of 2026 dated 04.08.2026") ||
      instructions?.title !== "Notification regarding Instructions for submission of application forms for the advertised (518) posts in various Department(s)." ||
      !links(homepage, open08.homepageUrl).some((link) => link.url === open08.applicationUrl && link.title === "Apply for Various Posts")) {
    throw new Error("JKSSB 08/2026 notice, instructions or application link changed; manual review required");
  }
}

function verifyPdf(bytes: Buffer, evidence: { url: string; sha256: string }, url: string, expected: string): void {
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || evidence.url !== url || evidence.sha256 !== hash || hash !== expected) {
    throw new Error("JKSSB original PDF or instructions changed; extracted rules withheld");
  }
}

/** Detect a removed/replaced advertisement or another notice explicitly tied to 09/2026. */
export function verifyJkssbClassIvPages(advertisements: string, whatsNew: string): void {
  const listed = links(advertisements, notice.advertisementsUrl)
    .filter((link) => /\b09 of 2026\b/i.test(link.title));
  const updates = links(whatsNew, notice.whatsNewUrl)
    .filter((link) => /\b(?:advertisement\s+)?(?:notification\s+no\.?\s*)?09 of 2026\b/i.test(link.title));
  if (listed.length !== 1 || listed[0].url !== notice.advertisementUrl ||
      !listed[0].title.includes("01/09/2026") ||
      updates.length !== 1 || updates[0].url !== notice.advertisementUrl ||
      updates[0].title !== originalUpdateTitle) {
    throw new Error("JKSSB 09/2026 register or related updates changed; manual review required");
  }
}

export const jkssbNotices: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("JKSSB original PDF byte fetch required");
  const advertisements = await fetchText(notice.advertisementsUrl, { accept: "text/html" });
  const whatsNew = await fetchText(notice.whatsNewUrl, { accept: "text/html" });
  const homepage = await fetchText(open08.homepageUrl, { accept: "text/html" });
  if (advertisements.evidence.url !== notice.advertisementsUrl || whatsNew.evidence.url !== notice.whatsNewUrl) {
    throw new Error("JKSSB official register redirected; manual review required");
  }
  if (homepage.evidence.url !== open08.homepageUrl) throw new Error("JKSSB homepage redirected; application link requires review");
  verifyJkssbClassIvPages(advertisements.text, whatsNew.text);
  verifyJkssb08Pages(advertisements.text, whatsNew.text, homepage.text);
  const pdf = await fetchBytes(notice.advertisementUrl, { accept: "application/pdf" });
  verifyPdf(pdf.bytes, pdf.evidence, notice.advertisementUrl, notice.advertisementSha256);
  const original08 = await fetchBytes(open08.advertisementUrl, { accept: "application/pdf" });
  const instructions08 = await fetchBytes(open08.instructionsUrl, { accept: "application/pdf" });
  verifyPdf(original08.bytes, original08.evidence, open08.advertisementUrl, open08.advertisementSha256);
  verifyPdf(instructions08.bytes, instructions08.evidence, open08.instructionsUrl, open08.instructionsSha256);

  const today = civilDateIn(notice.officialTimeZone, now);
  const status = today < notice.opensOn ? "upcoming" : today > notice.closesOn ? "closed" : "open";
  const cycle = makeCycle({
    id: "jkssb-class-iv-09-2026", sourceId: source.id,
    title: "J&K Class IV multitasking and sanitation recruitment",
    cycleLabel: `JKSSB advertisement ${notice.noticeNumber}`,
    programme: "JKSSB Class IV common recruitment 2026",
    authority: source.authority, pathway: "recruitment",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-JK"],
    scopeLabel: "One online application cycle with item preferences across UT, divisional and district cadres. Annexure A lists departments and 2 job kinds; rows and future exam venues are not extra application cycles.",
    outcome: `${notice.advertisedPosts.toLocaleString("en-IN")} advertised Class IV (Multitasking Staff) and Sanitation Worker posts across J&K departments, subject to item, cadre and category allocation; total may change.`,
    status,
    statusNote: "Original 1 September advertisement. Application portal instructions are to be published separately. No later 09/2026 amendment was found in the checked What's New register; founder review pending.",
    applicationWindow: {
      opensOn: notice.opensOn, closesOn: notice.closesOn,
      cutoffLocalTime: null, officialTimeZone: notice.officialTimeZone, precision: "date",
      note: "Original notice page 1 states 5 October–3 November 2026. No cutoff hour is printed. A later signed extension or cancellation would supersede this date.",
    },
    qualifications: "Class IV/MTS: minimum Matric (10th), maximum 10+2. Sanitation Worker: minimum 8th pass, maximum 10+2. Qualification must be acquired by 3 November 2026 unless deadline changes (original notice pages 3 and 31). Do not treat a higher degree as automatically eligible.",
    citizenshipRule: "Original notice does not explicitly state a nationality rule. Foreign citizens must confirm application, examination and government appointment permission with JKSSB; possession of a J&K domicile certificate is separately required to apply.",
    residenceRule: "Every applicant must be a J&K Union Territory domicile and possess a valid competent-authority domicile certificate by the application deadline (original notice page 2). Current address alone does not prove or disprove domicile.",
    selectionStages: ["Online application, item preferences and fee", "Objective written examination in English; date and venues to be announced", "Merit plus applicable additional points and cadre/department preference", "Original document and domicile certificate verification", "Department allocation and appointment checks"],
    fee: "₹600 general; ₹500 SC, ST-1, ST-2, EWS and PwBD. Online payment only; original notice page 5.",
    salary: "Pay scale SL1 ₹14,800–₹47,100, original notice Annexure D page 31.",
    rules: { complete: false, asOn: notice.ageAsOn,
      age: { min: 18, evidence: "Original notice page 2: birth no later than 1 January 2008 as of 1 January 2026. Maximum 40 for open merit; category, disability, ex-service and casual-worker exceptions require manual review." },
      languages: [{ language: "en", stage: "selection", requirement: "Objective written examination questions are set in English only. Notice gives no CEFR level, English certificate or separate language score (page 6).", evidence: "Original notice page 6, Scheme of Examination, clause 11(a).", sourceUrl: notice.advertisementUrl }],
      manualChecks: [
        { stage: "apply", text: "Confirm valid J&K domicile certificate by deadline, item-specific minimum and maximum schooling, category age limit, and foreign-citizen application permission with JKSSB." },
        { stage: "selection", text: "Confirm written exam readiness in English, issued admit card, and document eligibility; exam date and venues are not yet announced." },
        { stage: "outcome", text: "Confirm nationality-based J&K government appointment permission, domicile and original certificate checks, item preference and final allocation." },
      ],
    },
    venues: [{ kind: "unknown", name: "Examination centres and date will be announced by JKSSB; no venue published in original advertisement" }],
    sources: [
      evidenceSource(source, advertisements.evidence, "JKSSB official advertisement register", "HTML", "English"),
      evidenceSource(source, whatsNew.evidence, "JKSSB official What's New register", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "JKSSB advertisement 09/2026, 32-page original", "PDF", "English"),
    ],
    applicationUrl: null,
  });
  const open08Today = civilDateIn(open08.officialTimeZone, now);
  const open08Clock = clockIn(open08.officialTimeZone, now);
  const open08Status = open08Today < open08.opensOn ? "upcoming" :
    open08Today > open08.closesOn || (open08Today === open08.closesOn && open08Clock > open08.cutoffLocalTime) ? "closed" : "open";
  const groups = open08.groups.map((group) => {
    const count = group.rows.reduce((sum, row) => sum + row.vacancies, 0);
    const itemNumbers = group.rows.map((row) => row.item);
    const districts = group.rows.map((row) => row.district);
    return makeCycle({
      id: `jkssb-08-2026-${group.id}`, sourceId: source.id,
      title: `${group.title} — J&K 2026`,
      cycleLabel: `JKSSB advertisement ${open08.noticeNumber}, items ${itemNumbers[0]}–${itemNumbers.at(-1)}`,
      programme: `JKSSB ${group.title} district preference application`,
      authority: source.authority, pathway: "recruitment",
      jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-JK"],
      scopeLabel: `One provisional post-family application with ${itemNumbers.length} district item preferences within the ${open08.advertisedPosts}-post advertisement. District cadres describe job allocation, not examination venues: ${districts.join(", ")}.`,
      outcome: `${count} advertised ${group.title} posts across listed J&K district cadres, subject to item preference, category allocation and final appointment checks. Other 08/2026 post families are separate gaps.`,
      status: open08Status,
      statusNote: "9 September JKSSB application instructions specify 9 October 23:59 closing time and an official portal route. Founder review pending; portal grouping must be confirmed before publication.",
      applicationWindow: {
        opensOn: open08.opensOn, closesOn: open08.closesOn, cutoffLocalTime: open08.cutoffLocalTime,
        cutoffInclusive: true, officialTimeZone: open08.officialTimeZone, precision: "minute",
        note: "Original advertisement page 1 gives 10 September–9 October 2026. Signed 9 September instructions page 1 specifies 12:00 AM opening and 11:59 PM closing for application and fee. Asia/Kolkata is local J&K civil time; no seconds are printed.",
      },
      qualifications: `${group.qualification} (advertisement Annexure A pages ${group.advertisementPages.join(", ")}). Verify original certificates and any equivalence by the application cutoff.`,
      citizenshipRule: "Original advertisement and later application instructions do not explicitly settle foreign-citizen application, examination or J&K government appointment permission. International applicants need JKSSB confirmation at all three stages.",
      residenceRule: "Every applicant must be a J&K Union Territory domicile with a valid competent-authority domicile certificate by the closing date (original advertisement page 2; application instructions page 1). Current address alone cannot establish this certificate.",
      selectionStages: ["Online registration and post-family item preferences", "Online fee payment by 9 October 23:59 IST", "Objective written/OMR exam in English; date and centres announced separately", "Original qualification and domicile document verification", "District item allocation and appointment checks"],
      fee: "₹600 standard; ₹500 SC, ST-1, ST-2, EWS and PwBD. Original advertisement page 4 and instructions page 2 require online payment by 9 October 23:59 IST.",
      salary: `${group.salary}, as printed in original advertisement Annexure A.`,
      rules: { complete: false, asOn: open08.ageAsOn,
        age: { min: 18, evidence: "Original advertisement page 2: candidate not born after 1 January 2008, as of 1 January 2026. Open-merit maximum 40; category, disability and ex-service exceptions need individual review." },
        education: { minLevel: group.minEducation, evidence: `Original advertisement Annexure A pages ${group.advertisementPages.join(", ")}: ${group.qualification}. School subject, training/diploma recognition and equivalence remain manual checks.` },
        languages: [{ language: "en", stage: "selection", requirement: "Objective written-examination questions are in English only. No CEFR level, English certificate or separate language score is printed.", evidence: "Original advertisement page 5, Scheme of Examination, clause 10(a).", sourceUrl: open08.advertisementUrl }],
        manualChecks: [
          { stage: "apply", text: `Verify ${group.qualification}, valid J&K domicile certificate, category age rule and whether JKSSB permits foreign-citizen applications for this post family.` },
          { stage: "selection", text: "Confirm English examination readiness, admit card, item preferences and original qualification documents; examination centre is unannounced." },
          { stage: "outcome", text: "Confirm foreign-citizen J&K appointment permission, district item allocation and all employer document checks." },
        ],
      },
      venues: [{ kind: "unknown", name: "JKSSB will announce written-examination centres separately; district job cadres are not exam venues" }],
      sources: [
        evidenceSource(source, advertisements.evidence, "JKSSB official advertisement register", "HTML", "English"),
        evidenceSource(source, whatsNew.evidence, "JKSSB official What's New register", "HTML", "English"),
        evidenceSource(source, homepage.evidence, "JKSSB official application portal link", "HTML", "English"),
        evidenceSource(source, original08.evidence, "JKSSB advertisement 08/2026, 38-page original", "PDF", "English"),
        evidenceSource(source, instructions08.evidence, "JKSSB 9 September application and fee instructions", "scanned PDF", "English"),
      ],
      applicationUrl: open08.applicationUrl,
    });
  });
  const extracted08Posts = open08.groups.flatMap((group) => group.rows).reduce((sum, row) => sum + row.vacancies, 0);
  return { cycles: [cycle, ...groups], evidence: [advertisements.evidence, whatsNew.evidence, homepage.evidence, pdf.evidence, original08.evidence, instructions08.evidence], complete: false, warnings: [
    `Advertisement 08/2026 is extracted only for Horticulture Technician and Junior Pharmacist: ${extracted08Posts} of ${open08.advertisedPosts} advertised posts. The remaining ${open08.advertisedPosts - extracted08Posts} positions and other JKSSB notices are coverage gaps.`,
    "9 September 08/2026 instructions group multiple district item numbers as post-family preferences. Whether the portal uses one form per family is provisional until founder review; item rows are not counted as extra cycles.",
    "J&K domicile certificate is mandatory. Nationality permission for foreign citizens is unstated and must be checked with JKSSB; neither current residence nor citizenship proves domicile.",
    "09/2026 MTS and Sanitation Worker have different minimum schooling and both have a maximum of 10+2. The eligibility engine cannot safely automate the maximum or the domicile certificate, so results require manual verification.",
    "08/2026 Horticulture training and Pharmacy degree/diploma are manual checks. A higher general education level cannot satisfy a specific training credential by itself.",
    "Written examination is in English only; no formal proficiency level is stated. Examination date and venue are not announced, and no map pin is inferred.",
    "09/2026 application instructions are promised separately; its original notice has no cutoff hour. Future amendments outside explicitly numbered What's New links require founder review.",
  ] };
};
