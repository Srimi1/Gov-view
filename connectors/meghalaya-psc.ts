/** Meghalaya PSC advertisement 03/2026: two post codes, two scanned amendments. Draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle, stripTags } from "./util.ts";

export const MEGHALAYA_INDEX = "https://mpsc.meghalaya.gov.in/advertisements.html";
interface Extraction {
  advertisement: string; documents: { url: string; sha256: string; role: string }[];
  applicationOpensOn: string | null; originalClosesOn: string; coachExtendedClosesOn: string;
  cutoffLocalTime: string; ageAsOn: string;
  posts: { code: string; title: string; vacancies: number; payLevel: number }[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/meghalaya-03-2026.json", import.meta.url), "utf8")) as Extraction;

function officialPdf(href: string): string {
  const url = new URL(href, MEGHALAYA_INDEX);
  if (url.origin !== "https://mpsc.meghalaya.gov.in" || !/^\/(?:advt|notify)\/[^/]+\.pdf$/i.test(url.pathname) || url.search || url.hash) throw new Error("Meghalaya advertisement document outside official PDF folders");
  return url.href;
}

export function parseMeghalayaIndex(html: string): string[] {
  const body = /<table\b[^>]*id="table"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1];
  if (!body) throw new Error("Meghalaya advertisement table changed");
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const related = rows.filter((row) => {
    const title = stripTags(row).replace(/\s+/g, " ");
    return /(?:Advertisement No\.\s*0?3\/2026|^No\.\s*0?3\/2026\b)/i.test(title)
      || /(?:Fishery Officer|Junior Football Coach)/i.test(title) && /2026/.test(title);
  });
  if (!related.length) throw new Error("Meghalaya advertisement 03/2026 missing");
  const urls = related.map((row) => {
    const hrefs = [...row.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)].map((match) => match[1]);
    const documents = hrefs.filter((href) => /\.pdf(?:$|[?#])/i.test(href));
    if (documents.length !== 1) throw new Error("Meghalaya 03/2026 row has ambiguous document links");
    return officialPdf(documents[0]);
  });
  if (urls.length !== new Set(urls).size) throw new Error("Meghalaya 03/2026 duplicate document rows need review");
  const expected = extraction.documents.map((document) => document.url).sort();
  if (JSON.stringify(urls.sort()) !== JSON.stringify(expected)) throw new Error("Meghalaya 03/2026 document set changed; review amendments");
  return urls;
}

export const meghalayaPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Meghalaya scanned PDF evidence fetch required");
  const index = await fetchText(MEGHALAYA_INDEX, { accept: "text/html" });
  parseMeghalayaIndex(index.text);
  const evidence = [index.evidence];
  const sources: OpportunityCycle["sources"] = [{ ...evidenceSource(source, index.evidence, "MPSC advertisement and amendment table", "HTML", "English"), lastValidatedAt: null }];
  for (const document of extraction.documents) {
    officialPdf(document.url);
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || hash !== document.sha256 || pdf.evidence.sha256 !== hash || pdf.evidence.url !== document.url) throw new Error(`Meghalaya ${document.role} PDF changed; old dates and eligibility withheld`);
    evidence.push(pdf.evidence);
    sources.push({ ...evidenceSource(source, pdf.evidence, `Advertisement 03/2026: ${document.role}`, "scanned PDF", "English"), lastValidatedAt: null });
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const originalUrl = extraction.documents[0].url;
  const cities = ["Shillong", "Tura", "Jowai", "Williamnagar", "Nongstoin"];
  const cycles = extraction.posts.map((post) => {
    const coach = post.code === "02";
    const closesOn = coach ? extraction.coachExtendedClosesOn : extraction.originalClosesOn;
    return makeCycle({
      id: `meghalaya-psc-2026-03-post-${post.code}`, sourceId: source.id,
      title: post.title, cycleLabel: `Advertisement ${extraction.advertisement} · Post ${post.code}`,
      authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-ML"],
      scopeLabel: "Meghalaya government recruitment; state residence matters for specified benefits and relaxations",
      outcome: `${post.title} appointment (${post.vacancies} posts)`,
      status: today > closesOn ? "closed" : "uncertain",
      statusNote: coach ? "Post 02 extension to 30 June is in addendum; founder verification pending." : "Original deadline passed. Addendum extension scope for Post 01 needs founder verification.",
      applicationWindow: { opensOn: extraction.applicationOpensOn, closesOn, cutoffLocalTime: extraction.cutoffLocalTime, officialTimeZone: "Asia/Kolkata", precision: "minute", note: coach ? "24 June addendum, page 1, extends online applications to 30 June 2026 at 17:00. Notice does not print timezone; Asia/Kolkata is local Shillong interpretation." : "Original advertisement, pages 1 and 4: 25 June 2026 at 17:00. Addendum concerns Post 02; whether extension covered Post 01 is unclear. Notice does not print timezone; Asia/Kolkata is local Shillong interpretation." },
      qualifications: coach
        ? "Graduate with recognized one-year sports-coaching diploma, or 10+2 with recognized sports-coaching diploma for medal achievers. Addendum adds four-year/eight-semester BSc Sports Coaching from National Sports University, Manipur, in the concerned discipline; medal winners receive special preference (original pages 1–2; addendum page 1)."
        : "B.F.Sc. or B.Sc. in Pisciculture/Fishery Science from a recognized university (original page 1).",
      citizenshipRule: "Applications invited from citizens of India (original advertisement page 1); foreign citizens do not match this published criterion.",
      residenceRule: "No blanket Meghalaya residence condition is stated for application. SC/ST permanent residents of Meghalaya receive a half-rate fee; age relaxations require a Meghalaya-issued SC/ST certificate (original pages 2–3; Fishery corrigendum page 1).",
      selectionStages: coach
        ? ["Screening test: General English 50 marks, General Knowledge and Current Affairs 100, Reasoning 50; labelled Class XII Level (original page 5).", "Personal interview after passing screening test; original documents required (page 5)."]
        : ["Screening test: General English 50 marks, General Knowledge and Current Affairs 50, Aptitude and Reasoning 50, fishery domain 150 (original page 5).", "Personal interview after passing screening test; original documents required (page 5)."],
      fee: "₹350; half-rate for SC/ST permanent residents of Meghalaya; persons with benchmark disabilities exempt with certificate (original page 3).",
      salary: `Revised pay structure Level ${post.payLevel} (original page 1).`,
      rules: { complete: false, asOn: extraction.ageAsOn,
        nationality: { allowed: ["IN"], evidence: "Advertisement 03/2026, page 1: applications are invited from citizens of India." },
        languages: [{ language: "en", requirement: coach ? "General English, 50-mark screening subject within test labelled Class XII Level; no CEFR level stated." : "General English, 50-mark screening subject; no formal proficiency level stated.", stage: "selection", evidence: "Advertisement 03/2026, page 5, method of selection for post codes 01 and 02.", sourceUrl: originalUrl }],
        manualChecks: [
          { stage: "apply", text: coach ? "Verify age 18–32 on 1 January 2026, SC/ST and athlete relaxations, and accepted coaching qualification including added BSc route (original pages 1–2; addendum page 1)." : "Verify amended age 18–32 on 1 January 2026, applicable Meghalaya-issued SC/ST certificate, and fishery degree (original pages 1–2; corrigendum page 1)." },
          { stage: "selection", text: "Verify screening result and original documents before interview (original page 5)." },
        ],
      },
      venues: cities.map((city) => cityVenue(`${city} examination centre (city only; final allocation may change)`, city, "IN", "IN-ML")),
      sources, applicationUrl: "https://rpa.meghalaya.gov.in/rpaonline",
      changes: coach
        ? [{ at: "2026-06-24", kind: "eligibility", summary: "Addendum adds BSc Sports Coaching qualification route." }, { at: "2026-06-24", kind: "extended", summary: "Addendum extends online applications to 30 June 2026 at 17:00." }]
        : [{ at: "2026-06-03", kind: "eligibility", summary: "Corrigendum changes Fishery Officer age range to 18–32 years with specified SC/ST relaxation." }],
    });
  });
  return { cycles, evidence, warnings: ["Two post-code drafts only; other Meghalaya advertisements, departments and local authorities remain gaps.", "The 24 June addendum is written for Junior Football Coach; whether its application extension also applied to Fishery Officer is ambiguous. Both dates have passed; founder review must resolve historical cutoff before publication.", "Scanned transcripts, age exceptions, degree alternatives and English test interpretation require founder review."] };
};
