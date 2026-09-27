/** ICMR-NITHR Young Professional-I (Admin), exact bilingual notice; review only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  indexUrl: string; englishUrl: string; englishSha256: string;
  hindiUrl: string; hindiSha256: string; advertisement: string;
  noticeOn: string; walkInOn: string; interviewStartsAt: string; positions: number;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/icmr-nithr-yp1-admin-2026.json", import.meta.url), "utf8")) as Extraction;

/** Distinguish this one walk-in from many posts sharing advertisement 05/2026-27. */
export function verifyIcmrNithrRow(html: string): void {
  const rows = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => row.includes("Young Professional-I (Admin)") && row.includes(data.englishUrl));
  if (rows.length !== 1 || !rows[0].includes(data.hindiUrl) ||
      !rows[0].includes("ICMR-NITHR, Jabalpur") ||
      !rows[0].includes("Oct. 6, 2026") ||
      !rows[0].includes("Temporary Posts")) {
    throw new Error("ICMR-NITHR Young Professional index row changed; review required");
  }
}

export const icmrNithrYp1Admin2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("ICMR-NITHR original PDF bytes required");
  const index = await fetchText(data.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== data.indexUrl) throw new Error("ICMR employment index redirected; review required");
  verifyIcmrNithrRow(index.text);
  const expected = [[data.englishUrl, data.englishSha256], [data.hindiUrl, data.hindiSha256]] as const;
  const documents = [];
  for (const [url, pinnedSha256] of expected) {
    const document = await fetchBytes(url, { accept: "application/pdf" });
    const actualSha256 = createHash("sha256").update(document.bytes).digest("hex");
    if (document.bytes.subarray(0, 5).toString() !== "%PDF-" ||
        document.evidence.url !== url || document.evidence.sha256 !== actualSha256 ||
        actualSha256 !== pinnedSha256) {
      throw new Error("ICMR-NITHR Young Professional PDF changed; extracted fields withheld");
    }
    documents.push(document);
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > data.walkInOn ? "closed" as const : today < data.walkInOn ? "upcoming" as const : "uncertain" as const;
  const cycle = makeCycle({
    id: "icmr-nithr-yp1-admin-2026", sourceId: source.id,
    title: "Young Professional-I (Administration) — ICMR-NITHR",
    programme: "ICMR-NITHR Young Professional-I Administration", cycleLabel: `Advertisement ${data.advertisement}, 21 September 2026`,
    authority: "ICMR National Institute for Tribal Health Research, Jabalpur",
    pathway: "recruitment", appointmentType: "contract", jurisdictionCode: "IN", jurisdictionName: "India",
    subdivisionCodes: ["IN-MP"],
    scopeLabel: "One walk-in selection for a temporary administration contract at ICMR-NITHR, Jabalpur. Other posts under advertisement 05/2026-27 have separate role-specific notices and remain gaps.",
    outcome: `${data.positions} Young Professional-I (Admin) contract at ₹35,000 per month without HRA. Initial term one year, renewable one year at a time up to three years; no right to regular absorption.`,
    status,
    statusNote: "Official ICMR index and English/Hindi notices retained. Walk-in interview begins 6 October 2026 at 09:00. Notice gives no last arrival time. Age wording differs between summary ('Max.30') and Table A ('Less than 30'); founder review required.",
    applicationWindow: { opensOn: null, closesOn: data.walkInOn, cutoffLocalTime: null, officialTimeZone: null, precision: "date",
      note: "Apply by attending the 6 October 2026 walk-in with completed application form and original documents. 09:00 is interview start, not a stated acceptance cutoff. No separate online application window, closing clock time or official timezone is printed." },
    qualifications: "Graduate in any discipline with at least 55% marks from a recognized university/college, plus at least one year of relevant post-qualification experience. Internships and training do not count. Notice gives conflicting boundary wording for age 30; any rule-based relaxation needs review.",
    citizenshipRule: "Neither retained notice states a nationality requirement or foreign-citizen route. An international applicant must verify eligibility with ICMR-NITHR before travel or application.",
    residenceRule: "No domicile or residence requirement is stated in retained notice. Jabalpur is interview and work location, not an applicant-residence rule.",
    languageNote: "Strong writing skills in Hindi and English are listed as desirable, not essential. No CEFR or other formal proficiency level is stated; neither language is encoded as a mandatory deterministic rule.",
    selectionStages: ["Bring filled application form and original qualification/experience documents to Jabalpur walk-in from 09:00 on 6 October", "Original-document verification before interview participation", "Walk-in interview and institute selection; contract engagement subject to ICMR Young Professional guidelines"],
    fee: "No application fee stated in retained English/Hindi notice; confirm with institute.",
    salary: "₹35,000 monthly consolidated, no HRA.",
    rules: { complete: false, asOn: data.walkInOn,
      manualChecks: [
        { stage: "apply", text: "Verify nationality route, age boundary ('Max.30' versus 'Less than 30') and any relaxation, graduate marks, one year post-qualification experience, form format and whether regular government/PSU service bars application." },
        { stage: "selection", text: "Verify original documents, arrival procedure and any later update at ICMR-NITHR; 09:00 is interview start, not a confirmed last check-in time." },
        { stage: "outcome", text: "Verify citizenship/work authorization, one-year contract with possible extensions, no regular absorption, and final institute terms." },
      ],
    },
    workLocations: ["ICMR-NITHR, Jabalpur, Madhya Pradesh"],
    venues: [{ kind: "published-address", name: "ICMR-NITHR, Nagpur Road, Dhanvantri Nagar, Garha, Jabalpur, Madhya Pradesh 482003", city: "Jabalpur", subdivision: "IN-MP" }],
    sources: [
      evidenceSource(source, index.evidence, "ICMR employment opportunities index: NITHR Young Professional-I (Admin)", "HTML", "English"),
      evidenceSource(source, documents[0].evidence, "ICMR-NITHR advertisement 05/2026-27, Young Professional-I (Admin)", "PDF", "English"),
      evidenceSource(source, documents[1].evidence, "ICMR-NITHR Young Professional-I (Admin), Hindi notice", "PDF", "Hindi"),
    ],
    applicationMethod: "in-person", applicationUrl: data.englishUrl,
  });
  return { cycles: [cycle], evidence: [index.evidence, ...documents.map((item) => item.evidence)], complete: false, warnings: [
    "This is a walk-in on 6 October, not an online deadline. 09:00 is start time; no last arrival time or official timezone is specified.",
    "Notice summary says Max.30 years while Table A says less than 30; age boundary and relaxation must be resolved before approval.",
    "Hindi/English writing is desirable, without a formal level. Nationality and foreign-citizen eligibility are unstated.",
    "NIRTH institutional vacancy page could not be checked by project collector because its robots.txt returned non-text content; later institute-only corrigenda remain a gap.",
    "Published street address has no verified coordinates, so it is shown in details without a map pin.",
    "Other role-specific notices sharing advertisement 05/2026-27 remain uncollected; this one role counts once.",
  ] };
};
