/** Two role-specific walk-in drafts under one Sribhumi Foreigners Tribunal-II notice. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockSecondIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Role { id: string; name: string; vacancies: number; monthlyPayInr: number }
interface Extraction {
  indexUrl: string; documentUrl: string; documentSha256: string; indexPublishedOn: string;
  walkInOn: string; registrationOpensLocalTime: string; registrationClosesLocalTime: string;
  contractThrough: string; roles: Role[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/sribhumi-ft2-deo-copyist-2026.json", import.meta.url), "utf8")) as Extraction;
export const SRIBHUMI_INDEX = extraction.indexUrl;
export const SRIBHUMI_NOTICE = extraction.documentUrl;

export function checkSribhumiIndex(html: string): void {
  const anchors = [...html.matchAll(/<a\b[^>]*href="([^"]+\.pdf)"[^>]*title="([^"]+)"[^>]*>/gi)]
    .filter((match) => /Foreigners Tribunal-II/i.test(stripTags(match[2])));
  if (anchors.length !== 1 || !/Data Entry Operator.*Copyist/i.test(stripTags(anchors[0][2])) ||
      new URL(anchors[0][1], SRIBHUMI_INDEX).href !== SRIBHUMI_NOTICE) {
    throw new Error("Sribhumi Tribunal-II notice identity changed; review required");
  }
  const row = html.slice(anchors[0].index, html.indexOf("</li>", anchors[0].index));
  if (!row.includes(`datetime="${extraction.indexPublishedOn}T`) || !/Source\s*:\s*<\/a>\s*<span>District Administration<\/span>/i.test(row)) {
    throw new Error("Sribhumi Tribunal-II publication row changed; review required");
  }
}

export const sribhumiFt2: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Sribhumi original PDF byte fetch required");
  const index = await fetchText(SRIBHUMI_INDEX, { accept: "text/html" });
  if (index.evidence.url !== SRIBHUMI_INDEX) throw new Error("Sribhumi advertisement index redirected; review required");
  checkSribhumiIndex(index.text);
  const notice = await fetchBytes(SRIBHUMI_NOTICE, { accept: "application/pdf" });
  const hash = createHash("sha256").update(notice.bytes).digest("hex");
  if (notice.bytes.subarray(0, 5).toString() !== "%PDF-" || notice.evidence.url !== SRIBHUMI_NOTICE ||
      notice.evidence.sha256 !== hash || hash !== extraction.documentSha256) {
    throw new Error("Sribhumi Tribunal-II original PDF changed; extracted fields withheld");
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const clock = clockSecondIn("Asia/Kolkata", now);
  const status = today < extraction.walkInOn || (today === extraction.walkInOn && clock < `${extraction.registrationOpensLocalTime}:00`)
    ? "upcoming" : today > extraction.walkInOn || (today === extraction.walkInOn && clock > `${extraction.registrationClosesLocalTime}:00`)
      ? "closed" : "open";
  const cycles = extraction.roles.map((role) => {
    const copyist = role.name === "Copyist";
    return makeCycle({
      id: role.id,
      sourceId: source.id,
      title: `Sribhumi Foreigners Tribunal-II ${role.name} 2026`,
      cycleLabel: `Tribunal-II walk-in notice ${extraction.indexPublishedOn}; ${role.name}`,
      programme: "Sribhumi Foreigners Tribunal-II contractual recruitment",
      authority: source.authority,
      pathway: "recruitment",
      jurisdictionCode: "IN",
      jurisdictionName: "India",
      subdivisionCodes: ["IN-AS"],
      scopeLabel: `One ${role.name} contract post at Foreigners Tribunal-II, Sribhumi, Assam; shared walk-in notice has two posts`,
      outcome: `Fixed-pay ${role.name} contract appointment through 22 May 2027, subject to Ministry of Home Affairs post extension; one vacancy`,
      status,
      statusNote: "Official notice names 12 September 2026 walk-in; registration closes at 11:00. Role grouping and eligibility await founder review. Elapsed date does not imply cancellation.",
      applicationWindow: {
        opensOn: extraction.walkInOn,
        closesOn: extraction.walkInOn,
        officialTimeZone: "Asia/Kolkata",
        cutoffLocalTime: extraction.registrationClosesLocalTime,
        cutoffInclusive: true,
        precision: "minute",
        note: "Original notice page 1: submit standard form and documents at walk-in registration on 12 September 2026 between 09:00 and 11:00. No application is considered after 11:00. Interview starts at 09:00. Asia/Kolkata is local interpretation.",
      },
      qualifications: copyist
        ? "Higher-secondary pass; six-month Computer Diploma from government-recognized institution; good handwriting in English and Bengali. Notice page 1 gives no formal language level."
        : "Higher-secondary pass; six-month Computer Diploma from government-recognized institution; adept in MS Office and Internet processing (notice page 1).",
      citizenshipRule: "Original notice page 1 does not state citizenship or a foreign-national route. International applicants need authority confirmation for application, interview and contract appointment.",
      residenceRule: "Employment Registration Certificate is required at walk-in, but notice does not state a separate domicile rule or certificate issuing area. Verify how international applicants can meet registration condition.",
      selectionStages: ["Bring Assam Gazette Part IX standard application and self-attested evidence to 09:00–11:00 registration", "Walk-in interview at Foreigners Tribunal-II office, Sribhumi, from 09:00", "Original document and employment-registration checks", "Fixed-pay contract agreement if selected"],
      fee: "No fee stated in the notice; verify before assuming free application.",
      salary: `₹${role.monthlyPayInr.toLocaleString("en-IN")} fixed pay per month (notice page 1).`,
      rules: { complete: false, asOn: null,
        age: { max: 40, evidence: "Original notice page 1: age not more than 40 years for both posts; no age-reference date printed." },
        education: { minLevel: "higher-secondary", evidence: "Original notice page 1: H.S. passed from recognized board/council; six-month computer diploma separately requires manual verification." },
        ...(copyist ? { languages: [
          { language: "en", stage: "apply" as const, requirement: "Good handwriting skill in English; no formal level stated.", evidence: "Original notice page 1, Copyist qualification row.", sourceUrl: SRIBHUMI_NOTICE },
          { language: "bn", stage: "apply" as const, requirement: "Good handwriting skill in Bengali; no formal level stated.", evidence: "Original notice page 1, Copyist qualification row.", sourceUrl: SRIBHUMI_NOTICE },
        ] } : {}),
        manualChecks: [
          { stage: "apply", text: "Confirm nationality permission and valid Employment Registration Certificate; notice does not give foreign-citizen or domicile eligibility." },
          { stage: "apply", text: "Verify six-month government-recognized computer diploma, age-reference date, complete standard form and role choice." },
          ...(copyist ? [{ stage: "apply" as const, text: "Verify good handwriting in both English and Bengali; no CEFR or numerical level is published." }] : []),
          { stage: "selection", text: "Bring originals and self-attested proof to registration by 11:00 on 12 September; confirm interview and any later notice." },
          { stage: "outcome", text: "Confirm foreign-national contract permission, document checks, fixed-pay agreement and post-extension status." },
        ],
      },
      venues: [cityVenue("Walk-in: Office of the Member, Foreigners Tribunal-2nd, Sribhumi", "Sribhumi", "IN", "IN-AS")],
      sources: [
        evidenceSource(source, index.evidence, "Sribhumi District Administration advertisement register", "HTML", "English"),
        evidenceSource(source, notice.evidence, "Tribunal-II Data Entry Operator and Copyist walk-in advertisement", "scanned PDF", "English"),
      ],
      applicationUrl: SRIBHUMI_NOTICE,
    });
  });
  return { cycles, evidence: [index.evidence, notice.evidence], complete: false, warnings: [
    "Two role-specific drafts share one notice and registration window; founder must confirm whether separate standard forms or role choices make them distinct application cycles before approval.",
    "Copyist alone requires good handwriting in English and Bengali. No formal proficiency level is printed; Data Entry Operator has no stated language requirement.",
    "No citizenship or domicile permission is stated; Employment Registration Certificate is required. International application, interview and contract appointment remain needs verification.",
    "Only one Sribhumi Tribunal-II notice is extracted. Assam PSC, other districts and departmental recruitment remain coverage gaps.",
  ] };
};
