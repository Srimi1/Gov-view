/** Goa PSC advertisement 09/2026: seven post applications, retained for founder review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Post {
  key: string; title: string; mode: "direct" | "transfer"; vacancies: number;
  pay: string; qualifications: string; language: string;
}
interface Extraction {
  advertisementsUrl: string; advertisementUrl: string; advertisementSha256: string;
  instructionsUrl: string; instructionsSha256: string; applicationUrl: string;
  publishedOn: string; directClosesOn: string; transferClosesOn: string; posts: Post[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/goa-psc-09-2026.json", import.meta.url), "utf8")) as Extraction;
export const GOA_PSC_ADVERTISEMENTS = extraction.advertisementsUrl;

/** AJAX URL is published in the public page and explicitly allowed by its robots.txt. */
export function goaTableUrl(page: string): string {
  if (!/Advertisements\s*[–-]\s*Goa Public Service Commission/i.test(stripTags(page).slice(0, 5000))) throw new Error("Goa PSC advertisement page identity changed");
  if (!page.includes(extraction.instructionsUrl)) throw new Error("Goa PSC candidate instructions link changed");
  const matches = [...page.matchAll(/"data_request_url":"([^"\n]+)"/g)];
  if (matches.length !== 1) throw new Error("Goa PSC public table URL missing or duplicated");
  const raw = JSON.parse(`"${matches[0][1]}"`) as string;
  const url = new URL(raw);
  if (url.origin !== "https://gpsc.goa.gov.in" || url.pathname !== "/wp-admin/admin-ajax.php" ||
      url.searchParams.get("action") !== "wp_ajax_ninja_tables_public_action" ||
      url.searchParams.get("table_id") !== "5926" ||
      url.searchParams.get("target_action") !== "get-all-data" ||
      !url.searchParams.get("ninja_table_public_nonce")) throw new Error("Goa PSC public table endpoint changed");
  return url.href;
}

export function checkGoaTable(json: string): void {
  const rows: unknown = JSON.parse(json);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Goa PSC advertisement table empty or changed");
  const values = rows.map((row) => (row as { value?: Record<string, unknown> })?.value);
  if (values.some((value) => !value || typeof value.description !== "string" || typeof value.advt_no !== "string" || typeof value.year !== "string" || typeof value.action !== "string")) throw new Error("Goa PSC advertisement table schema changed");
  const candidates = values.filter((value) => value?.advt_no === "09" && value?.year === "2026");
  if (candidates.length !== 1 || !/^ADVERTISEMENT NO\.\s*09 YEAR 2026$/i.test(String(candidates[0]?.description).trim())) throw new Error("Goa PSC 09/2026 row missing, duplicated or amended");
  const action = String(candidates[0]?.action);
  const links = [...action.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  if (links.length !== 1 || links[0] !== extraction.advertisementUrl) throw new Error("Goa PSC 09/2026 PDF link changed");
  if (values.some((value) => value !== candidates[0] && value?.year === "2026" && /(?:advt|advertisement|corrigendum|extension|notice)/i.test(String(value.description)) && /(?:\b09\b.*\b2026\b|\b2026\b.*\b09\b)/.test(String(value.description)))) throw new Error("Goa PSC 09/2026 may have a later notice; review required");
}

async function exactPdf(fetchBytes: NonNullable<Parameters<Connector>[0]["fetchBytes"]>, url: string, expectedHash: string): Promise<Evidence> {
  const response = await fetchBytes(url, { accept: "application/pdf" });
  const hash = createHash("sha256").update(response.bytes).digest("hex");
  if (response.bytes.subarray(0, 5).toString() !== "%PDF-" || response.evidence.url !== url || response.evidence.sha256 !== hash || hash !== expectedHash) throw new Error(`Goa PSC PDF changed at ${url}; extracted fields withheld`);
  return response.evidence;
}

export const goaPsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("Goa PSC exact official PDF bytes required");
  const page = await fetchText(extraction.advertisementsUrl, { accept: "text/html" });
  if (page.evidence.url !== extraction.advertisementsUrl) throw new Error("Goa PSC advertisement page redirected");
  const tableUrl = goaTableUrl(page.text);
  const table = await fetchText(tableUrl, { accept: "application/json" });
  if (table.evidence.url !== tableUrl) throw new Error("Goa PSC advertisement table redirected");
  checkGoaTable(table.text);
  const ad = await exactPdf(fetchBytes, extraction.advertisementUrl, extraction.advertisementSha256);
  const instructions = await exactPdf(fetchBytes, extraction.instructionsUrl, extraction.instructionsSha256);
  const today = civilDateIn("Asia/Kolkata", now);
  const cycles: OpportunityCycle[] = extraction.posts.map((post) => {
    const direct = post.mode === "direct";
    const closesOn = direct ? extraction.directClosesOn : extraction.transferClosesOn;
    return makeCycle({
      id: `goa-psc-09-2026-${post.key}`, sourceId: source.id,
      title: post.title, cycleLabel: `Goa PSC advertisement 09/2026 — ${post.mode === "transfer" ? "transfer on deputation" : "direct recruitment"}`,
      authority: source.authority, pathway: "recruitment", jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-GA"],
      scopeLabel: `${post.mode === "transfer" ? "Transfer on deputation" : "Direct recruitment"} to Goa government institution; separate application required for each post`,
      outcome: `${post.vacancies} ${post.title} ${post.vacancies === 1 ? "post" : "posts"} (one application cycle)`,
      status: today > closesOn ? "closed" : "uncertain",
      statusNote: `${today > closesOn ? "Published application date passed" : "Application cutoff clock time is unreported"}; advertisement and general instructions require founder review.`,
      applicationWindow: { opensOn: null, closesOn, cutoffLocalTime: null, officialTimeZone: "Asia/Kolkata", precision: "date", note: `Advertisement page 1 sets ${direct ? "25 September 2026 for direct recruitment" : "25 October 2026 for transfer on deputation"}. Publication on 11 September is not used as opening date. No cutoff clock time or timezone label is printed; Asia/Kolkata is Goa local time.` },
      qualifications: post.qualifications,
      citizenshipRule: "Advertisement and candidate instructions state no national citizenship test. Foreign-citizen permission to apply, enter selection or take appointment needs authority confirmation. Transfer posts separately require current qualifying government service.",
      residenceRule: "No general Goa domicile condition is printed for application; some fee reductions require Goa-issued category certificates. Verify any appointment-specific residence rule with authority.",
      selectionStages: ["Eligibility and document scrutiny", "Shortlisting; Commission may conduct screening test", "Interview at Commission headquarters or location stated in call letter"],
      fee: "General instructions list ₹1,000 general fee, ₹500 for listed eligible categories and no fee for PwD; confirm category evidence and deputation applicability before relying on an amount.",
      salary: post.pay,
      rules: { complete: false, asOn: closesOn, manualChecks: [
        { stage: "apply", text: `Verify ${post.mode === "transfer" ? "current government service and analogous-post/pay-scale conditions" : "all post-specific degrees, experience and age/relaxation"} from advertisement 09/2026, pages 2–3. Separate online application and timely fee payment are required.` },
        { stage: "apply", text: "Verify foreign-citizen permission independently; neither retained official PDF states a nationality rule. Do not infer eligibility from education or residence alone." },
        { stage: "selection", text: direct ? `Verify ${post.language} General instructions page 10 define at least working knowledge where Konkani is essential; no CEFR equivalence is stated.` : "No post-specific language test is printed for this transfer post; confirm selection conditions with authority." },
        { stage: "outcome", text: "Confirm appointment eligibility, accepted qualifications, documents and final institutional conditions; an interview call does not establish eligibility." },
      ] },
      venues: [{ kind: "unknown", name: "Interview site to be given in individual call letter; office address is not treated as assigned venue" }],
      sources: [
        evidenceSource(source, page.evidence, "Goa PSC advertisement register", "HTML", "English"),
        evidenceSource(source, table.evidence, "Goa PSC public advertisement rows", "JSON", "English"),
        evidenceSource(source, ad, "Goa PSC advertisement 09/2026", "PDF", "English"),
        evidenceSource(source, instructions, "Goa PSC general candidate instructions", "PDF", "English"),
      ],
      applicationUrl: extraction.applicationUrl,
    });
  });
  return { cycles, evidence: [page.evidence, table.evidence, ad, instructions], complete: false, warnings: [
    "Advertisement 09/2026 contains seven separate post applications: three transfer on deputation and four direct recruitment. Vacancies do not multiply cycles.",
    "Direct-recruitment date is 25 September; transfer-on-deputation date is 25 October. Neither cutoff clock time nor opening date is printed.",
    "No national citizenship rule is printed. Foreign-citizen ability to apply, enter selection and obtain appointment remains unresolved; deputation also requires qualifying government service.",
    "Direct posts require Konkani at least at working-knowledge level under general instructions; professional-college relaxation is conditional, not automatic. No CEFR level is inferred.",
    "Other Goa PSC advertisements, amendments, departments and local sources remain coverage gaps. Founder review is required before publication.",
  ] };
};
