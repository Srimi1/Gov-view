/** Exact-notice NFC ITI apprenticeship intake; all output stays in founder review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string; noticeUrl: string; noticeSha256: string; noticeDate: string;
  closesOn: string; edition: string; tentativePlaces: number; positiveVacancyTrades: number;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/nfc-iti-apprenticeship-2026.json", import.meta.url), "utf8")) as Extraction;

/** Require the dated 2026 ITI row and its exact document, not older apprenticeship links. */
export function verifyNfcItiIndex(html: string): void {
  const rows = [...html.matchAll(/<div><span class="badge badge-primary">27\.08\.2026<\/span><\/div>\s*<ul class="mb-3">([\s\S]*?)<\/ul>/gi)];
  const relevant = rows.filter((row) => /ITI Passed out Candidates for one year Apprenticeship Training/i.test(stripTags(row[1]).replace(/\s+/g, " ")));
  const links = relevant.flatMap((row) => [...row[1].matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map((match) => new URL(match[1], notice.indexUrl).href));
  if (relevant.length !== 1 || links.length !== 1 || links[0] !== notice.noticeUrl) {
    throw new Error("NFC ITI 2026 index row or notice link changed; review required");
  }
}

export const nfcItiApprenticeship: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("NFC ITI original notice bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("NFC official recruitment index redirected; review required");
  verifyNfcItiIndex(index.text);
  const pdf = await fetchBytes(notice.noticeUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== notice.noticeUrl || pdf.evidence.sha256 !== hash || hash !== notice.noticeSha256) {
    throw new Error("NFC ITI 2026 notice changed; dates and eligibility withheld");
  }

  const today = civilDateIn("Asia/Kolkata", now);
  const cycle = makeCycle({
    id: "nfc-iti-apprenticeship-2026-27", sourceId: source.id,
    title: "Nuclear Fuel Complex ITI Trade Apprenticeship — 2026–27",
    programme: "NFC one-year ITI trade apprenticeship",
    cycleLabel: `${notice.edition} · 2026–27`,
    authority: source.authority,
    pathway: "vocational", jurisdictionCode: "IN", jurisdictionName: "India",
    subdivisionCodes: ["IN-TG"],
    scopeLabel: "Training at Nuclear Fuel Complex, Hyderabad, Telangana. Applicants are not offered a government job by this intake.",
    outcome: `One year of apprenticeship training; a National Apprenticeship Certificate follows only after completion and passing the DGT trade test. The notice says training gives no right to NFC employment. ${notice.tentativePlaces} places across ${notice.positiveVacancyTrades} trades are tentative, not separate application cycles.`,
    status: today > notice.closesOn ? "closed" : "uncertain",
    statusNote: "Official 27 August 2026 ITI notice states a 16 September application deadline. Opening date and cutoff hour are not printed; founder review pending.",
    applicationWindow: { opensOn: null, closesOn: notice.closesOn, cutoffLocalTime: null,
      officialTimeZone: "Asia/Kolkata", precision: "date",
      note: "Page 2 gives last date for receipt of applications as 16 September 2026. Notice date is not assumed to be application opening date. No cutoff clock time is stated." },
    qualifications: "Passed class 10 and ITI in the respective listed trade. Age 18–25 at the 16 September 2026 closing date; 28 for OBC and 30 for SC/ST. Applicants with post-graduation or prior/current Apprenticeship Act training are excluded. Joining requires original credentials, Aadhaar-address police verification, medical fitness and other listed documents.",
    citizenshipRule: "The notice does not state citizenship or foreign-national eligibility. It requires NAPS registration and Aadhaar-related police verification at joining. Neither condition by itself proves international applicants can apply; confirm with NFC and the official portal.",
    residenceRule: "No applicant domicile condition is stated in the notice. Hyderabad is the training location, not a residence-eligibility rule.",
    languageNote: "Notice is bilingual Hindi/English and lists a Stenographer (English) trade with zero places. It states no general proficiency level, CEFR score or language certificate for the advertised trades; bilingual notice text is not a language eligibility requirement.",
    selectionStages: ["NAPS portal registration and application to NFC establishment E11153600013", "Application and credential review", "Walk-in interview after email notification", "Joining document and medical checks", "One-year training", "DGT trade test for National Apprenticeship Certificate"],
    fee: "Application fee not stated in checked NFC notice; verify with authority and NAPS portal.",
    rules: { complete: false, asOn: notice.closesOn,
      age: { min: 18, max: 25, relaxations: [{ category: "obc", years: 3 }, { category: "sc", years: 5 }, { category: "st", years: 5 }], evidence: "NFC/R-III/1/08/2026, page 2, General Instructions 4: age on closing date, 18 minimum; upper 25 General, 28 OBC, 30 SC/ST." },
      manualChecks: [
        { stage: "apply", text: "Verify class 10, relevant ITI trade, NAPS registration, no postgraduate degree and no prior/current Apprenticeship Act training. NFC notice does not decide foreign-national eligibility." },
        { stage: "selection", text: "NFC selects after application review and walk-in interview; email invitation and credential checks need authority confirmation." },
        { stage: "outcome", text: "Confirm medical fitness and joining documents, complete one-year training, then pass DGT trade test for certificate. Apprenticeship grants no NFC employment right." },
      ],
    },
    venues: [{ kind: "unknown", name: "Interview venue is not published in this notice; NFC Hyderabad is the training location" }],
    sources: [
      evidenceSource(source, index.evidence, "NFC official recruitment register, 27 August 2026 ITI row", "HTML", "English and Hindi"),
      evidenceSource(source, pdf.evidence, "NFC ITI trade apprentices 2026–27, 10-page official notice", "PDF", "English and Hindi"),
    ],
    applicationUrl: "https://www.apprenticeshipindia.gov.in/",
  });
  return { cycles: [cycle], evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "One NFC ITI application intake spans 15 trades with places; zero-place Stenographer (English) is not advertised as an available place.",
    "No citizenship permission, general language level, opening date, or cutoff hour is published in this checked notice.",
    "NAPS registration and Aadhaar-related joining documents do not establish foreign-national eligibility; founder must verify with NFC.",
    "The separate NFC diploma/graduate apprenticeship notice and other recruitment advertisements remain gaps.",
  ] };
};
