import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceConfig } from "../connectors/types.ts";
import { demoCoverage, forceDemo, jurisdictions, type CoverageRecord } from "./opportunities.ts";

export interface SourceStatus {
  lastAttemptAt: string | null;
  lastSuccessfulFetchAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  recordCount: number;
  pendingReviewCount?: number;
  totalAvailable?: number;
  needsSecret?: string[];
}

interface DataIndex {
  generatedAt?: string;
  countries: { code: string; count: number; approvedCount?: number }[];
}

// Literal paths only: a computed path makes the bundler trace the whole project.
function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as T : fallback;
}

/** Build-time view of what is published, for the coverage page. */
export function publishedOverview() {
  const registry = readJson<{ sources: SourceConfig[] }>(join(process.cwd(), "sources", "registry.json"), { sources: [] });
  const status = readJson<Record<string, SourceStatus>>(join(process.cwd(), "data", "published", "sources-status.json"), {});
  const recordedCoverage = readJson<CoverageRecord[]>(join(process.cwd(), "data", "published", "coverage.json"), []);
  const index = readJson<DataIndex>(join(process.cwd(), "public", "data", "index.json"), { countries: [] });
  const counts: Record<string, number> = {};
  const approvedCounts: Record<string, number> = {};
  for (const country of index.countries) {
    counts[country.code] = country.count;
    approvedCounts[country.code] = country.approvedCount ?? 0;
  }
  const byCode = new Map(recordedCoverage.map((record) => [record.jurisdictionCode, record]));
  const coverage: CoverageRecord[] = jurisdictions.map((jurisdiction) => {
    const prior = byCode.get(jurisdiction.code);
    const sources = registry.sources.filter((source) => source.country === jurisdiction.code);
    const blocked = sources.length > 0 && sources.every((source) => !source.enabled || !!source.accessGap || !!status[source.id]?.needsSecret?.length);
    const fetched = sources.some((source) => !!status[source.id]?.lastSuccessfulFetchAt);
    const failed = sources.some((source) => !!status[source.id]?.lastError);
    const derivedStatus: CoverageRecord["status"] = approvedCounts[jurisdiction.code] > 0 ? "verified-listings"
      : counts[jurisdiction.code] > 0 ? "partial"
      : failed && prior?.lastSuccessfulFetchAt ? "stale"
      : prior?.status === "sources-checked-no-current" && !!prior.lastValidatedAt ? "sources-checked-no-current"
      : fetched ? "partial"
      : blocked ? "blocked"
      : sources.length || prior?.researchedAuthorities.length ? "partial" : "unresearched";
    return {
      jurisdictionCode: jurisdiction.code,
      fixture: false,
      status: derivedStatus,
      researchedAuthorities: prior?.researchedAuthorities ?? [],
      connectedSourceCount: prior?.connectedSourceCount ?? 0,
      unresolvedGaps: prior?.unresolvedGaps ?? [],
      lastSuccessfulFetchAt: prior?.lastSuccessfulFetchAt ?? null,
      lastValidatedAt: prior?.lastValidatedAt ?? null,
    };
  });
  return { demo: forceDemo, sources: registry.sources, status, coverage: forceDemo ? demoCoverage : coverage, counts, approvedCounts, generatedAt: index.generatedAt ?? null };
}
