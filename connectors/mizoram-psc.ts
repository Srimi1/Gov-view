/** Mizoram PSC current MPSC posts 25 and 26 of 2026-27; exact evidence, draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { dayFirstDate, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Post {
  advertisement: string; url: string; sha256: string; title: string; vacancies: number;
  notificationDate: string; closesOn: string; cutoffLocalTime: string; payLevel: number;
}
interface Extraction {
  indexUrl: string; amendmentsUrl: string; languageNotice: { url: string; sha256: string };
  posts: Post[]; ageAsOn: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/mizoram-25-26-2026-27.json", import.meta.url), "utf8")) as Extraction;
export const MIZORAM_INDEX = extraction.indexUrl;
export const MIZORAM_AMENDMENTS = extraction.amendmentsUrl;

function officialPdf(href: string): string {
  const url = new URL(href, MIZORAM_INDEX);
  if (url.origin !== "https://mpsc.mizoram.gov.in" || !/^\/uploads\/attachments\/\d{4}\/\d{2}\/[a-f0-9]{32}\/[^/]+\.pdf$/i.test(url.pathname) || url.search || url.hash) throw new Error("Mizoram advertisement outside official PDF archive");
  return url.href;
}

export function parseMizoramIndex(html: string) {
  const body = /<table\b[^>]*class="table"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1];
  if (!body) throw new Error("Mizoram advertisement table changed");
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const found: { post: Post; url: string }[] = [];
  for (const row of rows) {
    const title = stripTags(row).replace(/\s+/g, " ");
    if (!/Advertisement No\.\s*(?:25|26)\s+of\s+2026-27/i.test(title)) continue;
    const number = /Advertisement No\.\s*(25|26)\s+of\s+2026-27/i.exec(title)?.[1];
    const post = extraction.posts.find((item) => item.advertisement.startsWith(`${number}/`));
    if (!post) throw new Error("Mizoram advertisement identity changed");
    const links = [...row.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    if (links.length !== 1) throw new Error(`Mizoram ${post.advertisement} row changed or amended`);
    const url = officialPdf(links[0][1]);
    const dates = title.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g) ?? [];
    if (dates.length !== 2 || dayFirstDate(dates[0]) !== post.notificationDate || dayFirstDate(dates[1]) !== post.closesOn || url !== post.url) throw new Error(`Mizoram ${post.advertisement} dates or PDF changed; review required`);
    found.push({ post, url });
  }
  if (found.length !== extraction.posts.length || new Set(found.map((item) => item.post.advertisement)).size !== extraction.posts.length) throw new Error("Mizoram selected notices missing or duplicated");
  return found;
}

export function checkMizoramAmendments(html: string) {
  const text = stripTags(html).replace(/\s+/g, " ");
  if (!/Corrigendum|Addendum/i.test(text)) throw new Error("Mizoram amendment register changed");
  if (/Advertisement No\.?\s*(?:25|26)\s+of\s+2026[-–]27/i.test(text) || /Peon\s*\(PE\)\s*under MPSC/i.test(text)) throw new Error("Mizoram selected advertisement may have new amendment; review required");
}

export const mizoramPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Mizoram exact PDF evidence fetch required");
  const index = await fetchText(MIZORAM_INDEX, { accept: "text/html" });
  const found = parseMizoramIndex(index.text);
  const amendments = await fetchText(MIZORAM_AMENDMENTS, { accept: "text/html" });
  checkMizoramAmendments(amendments.text);
  const languageUrl = officialPdf(extraction.languageNotice.url);
  const language = await fetchBytes(languageUrl, { accept: "application/pdf" });
  const evidence = [index.evidence, amendments.evidence, language.evidence];
  function verifiedPdf(bytes: Buffer, url: string, expectedUrl: string, sha256: string, evidenceHash: string) {
    if (bytes.subarray(0, 5).toString() !== "%PDF-" || createHash("sha256").update(bytes).digest("hex") !== sha256 || evidenceHash !== sha256 || url !== expectedUrl) throw new Error("Mizoram PDF changed; old dates and applicant rules withheld");
  }
  verifiedPdf(language.bytes, language.evidence.url, languageUrl, extraction.languageNotice.sha256, language.evidence.sha256);
  const cycles = [];
  for (const { post, url } of found) {
    const pdf = await fetchBytes(url, { accept: "application/pdf" });
    verifiedPdf(pdf.bytes, pdf.evidence.url, post.url, post.sha256, pdf.evidence.sha256);
    evidence.push(pdf.evidence);
    const peon = post.advertisement.startsWith("26/");
    const today = civilDateIn("Asia/Kolkata", now);
    const closed = today > post.closesOn || (today === post.closesOn && clockIn("Asia/Kolkata", now) >= post.cutoffLocalTime);
    const sources = [
      { ...evidenceSource(source, index.evidence, "MPSC 2026-27 advertisement archive", "HTML" as const, "English"), lastValidatedAt: null },
      { ...evidenceSource(source, amendments.evidence, "MPSC corrigendum/addendum register", "HTML" as const, "English"), lastValidatedAt: null },
      { ...evidenceSource(source, pdf.evidence, `Advertisement ${post.advertisement}: ${post.title}`, "PDF" as const, "English"), lastValidatedAt: null },
      { ...evidenceSource(source, language.evidence, "Mizo Language Proficiency qualifying-test notification, 2024", "PDF" as const, "English"), lastValidatedAt: null },
    ];
    cycles.push(makeCycle({
      id: `mizoram-psc-2026-${peon ? "26-peon" : "25-ldc"}`, sourceId: source.id,
      title: post.title, cycleLabel: `Advertisement ${post.advertisement}`, authority: source.authority,
      pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-MZ"],
      scopeLabel: "Mizoram Public Service Commission direct recruitment; nationality and domicile conditions require service-rule review",
      outcome: `${post.title} appointment (${post.vacancies} posts${peon ? "; one position reserved for a person with benchmark disability" : ""})`,
      status: closed ? "closed" : "uncertain",
      statusNote: closed ? "Published application cutoff passed; draft still awaiting founder review." : "Official notice lists future application deadline. Opening date and live form status require founder review.",
      applicationWindow: { opensOn: null, closesOn: post.closesOn, cutoffLocalTime: post.cutoffLocalTime, officialTimeZone: "Asia/Kolkata", precision: "minute", note: `Advertisement ${post.advertisement}, page 1, says applications can be submitted until 4:00 PM. It does not print a timezone; Asia/Kolkata is local Aizawl time. Archive notification date does not establish opening date.` },
      qualifications: peon
        ? "Class VIII certificate or above from a recognized institution (advertisement page 1)."
        : "Higher Secondary School Leaving Certificate, recognized Diploma/Certificate Course in Computer Application, typing speed 30 words per minute and prescribed computer proficiency (advertisement pages 1–2).",
      citizenshipRule: "Nationality and international-applicant permission are not stated in the retained advertisement or language notice. Verify the cited recruitment rules before deciding whether a foreign citizen may apply.",
      residenceRule: "Mizoram hiring scope does not establish an applicant domicile rule. Verify the cited recruitment rules and any reservation conditions.",
      selectionStages: ["Direct Recruitment Examination; examination syllabus is linked in the advertisement. Exact stages and examination venue require review.", "Mizo Language Proficiency qualifying test unless stated Class-X/MIL exemption applies."],
      fee: "Persons with disabilities are exempt from application fees; general fee amount is not stated in the retained notice (advertisement page 4).",
      salary: `Pay Matrix Level ${post.payLevel} (advertisement page 1).`,
      rules: { complete: false, asOn: extraction.ageAsOn,
        languages: [{ language: "lus", requirement: "Pass government-prescribed Mizo Language Proficiency qualifying test; exempt if Mizo was studied at Class X or above in Mizoram or as MIL outside Mizoram. Numerical pass mark and CEFR level not stated in these notices.", stage: "selection", evidence: `Advertisement ${post.advertisement}, Mizo Language Proficiency clause; MPSC 13 June 2024 qualifying-test notification, page 1.`, sourceUrl: post.url }],
        manualChecks: [
          { stage: "apply", text: "Verify nationality, any residence rules and age 18–35 on 1 August 2026 with applicable SC/ST or government-notified relaxations (advertisement pages 1–2)." },
          { stage: "apply", text: peon ? "Verify recognized Class VIII certificate and required document uploads by application deadline (pages 1–2)." : "Verify HSSLC, computer-application certificate, 30 wpm typing, computer proficiency and required uploads by application deadline (pages 1–3)." },
          { stage: "selection", text: "Verify Mizo qualifying-test result or Class-X/MIL exemption and documentary evidence; notice gives no numerical pass mark (advertisement and 2024 notification)." },
        ],
      },
      venues: [{ kind: "unknown", name: "Examination venue not published in retained advertisement" }],
      sources, applicationUrl: "https://mpsconline.mizoram.gov.in/",
    }));
  }
  return { cycles, evidence, warnings: ["Only two current MPSC post advertisements are document-bound in this pilot; other Mizoram notices and authorities remain gaps.", "Neither advertisement states nationality, domicile, application opening date or a numerical Mizo test pass mark. International eligibility and live form status require founder review.", "The general fee amount, detailed exam stages and venues are not established by these PDFs."] };
};
