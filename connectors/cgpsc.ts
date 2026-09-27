/** Chhattisgarh PSC advertisement archive, with a document-bound pilot for 05/2026. */
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

export const CGPSC_INDEX = "https://psc.cg.gov.in/Advertisement.php";
interface Extraction {
  documentUrl: string; sha256: string; advertisementNumber: string;
  opensOn: string; closesOn: string; cutoffLocalTime: string;
  posts: { id: string; title: string; vacancies: number }[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/cgpsc-05-2026.json", import.meta.url), "utf8")) as Extraction;

export function parseCgpscArchive(html: string) {
  const notices = [...html.matchAll(/<li>\s*<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)]
    .filter((match) => /\/advertisement\//i.test(match[1]))
    .map((match) => {
      const url = new URL(decodeEntities(match[1]), CGPSC_INDEX);
      if (url.origin !== "https://psc.cg.gov.in" || url.username || url.password || !url.pathname.startsWith("/PDFs/advertisement/") || !/\.pdf$/i.test(url.pathname)) throw new Error("CGPSC advertisement document is outside official archive");
      return { url: url.href, title: stripTags(match[2]) };
    });
  if (!notices.length) throw new Error("CGPSC advertisement archive changed: no notices found");
  const microbiologist = notices.filter((notice) => /MICRO[_\s-]?BIOLOGIST/i.test(notice.title));
  if (microbiologist.length !== 1 || microbiologist[0].url !== extraction.documentUrl || !/ADVERTISEMENT.*08-09-2026/i.test(microbiologist[0].title)) throw new Error("CGPSC microbiologist notice or amendments changed; founder review required");
  return { notices, selected: microbiologist[0] };
}

export const cgpsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("CGPSC exact PDF evidence fetch is required");
  const index = await fetchText(CGPSC_INDEX, { accept: "text/html" });
  const parsed = parseCgpscArchive(index.text);
  const pdf = await fetchBytes(parsed.selected.url, { accept: "application/pdf" });
  if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.sha256 !== extraction.sha256) throw new Error("CGPSC 05/2026 notice bytes changed; old applicant extraction withheld");
  if (extraction.posts.length !== 2 || new Set(extraction.posts.map((post) => post.id)).size !== 2) throw new Error("CGPSC 05/2026 post extraction incomplete");
  // No governing zone is established by the date clause. Close only after the
  // deadline has passed in every civil timezone; active status stays uncertain.
  const today = civilDateIn("Etc/GMT+12", now);
  const status = extraction.closesOn < today ? "closed" : "uncertain";
  const cycles = extraction.posts.map((post) => makeCycle({
    id: `cgpsc-2026-05-${post.id}`, sourceId: source.id, title: post.title,
    cycleLabel: `${extraction.advertisementNumber} · ${post.id}`, authority: source.authority,
    pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-CT"],
    scopeLabel: "Chhattisgarh government recruitment; state reservation benefits and applicant domicile must be assessed separately",
    outcome: `Appointment as ${post.title} (${post.vacancies} advertised vacancies; subject to revision)`,
    status, statusNote: "Application dates and separate post applications read from official Hindi advertisement; governing timezone and founder review remain unresolved.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.cutoffLocalTime, officialTimeZone: null, precision: "minute", note: "Applications open at 12:00 noon; governing timezone is not established. Later correction windows are separate from initial application deadline." },
    qualifications: "Post-specific degrees, experience and age conditions in official Hindi advertisement need founder review.",
    citizenshipRule: "The Hindi notice invites Indian citizens and candidate categories recognized by Government of India. Whether a particular foreign citizen qualifies, and required documents, need verification. Do not infer an automatic yes or no.",
    residenceRule: "Chhattisgarh local-resident reservation and fee benefits are described separately. Residence outside the state is not treated as an automatic ban on applying.",
    selectionStages: ["Written examination and interview, subject to notice conditions.", "Question paper medium is stated as Hindi and English. No separate CEFR or other standardized language level is stated; notice-specific language eligibility needs review."],
    sources: [evidenceSource(source, index.evidence, "Official advertisement archive", "HTML", "English"), evidenceSource(source, pdf.evidence, "Advertisement 05/2026 (original Hindi)", "PDF", "Hindi")],
    applicationUrl: "https://psc.cg.gov.in/",
  }));
  return { cycles, evidence: [index.evidence, pdf.evidence], warnings: ["Draft connector covers only advertisement 05/2026. Other 2026 advertisements and departments remain coverage gaps.", "Hindi applicant categories and post-specific qualifications, age, residence and language conditions require founder review. Bilingual question-paper medium is not a proficiency threshold."] };
};
