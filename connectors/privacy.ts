import type { OpportunityCycle } from "../lib/opportunities.ts";

const EXCLUDED = "Candidate-identifying result/merit list excluded from collection";
const listPattern = /\b(?:merit|selection|rank|shortlist(?:ed)?|qualified|selected)\s+(?:list|register|candidates?)\b|\b(?:list|register)\s+of\s+(?:selected|shortlisted|qualified|merit)\s+candidates?\b|\bprovisional\s+allotment\s+list\b/i;
const resultPattern = /\b(?:final\s+)?results?\b/i;
const identifierPattern = /\b(?:roll\s*(?:no\.?|number)|registration\s*(?:no\.?|number)|application\s*(?:no\.?|id|number)|candidate\s*name)\b|\b(?:candidateName|rollNumber|registrationNumber)\b/i;

function words(value: string): string {
  try { return decodeURIComponent(value).replace(/[-_+]+/g, " "); }
  catch { return value.replace(/[-_+]+/g, " "); }
}

/** Reject obvious candidate-list links before fetching potentially personal data. */
export function assertAllowedSourceUrl(url: string): void {
  const target = new URL(url);
  if (listPattern.test(words(target.pathname + target.search))) throw new Error(EXCLUDED);
}

/** Check document heading plus identifier columns; ignore incidental navigation links. */
export function assertNoCandidateListText(text: string, contentType: string, url: string): void {
  assertAllowedSourceUrl(url);
  const sample = text.slice(0, 120_000);
  if (/html/i.test(contentType)) {
    for (const row of sample.matchAll(/<tr\b[^>]*>([\s\S]{0,2000}?)<\/tr>/gi)) {
      const cells = row[1].replace(/<[^>]*>/g, " ");
      if (/candidate\s*name/i.test(cells) && /roll\s*(?:no\.?|number)/i.test(cells)) throw new Error(EXCLUDED);
    }
  }
  if (/json/i.test(contentType) && /["']candidateName["']\s*:/.test(sample) && /["']rollNumber["']\s*:/.test(sample)) throw new Error(EXCLUDED);
  const heading = /<(?:title|h1|h2)\b[^>]*>([\s\S]{0,500}?)<\/(?:title|h1|h2)>/i.exec(sample)?.[1]?.replace(/<[^>]*>/g, " ") ?? "";
  if (listPattern.test(words(heading))) throw new Error(EXCLUDED);
  const pathname = words(new URL(url).pathname);
  const resultContext = resultPattern.test(heading) || resultPattern.test(pathname);
  if (!resultContext) return;
  if (/html|json|text|csv/i.test(contentType) && identifierPattern.test(sample)) throw new Error(EXCLUDED);
}

/** Final guard before a connector's candidates reach review or publication. */
export function assertNoCandidateListCycle(cycle: OpportunityCycle): void {
  const labels = [cycle.title, cycle.programme, ...cycle.sources.map((source) => source.title)];
  if (labels.some((label) => listPattern.test(words(label)))) throw new Error(EXCLUDED);
  for (const source of cycle.sources) {
    if (source.url) assertAllowedSourceUrl(source.url);
    if (source.fetchedUrl) assertAllowedSourceUrl(source.fetchedUrl);
  }
  if (cycle.applicationUrl) assertAllowedSourceUrl(cycle.applicationUrl);
}
