import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { withBase } from "./base-path.ts";
import { liveStatus, type OpportunityCycle } from "./opportunities.ts";
import { isApprovedCycle } from "./review.server.ts";

const ROOT = process.cwd();
const MAX_STATIC_PAGES = 5_000;
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://srimi1.github.io").replace(/\/$/, "");

export function publicUrl(path: string): string {
  return new URL(withBase(path), SITE_ORIGIN).toString();
}

let selected: OpportunityCycle[] | undefined;

/** Only current, evidence-bound reviewer approvals get their own HTML page. */
export function approvedStaticPages(): OpportunityCycle[] {
  if (selected) return selected;
  const manifestPath = join(ROOT, "public", "data", "approved-pages.json");
  if (!existsSync(manifestPath)) return (selected = []);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { ids?: string[] };
  const approvedIds = new Set(manifest.ids ?? []);
  if (!approvedIds.size) return (selected = []);
  const sourceDir = join(ROOT, "data", "published", "cycles");
  const records: OpportunityCycle[] = [];
  for (const file of readdirSync(sourceDir).filter((name) => /^[A-Z0-9-]+\.json$/.test(name))) {
    for (const item of JSON.parse(readFileSync(join(sourceDir, file), "utf8")) as OpportunityCycle[]) {
      if (!approvedIds.has(item.id) || item.fixture || !isApprovedCycle(item)) continue;
      if (!item.sources.some((source) => source.url && /^https?:\/\//.test(source.url))) continue;
      if (!/^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(item.id)) continue;
      const state = liveStatus(item);
      if (item.jurisdictionCode === "IN" || state === "open" || state === "extended") records.push(item);
    }
  }
  records.sort((a, b) =>
    Number(b.jurisdictionCode === "IN") - Number(a.jurisdictionCode === "IN") ||
    (a.applicationWindow.closesOn ?? "9999-12-31").localeCompare(b.applicationWindow.closesOn ?? "9999-12-31") ||
    a.id.localeCompare(b.id),
  );
  const unique = new Map<string, OpportunityCycle>();
  for (const item of records) if (!unique.has(item.id)) unique.set(item.id, item);
  return (selected = [...unique.values()].slice(0, MAX_STATIC_PAGES));
}

export function approvedStaticPage(id: string): OpportunityCycle | undefined {
  return approvedStaticPages().find((item) => item.id === id);
}
