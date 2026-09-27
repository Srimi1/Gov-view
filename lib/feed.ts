import type { OpportunityCycle, OpportunityChange } from "./opportunities.ts";
import { approvedRevision } from "./public-approval.ts";

export interface FeedEntry {
  id: string;
  title: string;
  summary: string;
  at: string;
  url: string;
  jurisdictionCode: string;
  authority: string;
}

const materialKinds = new Set<OpportunityChange["kind"]>(["created", "extended", "cancelled", "eligibility"]);

function officialUrl(item: OpportunityCycle): string | null {
  return item.sources.find((source) => source.verificationStatus === "verified" && source.url && /^https:\/\//i.test(source.url))?.url ?? null;
}

/** Legacy "updated" includes collector health changes; exclude without material proof. */
export function approvedFeedEntries(item: OpportunityCycle, siteUrl?: string): FeedEntry[] {
  if (!approvedRevision(item)) return [];
  const fallback = officialUrl(item);
  if (!fallback) return [];
  const base = siteUrl && /^https:\/\//i.test(siteUrl) ? siteUrl.replace(/\/$/, "") : null;
  const url = base ? `${base}/job/?id=${encodeURIComponent(item.id)}` : fallback;
  return item.changes
    .filter((change) => materialKinds.has(change.kind) && Number.isFinite(Date.parse(change.at)))
    .map((change) => ({
      id: `urn:govview:change:${item.id}:${change.kind}:${change.at}`,
      title: `${change.kind === "created" ? "New" : change.kind === "extended" ? "Extended" : change.kind === "cancelled" ? "Cancelled" : "Eligibility changed"}: ${item.title}`,
      summary: change.summary,
      at: new Date(change.at).toISOString(),
      url,
      jurisdictionCode: item.jurisdictionCode,
      authority: item.authority,
    }));
}

function xml(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function ordered(entries: readonly FeedEntry[]): FeedEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export function renderRss(title: string, entries: readonly FeedEntry[], channelUrl: string): string {
  const sorted = ordered(entries);
  const items = sorted.map((entry) => `  <item>\n    <title>${xml(entry.title)}</title>\n    <link>${xml(entry.url)}</link>\n    <guid isPermaLink="false">${xml(entry.id)}</guid>\n    <pubDate>${new Date(entry.at).toUTCString()}</pubDate>\n    <description>${xml(entry.summary)}</description>\n  </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>${xml(title)}</title>\n  <link>${xml(channelUrl)}</link>\n  <description>Approved material opportunity changes. Confirm details on official sites.</description>\n${items}\n</channel>\n</rss>\n`;
}

export function renderAtom(title: string, feedId: string, entries: readonly FeedEntry[], channelUrl: string, now: Date): string {
  const sorted = ordered(entries);
  const updated = sorted[0]?.at ?? now.toISOString();
  const items = sorted.map((entry) => `  <entry>\n    <id>${xml(entry.id)}</id>\n    <title>${xml(entry.title)}</title>\n    <updated>${xml(entry.at)}</updated>\n    <link href="${xml(entry.url)}"/>\n    <summary>${xml(entry.summary)}</summary>\n  </entry>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <id>${xml(feedId)}</id>\n  <title>${xml(title)}</title>\n  <updated>${xml(updated)}</updated>\n  <link href="${xml(channelUrl)}"/>\n${items}\n</feed>\n`;
}
