/** ICFRE-Forest Research Institute September 2026 temporary fellowship walk-ins. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  indexUrl: string;
  noticeUrl: string;
  noticeSha256: string;
  indexDate: string;
  noticeDate: string;
  walkInDates: [string, string];
  registrationStart: string;
  registrationEnd: string;
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/icfre-fri-walkin-2026.json", import.meta.url), "utf8")) as Extraction;

/** One exact Recruitment row; disappearance or replacement never means cancellation. */
export function verifyIcfreFriIndex(html: string): void {
  const starts = [...html.matchAll(/class=["']text-item-card["']/gi)].map((match) => match.index);
  const matches = starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length)).filter((block) => {
    const text = stripTags(block).replace(/\s+/g, " ");
    return text.includes("Recruitment") && text.includes(notice.indexDate) &&
      text.includes("Project Scientist- II") && text.includes("01.10.2026") && text.includes("05.10.2026") &&
      [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
        .some(([, href]) => new URL(href, notice.indexUrl).pathname === new URL(notice.noticeUrl).pathname);
  });
  if (matches.length !== 1) throw new Error("ICFRE FRI walk-in index changed; review required");
}

export const icfreFriWalkin2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("ICFRE FRI original PDF bytes required");
  const index = await fetchText(notice.indexUrl, { accept: "text/html" });
  if (index.evidence.url !== notice.indexUrl) throw new Error("ICFRE FRI index redirected; review required");
  verifyIcfreFriIndex(index.text);
  const pdf = await fetchBytes(notice.noticeUrl, { accept: "application/pdf" });
  const hash = createHash("sha256").update(pdf.bytes).digest("hex");
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== notice.noticeUrl ||
      pdf.evidence.sha256 !== hash || hash !== notice.noticeSha256) {
    throw new Error("ICFRE FRI original PDF changed; review required");
  }

  const today = civilDateIn("Asia/Kolkata", now);
  const specs = [
    {
      date: notice.walkInDates[0], id: "icfre-fri-fellowships-1-october-2026",
      title: "Temporary project fellowships — FRI Dehradun, 1 October",
      roles: "Project Scientist-II and two Project Associate-I project rows",
      qualifications: "Role-specific qualifications: Project Scientist-II lists a relevant forestry Ph.D. plus three years of research experience; Project Associate-I rows list relevant MSc degrees. Check each project row, experience, NET status and proof requirements in the original table.",
      outcome: "Temporary project fellowships for Project Scientist-II and Project Associate-I roles. Notice says fellowship does not guarantee subsequent employment at any Council institute.",
    },
    {
      date: notice.walkInDates[1], id: "icfre-fri-fellowships-5-october-2026",
      title: "Temporary project fellowships — FRI Dehradun, 5 October",
      roles: "Technical Assistant, Scientific Assistant, Project Assistant and Field Assistant project rows",
      qualifications: "Role-specific qualifications range from Intermediate through science or other bachelor's degrees, with project-specific subjects and desirable experience. Check exact row and documents in the original table.",
      outcome: "Temporary project fellowships for Technical Assistant, Scientific Assistant, Project Assistant and Field Assistant roles. Notice says fellowship does not guarantee subsequent employment at any Council institute.",
    },
  ];
  const cycles = specs.map((spec) => makeCycle({
    id: spec.id, sourceId: source.id,
    title: spec.title, cycleLabel: `September 2026 notice; ${spec.date} walk-in`,
    programme: "FRI September 2026 walk-in fellowship selection",
    authority: source.authority, pathway: "recruitment", appointmentType: "temporary",
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-UT"],
    scopeLabel: `Forest Research Institute, Dehradun, Uttarakhand. ${spec.roles}. Dehradun is the published selection venue, not an applicant domicile restriction.`,
    outcome: spec.outcome,
    status: today < spec.date ? "upcoming" : today === spec.date ? "uncertain" : "closed",
    statusNote: "Original bilingual scanned notice and official update row retained; role table and any later amendment require founder review. Registration closes at the printed time; governing timezone is not named.",
    applicationWindow: { opensOn: spec.date, closesOn: spec.date, cutoffLocalTime: notice.registrationEnd,
      officialTimeZone: null, precision: "minute", note: `Walk-in registration on ${spec.date} from ${notice.registrationStart} to ${notice.registrationEnd} at FRI Dehradun; interview follows. The notice does not name a timezone or say whether the last minute is inclusive.` },
    qualifications: spec.qualifications,
    citizenshipRule: "The six-page notice gives no nationality eligibility clause. International applicants must confirm eligibility to attend selection and hold the fellowship with FRI.",
    residenceRule: "No applicant Uttarakhand domicile or residence restriction is stated in this notice. Work authorization and project travel requirements need individual confirmation.",
    languageNote: "Notice is bilingual Hindi and English and says English governs differences between versions. It does not state an applicant language test, certificate or formal proficiency level; notice language is not an eligibility rule.",
    selectionStages: [
      `Register in person on ${spec.date} between ${notice.registrationStart} and ${notice.registrationEnd} at the FRI Main Building board room in Dehradun`,
      "Bring bio-data, recent passport photograph, self-attested education certificates and relevant documents",
      "Attend same-day walk-in interview; provide employer NOC if already working elsewhere",
    ],
    fee: "No application fee stated in the checked notice; confirm with FRI before attendance.",
    salary: "Fellowship amount varies by role and project; consult the original table.",
    rules: { complete: false, asOn: null, manualChecks: [
      { stage: "apply", text: "Confirm role/project choice, exact qualification, age and relaxation, walk-in registration cutoff and foreign-citizen permission with FRI." },
      { stage: "selection", text: "Confirm interview documents, prior research/fellowship limits, NET status if applicable, employer NOC, and any unstated language requirement." },
      { stage: "outcome", text: "Confirm project tenure, stipend, work authorization and fellowship rules. Notice gives no guarantee of later Council employment." },
    ] },
    venues: [cityVenue("Published walk-in: FRI Main Building board room", "Dehradun", "IN", "UT")],
    sources: [
      evidenceSource(source, index.evidence, "ICFRE official updates register, 21 September row", "HTML", "English"),
      evidenceSource(source, pdf.evidence, "FRI September 2026 walk-in fellowship advertisement, 6 pages", "scanned PDF", "Hindi/English"),
    ],
    applicationMethod: "in-person", applicationUrl: notice.noticeUrl,
  }));
  return { cycles, evidence: [index.evidence, pdf.evidence], complete: false, warnings: [
    "One advertisement has two different walk-in registration dates and role groups; count two application cycles, not the vacancy rows or advertised places.",
    "The notice recruits temporary project fellows and explicitly denies any guarantee of later Council employment. Role-specific credentials and age clauses need founder review.",
    "Foreign-citizen permission and formal language level are not stated. The Hindi/English document does not establish an applicant proficiency rule.",
    "This connector binds one September PDF only; other ICFRE institutes, advertisements, corrections and selection changes remain gaps.",
  ] };
};
