/** NIT Uttarakhand advertisement 08/2026: distinct public portal choices, draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; documentUrl: string; pdfSha256: string; applicationUrl: string;
  advertisement: string; noticeDate: string; closesOn: string;
  hardCopyDueOn: string; hardCopyCutoffLocalTime: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/nituk-nt08-2026.json", import.meta.url), "utf8")) as Extraction;

interface Post {
  id: string; title: string; vacancies: number; family: string;
  route: "mixed" | "contract"; pay: string; fee: number; qualifications: string;
}
const superintendent = "First-class bachelor's degree in any discipline or master's degree with at least 50% marks, plus computer word-processing and spreadsheet knowledge for the general recruitment route. Deputation requires eligible current service, analogous post or specified grade service and employer clearance; annexed 2019 rules govern details.";
const technicalAssistant = "Relevant first-class B.E./B.Tech./MCA, first-class engineering diploma, first-class science bachelor's degree, or science master's degree with at least 50% marks. Deputation has additional analogous-post or six-year grade-service criteria; exact branch equivalence needs review.";
const technicianSg = "Annexed Technician (Selection Grade-II) rules give no direct-recruitment qualification; deputation requires eligible serving officer, specified analogous post or five-year grade service, and listed science/ITI/engineering-diploma routes. Contract-route criteria are not fully resolved by the appended rules.";
const technician = "Relevant science 10+2 with 60%; or 10+2 with 50% plus at least one-year ITI; or Class 10 with 60% plus two-year ITI; or three-year engineering diploma, under annexed 2019 rules.";
const juniorAssistant = "Recognized 10+2, typing speed of at least 35 words per minute, and computer word-processing and spreadsheet proficiency. Notice does not state typing language.";
const posts: Post[] = [
  { id: "superintendent", title: "Superintendent", vacancies: 1, family: "Superintendent", route: "mixed", pay: "Level 6 on deputation; ₹57,000 monthly consolidated on contract", fee: 500, qualifications: superintendent },
  ...([ ["civil", "Civil", 2], ["electrical", "Electrical", 1], ["electronics", "Electronics", 1], ["cse", "CSE", 1], ["mechanical", "Mechanical", 1] ] as const)
    .map(([id, branch, vacancies]) => ({ id: `technical-assistant-${id}`, title: `Technical Assistant (${branch})`, vacancies,
      family: "Technical Assistant", route: "mixed" as const, pay: "Level 6 on deputation; ₹57,000 monthly consolidated on contract", fee: 500, qualifications: technicalAssistant })),
  ...([ ["cse", "CSE", 2], ["electronics", "Electronics", 2], ["electrical", "Electrical", 1], ["mechanical", "Mechanical", 1], ["library", "Library", 1] ] as const)
    .map(([id, branch, vacancies]) => ({ id: `technician-sg2-${id}`, title: `Technician (SG-II) (${branch})`, vacancies,
      family: "Technician (SG-II)", route: "mixed" as const, pay: "Level 5 on deputation; ₹47,000 monthly consolidated on contract", fee: 250, qualifications: technicianSg })),
  ...([ ["civil", "Civil", 2], ["electrical", "Electrical", 1], ["electronics", "Electronics", 1] ] as const)
    .map(([id, branch, vacancies]) => ({ id: `technician-${id}`, title: `Technician (${branch})`, vacancies,
      family: "Technician", route: "contract" as const, pay: "₹35,000 monthly consolidated on contract", fee: 250, qualifications: technician })),
  { id: "junior-assistant", title: "Junior Assistant", vacancies: 3, family: "Junior Assistant", route: "contract", pay: "₹35,000 monthly consolidated on contract", fee: 250, qualifications: juniorAssistant },
];

/** Exact dated register row; old 06/2024 is a separate edition requiring fresh applications. */
export function verifyNitukNt08Index(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const matches = rows.filter((row) => /<td[^>]*>\s*08\/2026\s*<\/td>/i.test(row));
  if (matches.length !== 1 || (html.match(/<td[^>]*>\s*08\/2026\s*<\/td>/gi)?.length ?? 0) !== 1) {
    throw new Error("NIT Uttarakhand 08/2026 row changed or duplicated; review required");
  }
  const row = matches[0];
  const text = stripTags(row).replace(/\s+/g, " ");
  if (!/21\/09\/2026/.test(text) || !/Non-Teaching Staff \(On deputation or contractual basis\)/i.test(text) ||
      row.split(`href="${notice.documentUrl}"`).length - 1 !== 2 ||
      row.split(`href="${notice.applicationUrl}"`).length - 1 !== 1 ||
      /corrigendum|addendum|extension|revised/i.test(text)) {
    throw new Error("NIT Uttarakhand 08/2026 notice, document or application link changed; review required");
  }
}

export const nitukNt08: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("NIT Uttarakhand original PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("NIT Uttarakhand recruitment index redirected; review required");
  verifyNitukNt08Index(index.text);
  const pdf = await fetchBytes(notice.documentUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== notice.documentUrl ||
      pdf.evidence.sha256 !== hash || hash !== notice.pdfSha256) {
    throw new Error("NIT Uttarakhand 08/2026 PDF changed; dates and eligibility withheld");
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < notice.noticeDate ? "uncertain" as const : today > notice.closesOn ? "closed" as const : "open" as const;
  const sources = [
    evidenceSource(source, index.evidence, "NIT Uttarakhand recruitment register, advertisement 08/2026", "HTML", "English"),
    evidenceSource(source, pdf.evidence, "Advertisement 08/2026 and annexed 2019 recruitment rules", "PDF", "English"),
  ];
  const cycles = posts.map((post) => {
    const mixed = post.route === "mixed";
    return makeCycle({
      id: `nituk-nt08-2026-${post.id}`, sourceId: source.id,
      title: `${post.title} — NIT Uttarakhand`, programme: "NIT Uttarakhand non-teaching staff 2026",
      cycleLabel: `${notice.advertisement} · ${post.title}`, authority: source.authority,
      pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-UT"],
      appointmentType: mixed ? undefined : "contract",
      scopeLabel: `One distinct online portal post choice in the ${post.family} family, at Srinagar (Garhwal), Uttarakhand. ${mixed ? "Deputation or one-year contract routes are advertised." : "One-year contract route is advertised."} Job location is not applicant domicile or a published test venue.`,
      outcome: `${post.vacancies} indicative ${post.title} ${post.vacancies === 1 ? "vacancy" : "vacancies"}; ${post.pay}. Initial one-year appointment may be extended; permanent government employment is not promised.`,
      status,
      statusNote: "Exact 2026 advertisement and recruitment-register row retained. Annexed 2019 recruitment rules include scanned pages; branch and route eligibility need founder review. No test venue or test language published.",
      applicationWindow: { opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: null,
        officialTimeZone: null, precision: "date", note: `Advertisement 08/2026 page 1: online application closes ${notice.closesOn} without clock time. Required signed hard copy and documents must reach Registrar by ${notice.hardCopyDueOn} at ${notice.hardCopyCutoffLocalTime}; governing timezone not printed. Notice issue date is not assumed to be application opening.` },
      qualifications: `${post.qualifications} Age and all qualifications are reckoned on ${notice.closesOn}; category relaxations and route-specific 2019 rules require review.`,
      citizenshipRule: mixed
        ? "Contract route expressly invites citizens of India. Deputation route invites eligible serving officials of specified public bodies but does not print a separate nationality rule. A foreign citizen cannot use the contract route; deputation access needs authority and current-employer verification."
        : "These posts are advertised on contract. Page 1 limits contractual applicants to citizens of India; foreign citizens do not meet the published application criterion.",
      residenceRule: "No applicant Uttarakhand domicile rule is printed. Srinagar (Garhwal) is the work and postal location, not a residence criterion.",
      languageNote: post.id === "junior-assistant"
        ? "Junior Assistant annexed rule requires 35 w.p.m. typing but names no typing language. No formal language proficiency level, language certificate or written-test medium is stated."
        : "No formal language proficiency level, language certificate or written-test medium is stated. English notice publication is not an applicant language requirement.",
      selectionStages: ["Separate online registration for this portal post choice", "Print form; send signed hard copy, fee proof and self-attested documents by 11 November 2026 at 17:30", "Document screening", "Written test in relevant field", "Trade test for shortlisted candidates", "Document and appointment checks"],
      fee: `₹${post.fee} online per application; SC/ST/women/Divyaang${mixed ? " and deputation" : ""} candidates are exempt. Prior 06/2024 applicants must apply again and may claim fee exemption with earlier fee proof.`,
      salary: post.pay,
      rules: { complete: false, asOn: notice.closesOn,
        ...(mixed ? {} : { nationality: { allowed: ["IN"], evidence: "NIT Uttarakhand advertisement 08/2026 page 1: contractual applicants must be citizens of India; Technician and Junior Assistant are contract-only rows." } }),
        manualChecks: [
          { stage: "apply", text: mixed
            ? "Choose contract or deputation route. Contract requires Indian citizenship; deputation requires eligible existing service, employer forwarding/NOC, APARs and vigilance clearance. Verify branch-specific qualifications, age and any relaxation."
            : "Confirm Indian citizenship, branch-specific 2019 qualification, fee exemption if claimed, age and reservation documents. Foreign citizens fail the printed contractual route." },
          { stage: "selection", text: "Confirm written-test and trade-test shortlisting, relevant specialization and document verification; test medium and venue are not published." },
          { stage: "outcome", text: "Confirm final appointment, employer release where applicable, one-year term and service conditions; test success alone does not grant the post." },
        ],
      },
      venues: [{ kind: "unknown", name: "Written/trade test venue not published; Srinagar is work and postal address" }],
      sources, applicationMethod: "online", applicationUrl: notice.applicationUrl,
    });
  });
  return { cycles, evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "The public application portal offers 15 distinct post choices for 21 indicative vacancies across five post families; portal option labels were inspected without applicant registration. Branch-specific form identity needs founder confirmation before approval.",
    "Contract applicants must be Indian citizens. Deputation nationality is not separately printed; eligible existing service and employer release require individual verification.",
    "The online deadline has date precision only. Hard-copy receipt by 11 November 17:30 is a separate mandatory step; no governing timezone is printed.",
    "Technician (SG-II) annexed rule has no direct-recruitment qualification, while current advertisement offers contract pay; contract-route criteria require founder/authority reconciliation.",
    "Advertisement 06/2024 is a prior edition; its applicants must register again and are not imported as current applications.",
    "Other NIT Uttarakhand recruitments and later corrigenda remain coverage gaps.",
  ] };
};
