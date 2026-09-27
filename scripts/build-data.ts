#!/usr/bin/env node
/**
 * Turns collected records into browseable shards, and reviewer-approved
 * revisions into applicant exports. It runs before `next build`; browser
 * fetches shards on demand.
 *
 *   public/data/index.json            counts per country, build time
 *   public/data/list/<CC>.json        compact records for list, map and filters
 *   public/data/detail/<CC>-<n>.json  full records, a few hundred per file
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EligibilityRules } from "../lib/eligibility/types.ts";
import type { CycleSummary, OpportunityCycle } from "../lib/opportunities.ts";
import { selectPublicRecords } from "../lib/publication.server.ts";
import { approvedFeedEntries, renderAtom, renderRss, type FeedEntry } from "../lib/feed.ts";
import jurisdictionInventory from "../data/reference/jurisdictions.json" with { type: "json" };

/** Rules without their quotes: the list only needs the verdict; the detail view shows the evidence. */
function leanRules(rules: EligibilityRules | null): EligibilityRules | null {
  if (!rules) return null;
  const strip = <T extends { evidence: string } | undefined>(rule: T): T => (rule ? { ...rule, evidence: "" } : rule);
  return {
    ...rules,
    age: strip(rules.age),
    education: strip(rules.education),
    nationality: strip(rules.nationality),
    residence: strip(rules.residence),
    attempts: strip(rules.attempts),
    experience: strip(rules.experience),
    // Language evaluation requires the evidence and source, even in list summaries.
    languages: rules.languages,
    manualChecks: rules.manualChecks?.map((check) => ({ ...check, text: "" })),
  };
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "data/published/cycles");
const APPROVED_SOURCE = join(ROOT, "data/approved/cycles");
const OUT = join(ROOT, "public/data");
const SHARD_SIZE = 300;
const LIST_SHARD_SIZE = 300;

function listPriority(a: CycleSummary, b: CycleSummary): number {
  const rank = (record: CycleSummary) => record.status === "open" || record.status === "extended" ? 0 : record.status === "upcoming" ? 1 : 2;
  return rank(a) - rank(b) || (a.applicationWindow.closesOn ?? "9999-12-31").localeCompare(b.applicationWindow.closesOn ?? "9999-12-31") || a.id.localeCompare(b.id);
}

function authorityFileName(authority: string): string {
  const slug = authority.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || "authority";
  const hash = createHash("sha256").update(authority).digest("hex").slice(0, 8);
  return `${slug}-${hash}`;
}

function writeFeeds(kind: "country" | "authority", groups: Map<string, FeedEntry[]>, generatedAt: string, siteUrl: string | undefined): { key: string; rss: string; atom: string }[] {
  const folder = join(OUT, "feeds", kind);
  mkdirSync(folder, { recursive: true });
  const manifest: { key: string; rss: string; atom: string }[] = [];
  for (const [key, entries] of groups) {
    if (!entries.length) continue;
    const filename = kind === "country" ? key : authorityFileName(key);
    const title = `GOV View: ${key} approved opportunity changes`;
    const channelUrl = siteUrl ? `${siteUrl}/` : entries[0].url;
    const rss = `/data/feeds/${kind}/${filename}.rss.xml`;
    const atom = `/data/feeds/${kind}/${filename}.atom.xml`;
    writeFileSync(join(folder, `${filename}.rss.xml`), renderRss(title, entries, channelUrl));
    const feedId = siteUrl ? `${siteUrl}${atom}` : `${entries[0].url}#govview-${kind}-${encodeURIComponent(key)}`;
    writeFileSync(join(folder, `${filename}.atom.xml`), renderAtom(title, feedId, entries, channelUrl, new Date(generatedAt)));
    manifest.push({ key, rss, atom });
  }
  return manifest.sort((a, b) => a.key.localeCompare(b.key));
}

export function summarize(item: OpportunityCycle, shard: number): CycleSummary {
  return {
    id: item.id,
    fixture: item.fixture,
    title: item.title,
    authority: item.authority,
    programme: item.programme,
    pathway: item.pathway,
    ...(item.appointmentType ? { appointmentType: item.appointmentType } : {}),
    status: item.status,
    jurisdictionCode: item.jurisdictionCode,
    jurisdictionName: item.jurisdictionName,
    ...(item.subdivisionCodes?.length ? { subdivisionCodes: item.subdivisionCodes } : {}),
    scopeLabel: item.scopeLabel,
    outcome: item.outcome,
    applicationWindow: item.applicationWindow,
    publicationApproved: item.publicationApproved === true,
    reviewPending: item.reviewPending === true,
    rules: item.publicationApproved ? leanRules(item.rules) : null,
    // Only pinned venues matter for the map; names are shortened.
    venues: item.venues.filter((venue) => venue.kind === "published").map((venue) => (venue.kind === "published" ? { ...venue, name: "" } : venue)),
    // The two latest changes are enough for "recently updated".
    changes: item.changes.slice(-2).map(({ at, kind }) => ({ at, kind, summary: "" })),
    shard,
  };
}

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "list"), { recursive: true });
  mkdirSync(join(OUT, "detail"), { recursive: true });
  const generatedAt = new Date().toISOString();
  const countries: { code: string; count: number; approvedCount: number; listShards: number }[] = [];
  const ids: Record<string, { code: string; shard: number }> = {};
  const aliases: Record<string, string[]> = {};
  const approvedPageIds: string[] = [];
  const countryFeeds = new Map<string, FeedEntry[]>();
  const authorityFeeds = new Map<string, FeedEntry[]>();
  const revisionHash = createHash("sha256");
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "");
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (origin ? `${origin}${basePath}` : process.env.CF_PAGES_URL);
  const siteUrl = rawSiteUrl && /^https:\/\//i.test(rawSiteUrl) ? rawSiteUrl.replace(/\/$/, "") : undefined;
  const files = [...new Set([SOURCE, APPROVED_SOURCE].flatMap((directory) =>
    existsSync(directory) ? readdirSync(directory).filter((file) => /^[A-Z0-9-]{2,12}\.json$/.test(file)) : [],
  ))].sort();
  for (const file of files) {
    const code = file.slice(0, -5);
    const currentBytes = existsSync(join(SOURCE, file)) ? readFileSync(join(SOURCE, file)) : Buffer.from("[]");
    const snapshotBytes = existsSync(join(APPROVED_SOURCE, file)) ? readFileSync(join(APPROVED_SOURCE, file)) : Buffer.from("[]");
    revisionHash.update(`current:${file}`).update(currentBytes).update(`approved:${file}`).update(snapshotBytes);
    const current = JSON.parse(currentBytes.toString("utf8")) as OpportunityCycle[];
    const snapshots = JSON.parse(snapshotBytes.toString("utf8")) as OpportunityCycle[];
    if ([...current, ...snapshots].some((record) => record.jurisdictionCode !== code)) throw new Error(`Country mismatch in ${file}`);
    const records = selectPublicRecords(current, snapshots);
    if (!records.length) continue;
    const approvedCount = records.filter((record) => record.publicationApproved).length;
    const summaries: CycleSummary[] = [];
    for (let start = 0, shard = 0; start < records.length; start += SHARD_SIZE, shard += 1) {
      const chunk = records.slice(start, start + SHARD_SIZE);
      writeFileSync(join(OUT, "detail", `${code}-${shard}.json`), JSON.stringify(chunk));
      for (const record of chunk) {
        if (ids[record.id]) throw new Error(`Duplicate cycle id: ${record.id}`);
        ids[record.id] = { code, shard };
        summaries.push(summarize(record, shard));
        for (const alias of record.legacyIds ?? []) {
          if (alias === record.id || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(alias)) continue;
          (aliases[alias] ??= []).push(record.id);
        }
        if (record.publicationApproved) {
          approvedPageIds.push(record.id);
          for (const entry of approvedFeedEntries(record, siteUrl)) {
            (countryFeeds.get(code) ?? (countryFeeds.set(code, []), countryFeeds.get(code)!)).push(entry);
            (authorityFeeds.get(record.authority) ?? (authorityFeeds.set(record.authority, []), authorityFeeds.get(record.authority)!)).push(entry);
          }
        }
      }
    }
    summaries.sort(listPriority);
    for (let start = 0, shard = 0; start < summaries.length; start += LIST_SHARD_SIZE, shard += 1) {
      writeFileSync(join(OUT, "list", `${code}-${shard}.json`), JSON.stringify(summaries.slice(start, start + LIST_SHARD_SIZE)));
    }
    countries.push({ code, count: records.length, approvedCount, listShards: Math.ceil(summaries.length / LIST_SHARD_SIZE) });
  }
  const total = countries.reduce((sum, country) => sum + country.count, 0);
  const approvedTotal = countries.reduce((sum, country) => sum + country.approvedCount, 0);
  const feeds = {
    countries: writeFeeds("country", countryFeeds, generatedAt, siteUrl),
    authorities: writeFeeds("authority", authorityFeeds, generatedAt, siteUrl),
  };
  for (const [alias, idsForAlias] of Object.entries(aliases)) {
    if (ids[alias]) delete aliases[alias]; // A current canonical ID always wins.
    else aliases[alias] = [...new Set(idsForAlias)].sort();
  }
  writeFileSync(join(OUT, "id-index.json"), JSON.stringify({ ids, aliases }));
  writeFileSync(join(OUT, "approved-pages.json"), JSON.stringify({ generatedAt, ids: approvedPageIds.sort() }));
  writeFileSync(join(OUT, "index.json"), JSON.stringify({
    generatedAt,
    revision: revisionHash.digest("hex"),
    total,
    approvedTotal,
    coverage: {
      jurisdictionsTotal: jurisdictionInventory.jurisdictions.length,
      jurisdictionsWithRecords: countries.length,
      jurisdictionsWithApprovedRecords: countries.filter((country) => country.approvedCount > 0).length,
    },
    shards: { listSize: LIST_SHARD_SIZE, detailSize: SHARD_SIZE },
    directLookup: "/data/id-index.json",
    countries,
    feeds,
  }));
  console.log(`public/data: ${total} records across ${countries.length} countries`);
}

main();
