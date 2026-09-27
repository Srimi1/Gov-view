/** Exact scanned notice for one Goalpara Foreigners Tribunal Copyist walk-in. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  indexUrl: string;
  advertisementUrl: string;
  advertisementSha256: string;
  relatedIndexLinks: { title: string; url: string }[];
  walkInOn: string;
  registrationFrom: string;
  registrationUntil: string;
  officialTimeZone: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/goalpara-ft8-copyist-2026.json", import.meta.url), "utf8")) as Extraction;

/** Check titles and links without downloading candidate-name lists. */
export function verifyGoalparaFt8Index(html: string) {
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*>/gi)]
    .map((match) => ({ title: match[2].replace(/\s+/g, " ").trim(), url: new URL(match[1], extraction.indexUrl).href }));
  const related = links.filter((link) => /Copyist.*(?:TF-8|8 No\. FT|Foreigners Tribunal No\. 8)/i.test(link.title));
  if (related.length !== extraction.relatedIndexLinks.length ||
      related.some((link, i) => link.title !== extraction.relatedIndexLinks[i].title || link.url !== extraction.relatedIndexLinks[i].url)) {
    throw new Error("Goalpara FT-8 notice or related result register changed; review required");
  }
}

export const goalparaFt8: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Goalpara original scanned PDF byte fetch required");
  const index = await fetchText(extraction.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== extraction.indexUrl) throw new Error("Goalpara recruitment register redirected; review required");
  verifyGoalparaFt8Index(index.text);
  const pdf = await fetchBytes(extraction.advertisementUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== extraction.advertisementUrl || pdf.evidence.sha256 !== hash || hash !== extraction.advertisementSha256) {
    throw new Error("Goalpara FT-8 scanned advertisement changed; extracted rules withheld");
  }
  const opens = Date.parse(`${extraction.walkInOn}T${extraction.registrationFrom}:00+05:30`);
  const closes = Date.parse(`${extraction.walkInOn}T${extraction.registrationUntil}:00+05:30`);
  const status = now.getTime() < opens ? "upcoming" as const : now.getTime() >= closes ? "closed" as const : "open" as const;
  const cycle = makeCycle({
    id: "goalpara-ft8-copyist-walkin-2026", sourceId: source.id,
    title: "Copyist — Foreigners Tribunal No. 8, Goalpara", cycleLabel: "FT-8 walk-in advertisement F.1(8)/E-17/2026",
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-AS"],
    scopeLabel: "One temporary, fixed-pay contractual Copyist role at Foreigners Tribunal No. 8, Goalpara. District location is job posting, not an applicant domicile rule.",
    outcome: "One Copyist contract at Foreigners Tribunal No. 8, Goalpara; not a permanent government appointment.",
    status,
    statusNote: "Walk-in registration closed. Goalpara archive lists a final-selection notice; candidate-name PDF is not imported. Founder review pending.",
    applicationWindow: { opensOn: extraction.walkInOn, closesOn: extraction.walkInOn, cutoffLocalTime: extraction.registrationUntil, officialTimeZone: extraction.officialTimeZone, precision: "minute", note: "Scanned advertisement page 1: walk-in report and standard-form submission at Goalpara Municipality Board hall on 10 September 2026, 09:30–12:30 IST. This is not an online application period." },
    qualifications: "Higher Secondary (10+2) from recognized board and six-month Diploma in Computer Application/IT from registered institution; good software knowledge and English/Assamese typing (scanned advertisement page 1).",
    citizenshipRule: "Candidate must be an Indian citizen (scanned advertisement page 1, eligibility criterion 5(i)); foreign citizens do not meet the published application requirement.",
    residenceRule: "Home district/local address is a tie-break preference at equal marks, not a blanket residence requirement. Government Employment Exchange registration is mandatory; scope of acceptable registration needs founder review.",
    selectionStages: ["Walk-in registration and standard-form application", "Personal interview and original-document check", "Shortlist for computer skill test", "Technical/typing test", "Final selection and temporary contract checks"],
    fee: "No application fee stated in the scanned advertisement; confirm before any publication.",
    salary: "₹9,000 monthly fixed pay in scanned advertisement page 1.",
    rules: { complete: false, asOn: "2026-01-01",
      age: { min: 18, max: 40, evidence: "Scanned advertisement page 1, age limit 4: 18–40 on 1 January 2026; unspecified government relaxations require manual review." },
      education: { minLevel: "higher-secondary", evidence: "Scanned advertisement page 1: Higher Secondary plus six-month Computer Application/IT diploma; diploma verification remains manual." },
      nationality: { allowed: ["IN"], evidence: "Scanned advertisement page 1, eligibility criterion 5(i): candidate must be an Indian citizen." },
      languages: [
        { language: "en", stage: "apply", requirement: "Good command, handwriting and typing in English required; no formal proficiency level or test score stated.", evidence: "Scanned advertisement page 1, qualification table and eligibility criterion 5(ii).", sourceUrl: extraction.advertisementUrl },
        { language: "as", stage: "apply", requirement: "Good command, handwriting and typing in Assamese required; no formal proficiency level or test score stated.", evidence: "Scanned advertisement page 1, qualification table and eligibility criterion 5(ii).", sourceUrl: extraction.advertisementUrl },
      ],
      manualChecks: [
        { stage: "apply", text: "Confirm six-month Computer Application/IT diploma, Government Employment Exchange registration, English and Assamese typing/handwriting, and any age relaxation." },
        { stage: "selection", text: "Confirm interview, original certificates, possible employer NOC and computer skill test performance." },
        { stage: "outcome", text: "Confirm temporary appointment approval and final verification; a local address is only a tie-break preference." },
      ],
    },
    venues: [cityVenue("Conference Hall, Goalpara Municipality Board, Kacharighat, Goalpara (published venue; map pin at city precision)", "Goalpara", "IN", "IN-AS")],
    sources: [
      evidenceSource(source, index.evidence, "Goalpara District official recruitment register", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "Foreigners Tribunal No. 8 Copyist original advertisement", "scanned PDF", "English"),
    ],
    applicationUrl: extraction.advertisementUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "Only FT-8 Copyist is extracted; other Goalpara Foreigners Tribunal and district posts remain coverage gaps.",
    "Original scanned notice requires visual founder review; OCR is a research aid only. Age relaxations, diploma recognition and Employment Exchange proof need confirmation.",
    "Result and shortlist PDFs contain candidate names and were not fetched or retained. Index titles only establish that result notices are listed.",
  ] };
};
