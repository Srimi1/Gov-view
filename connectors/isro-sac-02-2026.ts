/** ISRO Space Applications Centre advertisement SAC:02:2026, draft-only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle } from "./util.ts";

interface Post { code: string; role: string; positions: number; qualification: string }
interface Extraction {
  indexUrl: string; detailUrl: string; documentUrl: string; documentSha256: string;
  applicationUrl: string; advertisement: string; noticeDate: string;
  opensOn: string; openingLocalTime: string; closesOn: string; cutoffLocalTime: string;
  posts: Post[];
}
const notice = JSON.parse(readFileSync(new URL("../data/extractions/isro-sac-02-2026.json", import.meta.url), "utf8")) as Extraction;

/** Both live HTML pages must still identify the exact advertisement and deadline. */
export function verifySacPages(indexHtml: string, detailHtml: string): void {
  const rows = [...indexHtml.matchAll(/<tr>\s*<td class="location">Space Applications Centre \(SAC\)[\s\S]*?<\/tr>/gi)]
    .filter(([row]) => row.includes(`<td class="advNo">${notice.advertisement}</td>`));
  if (rows.length !== 1 ||
      !/<td class="openDate">\s*Sept 10,2026<\/td>/i.test(rows[0][0]) ||
      !/<td class="closeDate">\s*Sept 30,2026<\/td>/i.test(rows[0][0]) ||
      !rows[0][0].includes("SACRecruitment21.html")) {
    throw new Error("SAC 02/2026 index identity or dates changed; review required");
  }
  const clean = detailHtml.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
  if (!clean.includes(notice.advertisement) || !clean.includes("Sept 30,2026") ||
      !clean.includes("Status: Open") || !clean.includes("Ahmedabad") ||
      !/1000 Hours on 10\.09\.2026 to 1700 hours of 30\.09\.2026/.test(clean) ||
      !detailHtml.includes(new URL(notice.documentUrl).pathname) ||
      !detailHtml.includes(notice.applicationUrl)) {
    throw new Error("SAC 02/2026 detail, status, deadline or links changed; review required");
  }
}

export const isroSac022026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("SAC original PDF bytes required");
  const [index, detail] = await Promise.all([
    fetchText(notice.indexUrl, { accept: "text/html" }),
    fetchText(notice.detailUrl, { accept: "text/html" }),
  ]);
  if (index.evidence.url !== notice.indexUrl || detail.evidence.url !== notice.detailUrl) {
    throw new Error("SAC official page redirected; review required");
  }
  verifySacPages(index.text, detail.text);
  const document = await fetchBytes(notice.documentUrl, { accept: "application/pdf" });
  const sha256 = createHash("sha256").update(document.bytes).digest("hex");
  if (document.bytes.subarray(0, 5).toString() !== "%PDF-" ||
      document.evidence.url !== notice.documentUrl || document.evidence.sha256 !== sha256 ||
      sha256 !== notice.documentSha256) {
    throw new Error("SAC 02/2026 PDF changed; eligibility and dates withheld");
  }
  if (notice.posts.length !== 16 || notice.posts.some((post, index) => post.code !== String(index + 1).padStart(2, "0"))) {
    throw new Error("SAC 02/2026 extracted post choices changed; review required");
  }

  const today = civilDateIn("Asia/Kolkata", now);
  const localClock = clockIn("Asia/Kolkata", now);
  // India clock only gives provisional status. Neither original notice nor detail names a timezone.
  const status = today > notice.closesOn ? "closed" as const
    : today < notice.opensOn || (today === notice.opensOn && localClock < notice.openingLocalTime) ||
      (today === notice.closesOn && localClock >= notice.cutoffLocalTime) ? "uncertain" as const
    : "open" as const;
  const sources = [
    evidenceSource(source, index.evidence, "ISRO current opportunities: SAC:02:2026", "HTML", "English", notice.indexUrl),
    evidenceSource(source, detail.evidence, "SAC recruitment detail SAC:02:2026", "HTML", "English and Hindi", notice.detailUrl),
    evidenceSource(source, document.evidence, "SAC:02:2026 original bilingual advertisement", "PDF", "English and Hindi", notice.documentUrl),
  ];
  const cycles = notice.posts.map((post) => {
    const jrf = Number(post.code) <= 7;
    const associate = Number(post.code) >= 8 && Number(post.code) <= 10;
    const age = jrf ? 28 : 35;
    const pay = jrf ? "₹37,000 per month plus HRA for first two years; ₹42,000 plus HRA in subsequent years"
      : associate ? "Research Associate I/II/III: ₹58,000/₹61,000/₹67,000 per month plus HRA, according to qualification and experience"
      : "₹56,000 per month plus HRA";
    const tenure = jrf ? "Initially one year, extendable subject to review, up to five years"
      : associate ? "Initially one year, extendable subject to review, up to three years"
      : "Initially one year or project duration, extendable subject to project needs; ends with project";
    return makeCycle({
      id: `isro-sac-02-2026-post-${post.code}`, sourceId: source.id,
      title: `${post.role} — SAC post code ${post.code}`, programme: "SAC temporary research positions 2026",
      cycleLabel: `${notice.advertisement} · post code ${post.code}`, authority: source.authority,
      pathway: "recruitment", appointmentType: "temporary", jurisdictionCode: "IN", jurisdictionName: "India",
      scopeLabel: "ISRO central-government research recruitment. Initial posting: SAC, Ahmedabad; project work may require stay elsewhere in India. Ahmedabad is a work location, not a published interview venue or residence rule.",
      workLocations: ["Space Applications Centre, Ahmedabad, Gujarat, India"],
      outcome: `${post.positions} provisional ${post.positions === 1 ? "position" : "positions"} for post code ${post.code}. ${tenure}. No right to regular ISRO appointment.`,
      status,
      statusNote: "Original 18-page bilingual advertisement and current ISRO index/detail retained. First connector output awaits founder review; later corrections and category-specific conditions need checking.",
      applicationWindow: { opensOn: notice.opensOn, closesOn: notice.closesOn,
        cutoffLocalTime: notice.cutoffLocalTime, officialTimeZone: null, precision: "minute",
        note: `Original notice and ISRO detail: online portal ${notice.opensOn} ${notice.openingLocalTime} to ${notice.closesOn} ${notice.cutoffLocalTime}. No governing timezone is printed.` },
      qualifications: `${post.qualification} ${jrf ? "A valid CSIR-UGC NET, GATE, or named national-level examination result/score card is also required on 30 September 2026. " : ""}Where prescribed, M.E./M.Tech. needs at least 60% aggregate or 6.5/10 CGPA/CPI; M.Sc./B.E./B.Tech. needs at least 65% or 6.84/10. Maximum age ${age} on 30 September 2026, subject to published category/service relaxations. Exact degree equivalence, marks and relaxation need review.`,
      citizenshipRule: "Original advertisement Important Information 1: only Indian nationals need apply. A foreign citizen does not meet the published application rule; no foreign/OCI exception is printed.",
      residenceRule: "No Ahmedabad, Gujarat, or other domicile/residence requirement is printed. Work posting does not establish applicant residence eligibility.",
      languageNote: "Bilingual Hindi/English notice. No mandatory language, level or language certificate is printed for applicants.",
      selectionStages: ["Online application for the selected post code", "Academic-record and subject-specialization shortlisting if needed", "Interview; date and venue to be published later", "Original-document and eligibility verification", "Temporary engagement subject to final selection"],
      fee: "No application fee for any post (Important Information 3).", salary: pay,
      rules: { complete: false, asOn: notice.closesOn,
        nationality: { allowed: ["IN"], evidence: "SAC:02:2026 original advertisement, page 11, Important Information 1: Only Indian Nationals need to apply." },
        manualChecks: [
          { stage: "apply", text: `Confirm Indian nationality, post-code ${post.code} degree and marks, age no more than ${age} on 30 September 2026 or documented relaxation.${jrf ? " Confirm valid qualifying NET/GATE/national-test score on closing date." : ""} Related-discipline equivalence requires SAC assessment.` },
          { stage: "selection", text: "Confirm shortlisting and interview invitation. Interview date and place have not been published in this notice." },
          { stage: "outcome", text: "Confirm final selection, document checks and temporary project engagement; selection gives no right to regular ISRO appointment." },
        ],
      },
      venues: [{ kind: "unknown", name: "Interview venue to be announced by SAC" }],
      sources, applicationMethod: "online", applicationUrl: notice.applicationUrl,
    });
  });
  return { cycles, evidence: [index.evidence, detail.evidence, document.evidence], totalAvailable: 16, complete: true, warnings: [
    "Sixteen distinct post-code choices cover 48 provisional positions; position counts do not multiply opportunities.",
    "Only Indian nationals may apply. No foreign/OCI exception or formal applicant language level is printed.",
    "SAC Ahmedabad is initial posting, not a published interview venue. Interview details remain unknown.",
    "The 17:00 cutoff has no printed governing timezone. Deadline-day status becomes uncertain after India local 17:00.",
    "Degree equivalence, marks, age relaxations, JRF qualifying tests and later corrections require founder review.",
    "Only advertisement SAC:02:2026 is bound; other ISRO and SAC calls remain coverage gaps.",
  ] };
};
