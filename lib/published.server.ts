import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceConfig } from "../connectors/types.ts";
import { demoCoverage, forceDemo, type CoverageRecord } from "./opportunities.ts";

export interface SourceStatus {
  lastAttemptAt: string | null;
  lastSuccessfulFetchAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  recordCount: number;
  totalAvailable?: number;
  needsSecret?: string[];
}

// Literal paths only: a computed path makes the bundler trace the whole project.
function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as T : fallback;
}

/** Build-time view of what is published, for the coverage page. */
export function publishedOverview() {
  const registry = readJson<{ sources: SourceConfig[] }>(join(process.cwd(), "sources", "registry.json"), { sources: [] });
  const status = readJson<Record<string, SourceStatus>>(join(process.cwd(), "data", "published", "sources-status.json"), {});
  const coverage = readJson<CoverageRecord[]>(join(process.cwd(), "data", "published", "coverage.json"), []);
  const counts: Record<string, number> = {};
  for (const source of registry.sources) counts[source.country] = (counts[source.country] ?? 0) + (status[source.id]?.recordCount ?? 0);
  const demo = forceDemo || Object.values(counts).every((count) => !count);
  return { demo, sources: registry.sources, status, coverage: demo || !coverage.length ? demoCoverage : coverage, counts };
}
