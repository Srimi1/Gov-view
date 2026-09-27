/** Goa Staff Selection Commission: group amendments; bind draft fields to all evidence. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import { civilDateIn, daysBetween } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { dayFirstDate, decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

export const GSSC_INDEX = "https://gssc.goa.gov.in/?page_id=1079";
export const GSSC_INSTRUCTIONS = "https://gssc.goa.gov.in/?page_id=1152";
interface Notice { number: string; title: string; url: string; releasedOn: string; kind: "advertisement" | "brief" | "amendment" }
interface Extraction {
  advertisement: string; reviewStatus: "pending"; documents: { url: string; sha256: string; role: string }[];
  opensOn: string; closesOn: string; openingDateNote: string; cycleIdentityEvidence: string; conflicts: string[]; amendmentNotes: string[];
  applicationPortal: { indexUrl: string; posts: { ordinal: number; name: string; url: string }[] };
  posts: (Pick<OpportunityCycle, "title" | "qualifications" | "residenceRule" | "fee" | "salary" | "selectionStages" | "rules"> & { ordinal: number })[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/gssc-2026-3.json", import.meta.url), "utf8")) as Extraction;

function documentUrl(href: string): string {
  const url = new URL(decodeEntities(href), GSSC_INDEX);
  if (url.origin !== "https://gssc.goa.gov.in" || url.username || url.password || !/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+\.pdf$/i.test(url.pathname) || url.search || url.hash) throw new Error("GSSC document is outside the official PDF archive");
  return url.href;
}

function contentLinks(html: string) {
  const content = /<div class="entry-content">([\s\S]*?)<!--\s*\.entry-content\s*-->/i.exec(html)?.[1];
  if (!content) throw new Error("GSSC content section changed");
  return [...content.matchAll(/<a\b[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((link) => ({ href: link[1], title: stripTags(link[2]).replace(/\s+/g, " ") }));
}

export function parseGsscIndex(html: string) {
  const notices = new Map<string, Notice>();
  const warnings: string[] = [];
  for (const link of contentLinks(html)) {
    if (!/advertisement/i.test(link.title)) continue;
    const identity = /Advertisement No\.?\s*(\d+)\s+of\s+Year\s+(\d{4})/i.exec(link.title);
    if (!identity) {
      if (/^Advertisement dated \d{2}\.\d{2}\.202[34]$/i.test(link.title)) { warnings.push(`Historical unnumbered notice requires manual cycle identity: ${link.title}`); continue; }
      throw new Error(`GSSC notice identity needs review: ${link.title}`);
    }
    const releasedOn = dayFirstDate(link.title);
    if (!releasedOn) throw new Error(`GSSC release date missing: ${link.title}`);
    const prefix = link.title.slice(0, identity.index).trim();
    const kind = prefix === "" ? "advertisement" : /^Brief$/i.test(prefix) ? "brief" : /^(?:Supplementary Note to|Addendum to|Corrigendum to)$/i.test(prefix) ? "amendment" : null;
    if (!kind) throw new Error(`GSSC notice type needs review: ${link.title}`);
    const notice: Notice = { number: `${Number(identity[1])}/${identity[2]}`, title: link.title, url: documentUrl(link.href), releasedOn, kind };
    const old = notices.get(notice.url);
    if (old && JSON.stringify(old) !== JSON.stringify(notice)) throw new Error("GSSC document has conflicting cycle associations");
    notices.set(notice.url, notice);
  }
  if (!notices.size) throw new Error("No GSSC advertisements parsed; preserve previous records");
  return { notices: [...notices.values()], warnings };
}

export function parseGsscInstructions(html: string): string {
  const matches = contentLinks(html).filter((link) => link.title === "Instructions to the Candidates");
  const urls = [...new Set(matches.map((link) => documentUrl(link.href)))];
  if (urls.length !== 1) throw new Error("GSSC general instructions missing or ambiguous");
  return urls[0];
}

/** Bind each post to its own official application page; portal count conflicts stay in review. */
export function verifyGsscApplicationPortal(index: string, details: Map<number, string>): void {
  const rows = [...index.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  if (extraction.applicationPortal.posts.length !== extraction.posts.length) throw new Error("GSSC CBES post manifest incomplete");
  for (const post of extraction.applicationPortal.posts) {
    const href = new URL(post.url).pathname + new URL(post.url).search;
    const matching = rows.filter((row) => row.includes(`href="${href}"`) && stripTags(row).includes(post.name));
    if (matching.length !== 1 || !stripTags(matching[0]).includes("02-10-2026")) {
      throw new Error(`GSSC CBES ${post.name} index row changed; review required`);
    }
    const body = details.get(post.ordinal);
    const text = stripTags(body ?? "").replace(/\s+/g, " ");
    const essential = text.split("Essential :")[1]?.split("Desirable")[0] ?? "";
    if (!text.includes("ADVERTISEMENT NO.3 OF YEAR 2026") ||
        !text.includes("Department Name: GOA STAFF SELECTION COMMISSION") ||
        !text.includes(`Post Name : ${post.name}`) ||
        !/Start Date of Application \* 11-09-2026/.test(text) ||
        !/Last Date of Application \* 02-10-2026/.test(text) ||
        !/Knowledge of Konkani/.test(essential)) {
      throw new Error(`GSSC CBES ${post.name} detail changed; review required`);
    }
    if (post.ordinal === 2 && !/111 Post \(resvd for : General\)/.test(text)) {
      throw new Error("GSSC CBES LDC count changed; reconcile portal and supplementary notice");
    }
  }
}

export const gssc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("GSSC needs exact PDF bytes to verify extracted fields");
  const index = await fetchText(GSSC_INDEX, { accept: "text/html" });
  const instructions = await fetchText(GSSC_INSTRUCTIONS, { accept: "text/html" });
  const instructionUrl = parseGsscInstructions(instructions.text);
  const parsed = parseGsscIndex(index.text);
  const today = civilDateIn("Asia/Kolkata", now);
  const recentNumbers = new Set(parsed.notices.filter((notice) => daysBetween(notice.releasedOn, today) >= 0 && daysBetween(notice.releasedOn, today) <= 180).map((notice) => notice.number));
  const warnings = [...parsed.warnings, "Draft connector: advertisement groups with activity in the last 180 days only. Only document-bound post extractions can become draft cycles; other groups require review. No complete Goa coverage claim."];
  const evidence = [index.evidence, instructions.evidence];
  const cycles: OpportunityCycle[] = [];
  for (const number of recentNumbers) {
    const notices = parsed.notices.filter((notice) => notice.number === number);
    if (number !== extraction.advertisement) { warnings.push(`${number}: no reviewed draft extraction available; post identities and fields withheld`); continue; }
    if (notices.filter((notice) => notice.kind === "advertisement").length !== 1) throw new Error(`${number}: original advertisement missing or ambiguous; preserve previous records`);
    const observedUrls = [...new Set([...notices.map((notice) => notice.url), instructionUrl])].sort();
    const expectedUrls = extraction.documents.map((document) => document.url).sort();
    if (JSON.stringify(observedUrls) !== JSON.stringify(expectedUrls)) throw new Error(`${number}: official document set changed; withhold old extraction and review amendments`);
    const sources = [index, instructions].map((document) => ({ ...evidenceSource(source, document.evidence, document === index ? "Advertisement and amendment index" : "Current general instructions index", "HTML", "English"), lastValidatedAt: null }));
    for (const document of extraction.documents) {
      // Revalidate every manifest URL against the same official allowlist.
      const pdf = await fetchBytes(documentUrl(document.url), { accept: "application/pdf" });
      evidence.push(pdf.evidence);
      const hash = createHash("sha256").update(pdf.bytes).digest("hex");
      if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || hash !== document.sha256 || pdf.evidence.sha256 !== hash || pdf.evidence.url !== document.url) throw new Error(`${number}: ${document.role} PDF changed; withhold old dates and eligibility extraction`);
      sources.push({ ...evidenceSource(source, pdf.evidence, `${number}: ${document.role}`, "PDF", "English"), lastValidatedAt: null });
    }
    const portalIndex = await fetchText(extraction.applicationPortal.indexUrl, { accept: "text/html" });
    if (portalIndex.evidence.url !== extraction.applicationPortal.indexUrl) throw new Error("GSSC CBES index redirected; review required");
    const portalDetails = new Map<number, string>();
    const portalEvidence = new Map<number, typeof portalIndex.evidence>();
    evidence.push(portalIndex.evidence);
    for (const post of extraction.applicationPortal.posts) {
      const page = await fetchText(post.url, { accept: "text/html" });
      if (page.evidence.url !== post.url) throw new Error(`GSSC CBES ${post.name} page redirected; review required`);
      portalDetails.set(post.ordinal, page.text);
      portalEvidence.set(post.ordinal, page.evidence);
      evidence.push(page.evidence);
    }
    verifyGsscApplicationPortal(portalIndex.text, portalDetails);
    warnings.push(...extraction.conflicts, ...extraction.amendmentNotes, extraction.cycleIdentityEvidence);
    for (const post of extraction.posts) {
      const portalPost = extraction.applicationPortal.posts.find((item) => item.ordinal === post.ordinal);
      const detailEvidence = portalEvidence.get(post.ordinal);
      if (!portalPost || !detailEvidence) throw new Error("GSSC CBES post mapping incomplete");
      cycles.push(makeCycle({
        id: `gssc-${number.split("/")[1]}-${number.split("/")[0]}-post-${post.ordinal}`, sourceId: source.id,
        title: post.title, cycleLabel: `${number} · Post ${post.ordinal}`, authority: source.authority,
        pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-GA"],
        scopeLabel: "Goa government recruitment; published residence documentation applies separately",
        status: "uncertain", statusNote: "Draft post and amended selection rules extracted. CBES portal dates verified, but LDC vacancy count conflicts with the later GSSC supplement. PwD fee and international eligibility also need founder review.",
        outcome: `Appointment as ${post.title}; department allocation is determined by the Commission`,
        qualifications: post.qualifications, fee: post.fee, salary: post.salary, rules: post.rules,
        residenceRule: post.residenceRule,
        citizenshipRule: "Nationality and foreign-citizen eligibility are not established by the retained notice and instructions. Verify applicable recruitment/service rules; the Goa residence requirement is not a nationality rule.",
        selectionStages: post.selectionStages,
        applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: null, officialTimeZone: null, precision: "date", note: extraction.openingDateNote },
        sources: [
          ...sources,
          { ...evidenceSource(source, portalIndex.evidence, "Government of Goa CBES public advertisement index", "HTML", "English"), lastValidatedAt: null },
          { ...evidenceSource(source, detailEvidence, `CBES application details: ${portalPost.name}`, "HTML", "English"), lastValidatedAt: null },
        ], applicationUrl: portalPost.url,
      }));
    }
  }
  if (!cycles.length) throw new Error("No GSSC post extractions matched current evidence; preserve previous records");
  return { cycles, evidence, warnings };
};
