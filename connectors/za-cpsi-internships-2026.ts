/** South Africa CPSI internships in DPSA Public Service Vacancy Circular 34/2026; review-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Post { id: string; postCode: string; reference: string; title: string; qualification: string }
interface Extraction {
  circularUrl: string; annexureUrl: string; annexureSha256: string; applicationUrl: string;
  postedOn: string; closesOn: string; cutoffLocalTime: string; posts: Post[];
}
const data = JSON.parse(readFileSync(new URL("../data/extractions/za-cpsi-internships-2026.json", import.meta.url), "utf8")) as Extraction;

/** Page link, original annexure bytes and post identities must agree with retained extraction. */
export function verifyCpsiCircular(html: string): void {
  const article = html.split("<h1 id='content-head'")[1]?.split("<aside")[0] ?? "";
  if (!article.includes("Circular 34 of 2026") ||
      !article.includes("Posting Date: </strong>18 September 2026") ||
      !article.includes(`href="${data.annexureUrl}">Centre for Public Service Innovation</a>`)) {
    throw new Error("DPSA circular or CPSI annexure link changed; review required");
  }
}

export const zaCpsiInternships2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("CPSI original annexure bytes required");
  const circular = await fetchText(data.circularUrl, { accept: "text/html" });
  if (circular.evidence.url !== data.circularUrl) throw new Error("DPSA circular redirected; review required");
  verifyCpsiCircular(circular.text);
  const annexure = await fetchBytes(data.annexureUrl, { accept: "application/pdf" });
  const sha256 = createHash("sha256").update(annexure.bytes).digest("hex");
  if (annexure.bytes.subarray(0, 5).toString() !== "%PDF-" ||
      annexure.evidence.url !== data.annexureUrl || annexure.evidence.sha256 !== sha256 ||
      sha256 !== data.annexureSha256) {
    throw new Error("CPSI annexure PDF changed; extracted fields withheld for review");
  }
  const today = civilDateIn("Africa/Johannesburg", now);
  // Annexure prints 23h59 but names no timezone. Preserve that uncertainty on deadline day.
  const status = today > data.closesOn ? "closed" as const
    : today === data.closesOn || today < data.postedOn ? "uncertain" as const
    : "open" as const;
  const sources = [
    evidenceSource(source, circular.evidence, "DPSA Public Service Vacancy Circular 34 of 2026", "HTML", "English"),
    evidenceSource(source, annexure.evidence, "CPSI Annexure B, posts 34/08 and 34/09", "PDF", "English"),
  ];
  const cycles = data.posts.map((post) => makeCycle({
    id: post.id, sourceId: source.id, title: `${post.title} — CPSI`,
    programme: "CPSI Internship 2026/27", cycleLabel: `Circular 34/2026 · Post ${post.postCode} · Ref ${post.reference}`,
    authority: source.authority, pathway: "recruitment", appointmentType: "contract",
    jurisdictionCode: "ZA", jurisdictionName: "South Africa",
    scopeLabel: "National government component. Pretoria is the work centre, not a published assessment venue or applicant residence rule.",
    outcome: "One 24-month paid internship contract, subject to selection and appointment. Annual salary R98,097.",
    status,
    statusNote: "DPSA circular page and exact CPSI annexure retained. First connector output awaits founder review; later amendments and portal terms need checking.",
    applicationWindow: { opensOn: null, closesOn: data.closesOn, cutoffLocalTime: data.cutoffLocalTime,
      officialTimeZone: null, precision: "minute", note: "CPSI annexure says closing date 05 October 2026 at 23h59, without naming an official timezone. Circular posting date is not an application opening date." },
    qualifications: `${post.qualification} Applicants must be unemployed and must not have participated in a government department internship. Foreign qualifications require SAQA evaluation at applicant expense.`,
    citizenshipRule: "Annexure says shortlisted candidates undergo citizenship or permanent residency verification; it does not say whether every foreign citizen, including a South African permanent resident, may apply. Confirm with CPSI before an international eligibility verdict.",
    residenceRule: "No applicant residence or domicile rule is stated in retained annexure. Pretoria is the work centre only; permanent residency is mentioned as a suitability check, not proven by residence address.",
    languageNote: "Good verbal and written communication skills are requested. No named language, certificate, CEFR level or standardized language score is stated.",
    selectionStages: ["Apply through CPSI eRecruitment; required Z83 information is entered online", "Shortlist and provide certified documents before interview", "Practical exercise, integrity and suitability checks, including citizenship or permanent residency and qualifications", "Reference checks and final appointment decision"],
    fee: "No application fee stated in retained annexure; foreign qualification SAQA evaluation is at applicant expense.",
    salary: "R98,097 per annum for a 24-month internship contract.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "CPSI must confirm eligibility of non-citizens, including South African permanent residents; residence address alone is insufficient. Confirm qualification field, NQF equivalence, unemployment and no prior government internship." },
      { stage: "selection", text: "Confirm practical exercise, interview, integrity, citizenship or permanent residency and SAQA qualification checks. No selection venue is published." },
      { stage: "outcome", text: "Confirm right to take up this public-service internship, contract, appointment and work authorization with CPSI." },
    ] },
    workLocations: ["Pretoria, South Africa"],
    venues: [{ kind: "unknown", name: "Selection venue not published; Pretoria is the work centre" }],
    sources, applicationMethod: "online", applicationUrl: data.applicationUrl,
  }));
  return { cycles, evidence: [circular.evidence, annexure.evidence], complete: false, warnings: [
    "Two distinct post references are separate recruitment cycles; confirm portal submission behavior for each. Neither work centre creates an exam venue.",
    "DPSA circular 34 contains many other departments and provincial annexures that this connector does not cover.",
    "CPSI citizenship or permanent residency verification does not establish a blanket foreign-citizen ban or acceptance; all three eligibility stages need review.",
    "The annexure prints 23h59 without naming an official timezone; the closing-day status stays uncertain.",
    "The eRecruitment portal, later amendments, application fee and any formal language standard need founder confirmation.",
  ] };
};
