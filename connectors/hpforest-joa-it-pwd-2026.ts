/** HP Forest JOA (IT) PwBD notice, scanned and deadline-conflicted; review only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Extraction {
  registerUrl: string; noticeUrl: string; noticeSha256: string; advertisement: string;
  scheduleReceiptOn: string; noteReceiptOn: string; positions: number;
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/hpforest-joa-it-pwd-2026.json", import.meta.url), "utf8")) as Extraction;

/** Bind current register item and refuse any amendment in its row. */
export function verifyHpForestRegister(html: string): void {
  const rows = html.split(/<li\b/i).map((item) => item.split("</li>")[0]);
  const matching = rows.filter((row) => /Junior office Assistant/i.test(row));
  if (matching.length !== 1) throw new Error("HP Forest JOA register item changed; review required");
  const row = matching[0];
  if (!row.includes('href="../..//storage/files/1/pdf/Recreuitment/JOA%20IT%20PWD.pdf"') ||
      !row.includes("Recruitment of Junior office Assistant") ||
      !row.includes("Physically handicapped quota") ||
      /corrigendum|addendum|extension|revised/i.test(row) ||
      (row.match(/<a\b/gi)?.length ?? 0) !== 1) {
    throw new Error("HP Forest JOA register item changed; review required");
  }
}

export const hpForestJoaItPwd2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("HP Forest original scanned PDF bytes required");
  const register = await fetchText(data.registerUrl, { accept: "text/html" });
  if (register.evidence.url !== data.registerUrl) throw new Error("HP Forest register redirected; review required");
  verifyHpForestRegister(register.text);
  const document = await fetchBytes(data.noticeUrl, { accept: "application/pdf" });
  const sha256 = createHash("sha256").update(document.bytes).digest("hex");
  if (document.bytes.subarray(0, 5).toString() !== "%PDF-" ||
      document.evidence.url !== data.noticeUrl || document.evidence.sha256 !== sha256 ||
      sha256 !== data.noticeSha256) {
    throw new Error("HP Forest JOA scanned PDF changed; extracted fields withheld");
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today > data.noteReceiptOn ? "closed" as const : "uncertain" as const;
  const cycle = makeCycle({
    id: "hpforest-joa-it-pwbd-2026", sourceId: source.id,
    title: "Junior Office Assistant (IT), PwBD — HP Forest Department",
    programme: "HP Forest Junior Office Assistant (IT) PwBD recruitment 2026",
    cycleLabel: `Advertisement ${data.advertisement}`, authority: source.authority,
    pathway: "recruitment", appointmentType: "contract", jurisdictionCode: "IN", jurisdictionName: "India",
    subdivisionCodes: ["IN-HP"],
    scopeLabel: "Himachal Pradesh Forest Department recruitment. Talland, Shimla is the application-receipt office, not a published screening venue or guaranteed work posting.",
    outcome: `${data.positions} contract JOA (IT) posts reserved for persons with benchmark disabilities: one visually impaired and one hearing impaired. Fixed monthly amount ₹12,360 per covering letter; no right to permanent absorption is stated.`,
    status,
    statusNote: "Original four-page scanned notice retained. Its schedule says receipt of applications 30 September 2026; its signed note says complete applications reach office by 10 October 2026. This conflict prevents a verified deadline or open-state claim. Founder review required.",
    applicationWindow: { opensOn: null, closesOn: null, cutoffLocalTime: null, officialTimeZone: null, precision: "date",
      note: "Conflicting dates in same PDF: schedule target for receipt 30 September 2026; signed note says complete applications must reach Principal Chief Conservator of Forests by 10 October 2026. Confirm controlling deadline with authority. No receipt hour or governing timezone is printed." },
    qualifications: "10+2 from a recognized board or university; alternatively Matriculation plus specified one/two-year IT/ITES ITI credential or three-year AICTE-approved Computer Engineering/Computer Science/IT polytechnic diploma. Computer typing: 30 words/minute in English OR 25 words/minute in Hindi. Valid benchmark-disability proof for relevant reserved category is required.",
    citizenshipRule: "Other Conditions clause (d) of original advertisement says applicant should be an Indian citizen. No foreign-citizen exception is stated. This is an appointment condition; whether a foreign citizen could submit a form or enter screening is not separately stated, but they cannot meet the published job condition.",
    residenceRule: "Signed note 1 says candidates should be bona fide residents of Himachal Pradesh and note 3 requires proof. Its separate Class-III school-location clause excludes bona fide Himachalis; how that interacts with qualification alternatives needs founder review.",
    languageNote: "Notice requires computer typing of 30 WPM in English OR 25 WPM in Hindi. These are alternative typing tests, not CEFR or other formal language-proficiency levels. Test date and venue are not published.",
    selectionStages: ["Submit prescribed simple application with attested disability, education, age and Himachal-residence documents to HP Forest HoFF office; receipt date conflicted", "Departmental scrutiny and call letters, then screening on a date to be announced", "Verify Indian citizenship, bona fide Himachal residence and contract agreement before appointment"],
    fee: "No application fee stated in retained four-page advertisement; confirm with department.",
    salary: "₹12,360 monthly fixed contract amount per covering letter (60% of first ₹20,600 pay-matrix cell).",
    rules: { complete: false, asOn: null,
      nationality: { allowed: ["IN"], stage: "outcome", evidence: "Original advertisement, page 2, Other Conditions (d): 'Nationality: Should be Indian citizen.'" },
      residence: { countries: ["IN"], subdivisions: ["IN-HP"], stage: "apply", evidence: "Signed note 1 on page 3: candidates should be bona fide residents of Himachal Pradesh; note 3 requires proof." },
      manualChecks: [
        { stage: "apply", text: "Confirm controlling receipt deadline: 30 September schedule target versus 10 October signed note; clarify receipt method, office hour and required PwBD category certificate." },
        { stage: "apply", text: "Confirm qualification alternatives, Class-III schooling condition, age 18–45 and reckoning date, and bona fide Himachali proof." },
        { stage: "selection", text: "Confirm screening method, date and venue; English 30 WPM OR Hindi 25 WPM typing must be assessed without inventing a standardized language level." },
        { stage: "outcome", text: "Confirm Indian citizenship proof, contract agreement, disability-reservation eligibility, final workplace and tenure." },
      ],
    },
    venues: [{ kind: "unknown", name: "Screening venue not published; Talland is application-receipt office" }],
    sources: [
      evidenceSource(source, register.evidence, "HP Forest Department recruitment register", "HTML", "English"),
      evidenceSource(source, document.evidence, "JOA (IT) PwBD advertisement, cover letter and form", "scanned PDF", "English"),
    ],
    applicationUrl: data.noticeUrl,
  });
  return { cycles: [cycle], evidence: [register.evidence, document.evidence], complete: false, warnings: [
    "Same scanned notice prints two application-receipt dates: 30 September schedule target and 10 October signed note. Do not show a confirmed cutoff or send deadline alerts before founder/authority resolution.",
    "Two reserved posts share one JOA (IT) application cycle; vacancy count does not multiply opportunity count.",
    "Indian citizenship is expressly required for appointment. Form acceptance and screening access for foreign citizens are not separately stated; do not imply either provides job eligibility.",
    "English 30 WPM or Hindi 25 WPM are alternative typing standards, not a formal language level.",
    "Scanned text and potential later amendments need visual founder review. HPPSC, HPRCA and other HP Forest recruitment rows remain separate coverage gaps.",
  ] };
};
