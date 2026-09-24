import type { EligibilityResult } from "./eligibility/types.ts";
import { daysUntilDeadline, type CycleSummary, type OpportunityCycle, type OpportunityStatus, type Pathway } from "./opportunities.ts";
import { zoneAbbreviation } from "./time.ts";

export const pathwayLabels: Record<Pathway, string> = {
  recruitment: "Jobs",
  licensing: "Licences",
  admission: "Admissions",
  vocational: "Skills & trades",
};

export const pathwayDescriptions: Record<Pathway, string> = {
  recruitment: "Government jobs and recruitment exams",
  licensing: "Professional registration and licensing exams",
  admission: "Entrance to public universities and institutes",
  vocational: "Apprenticeships and trade certificates",
};

export const statusLabels: Record<OpportunityStatus, string> = {
  open: "Open",
  closed: "Closed",
  extended: "Deadline extended",
  cancelled: "Cancelled",
  stale: "Not rechecked recently",
  uncertain: "Being checked",
  upcoming: "Opening soon",
};

export const resultLabels: Record<EligibilityResult, string> = {
  "matches-published-criteria": "Yes, on the published rules",
  "does-not-match": "No",
  "needs-verification": "Not sure yet",
};

export const shortResultLabels: Record<EligibilityResult, string> = {
  "matches-published-criteria": "You may be eligible",
  "does-not-match": "Not eligible",
  "needs-verification": "Check details",
};

export function dateLabel(date: string | null | undefined, fallback = "Not announced"): string {
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

export function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

/** "Closes 15 Oct (in 21 days)" style text, in the authority's own timezone. */
export function deadlineText(item: CycleSummary): string {
  if (item.status === "cancelled") return "Cancelled";
  if (item.status === "upcoming" && item.applicationWindow.opensOn) return `Expected to open ${shortDate(item.applicationWindow.opensOn)}`;
  const close = item.applicationWindow.closesOn;
  if (!close) return "Closing date not announced";
  const days = daysUntilDeadline(item);
  if (item.status === "closed" || (days !== null && days < 0)) return `Closed ${shortDate(close)}`;
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return `Closes ${shortDate(close)} (${when})`;
}

export function deadlineUrgent(item: CycleSummary): boolean {
  const days = daysUntilDeadline(item);
  return (item.status === "open" || item.status === "extended") && days !== null && days >= 0 && days <= 7;
}

export function cutoffText(item: OpportunityCycle): string {
  const window = item.applicationWindow;
  const zone = zoneAbbreviation(window.officialTimeZone);
  if (window.cutoffLocalTime) return `${window.cutoffLocalTime} ${zone}`;
  return `Time not given (${zone})`;
}

export function venueText(item: OpportunityCycle): string {
  const published = item.venues.filter((venue) => venue.kind === "published");
  const online = item.venues.some((venue) => venue.kind === "online");
  if (published.length) return `${published.map((venue) => venue.city).join(", ")}${online ? ", plus an online stage" : ""}`;
  return online ? "Online; other venues not announced" : "Not announced yet";
}
