import type { CoverageRecord } from "./opportunities.ts";

export function coverageLabel(record: CoverageRecord | undefined): string {
  if (record?.status === "verified-listings") return "Verified listings from checked sources";
  if (record?.status === "sources-checked-no-current") return "Sources checked; no current opportunities found";
  if (record?.status === "partial") return "Partial coverage; listings may await review";
  if (record?.status === "blocked") return "Source access blocked or not connected";
  if (record?.status === "stale") return "Source check failing; latest data may be stale";
  return "Not researched yet";
}

export function researchLabel(record: CoverageRecord | undefined, registeredSources: number): string {
  if (record?.status === "sources-checked-no-current") return "Sources checked";
  if (record?.status === "verified-listings") return "Some reviewed records; source inventory incomplete";
  if (record?.status === "blocked") return "Official source identified; collection blocked";
  if (record?.status === "stale") return "Previous check succeeded; current source check failing";
  if (registeredSources || record?.researchedAuthorities.length) return "Sources identified; collection incomplete";
  return "Authorities not researched yet";
}
