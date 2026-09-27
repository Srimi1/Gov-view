import type { OpportunityCycle } from "./opportunities.ts";
import { isIsoDate } from "./time.ts";
import { approvedRevision } from "./public-approval.ts";

type ExamEventInput = {
  id?: string;
  label: string;
  date: string;
  endDate?: string;
  localTime?: string;
  timezone?: string;
  verified?: boolean;
  sourceUrl?: string;
};

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** iCalendar folds by UTF-8 bytes, never through a multibyte character. */
function fold(line: string): string {
  const chunks: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const point of line) {
    const size = new TextEncoder().encode(point).length;
    if (bytes + size > (chunks.length ? 74 : 75)) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += point;
    bytes += size;
  }
  chunks.push(chunk);
  return chunks.join("\r\n ");
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function dateValue(date: string): string {
  return date.replace(/-/g, "");
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function wallParts(instant: number, timezone: string): [number, number, number, number, number, number] {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (name: string) => Number(parts.find((value) => value.type === name)?.value);
  return [part("year"), part("month"), part("day"), part("hour"), part("minute"), part("second")];
}

/** Refuse nonexistent local times rather than exporting a shifted deadline. */
function localToUtc(date: string, time: string, timezone: string): Date | null {
  if (!isIsoDate(date) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  try {
    let candidate = target;
    for (let attempt = 0; attempt < 4; attempt++) {
      const [y, m, d, h, min, sec] = wallParts(candidate, timezone);
      const delta = target - Date.UTC(y, m - 1, d, h, min, sec);
      if (delta === 0) return new Date(candidate);
      candidate += delta;
    }
  } catch { /* Invalid IANA zone. */ }
  return null;
}

function trustedUrl(item: OpportunityCycle): string | null {
  const candidate = item.sources.find((source) => source.verificationStatus === "verified" && source.url && /^https:\/\//i.test(source.url))?.url;
  return candidate ?? null;
}

function sequence(item: OpportunityCycle): number {
  const reviewedAt = (item as OpportunityCycle & { reviewDecision?: { reviewedAt?: string } }).reviewDecision?.reviewedAt;
  const seconds = reviewedAt ? Math.floor(Date.parse(reviewedAt) / 1000) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 && seconds < 2_147_483_647 ? seconds : 0;
}

function event(
  item: OpportunityCycle,
  suffix: string,
  label: string,
  start: string,
  end: string,
  now: Date,
  url: string,
): string[] {
  const revision = approvedRevision(item)!;
  return [
    "BEGIN:VEVENT",
    `UID:${escapeText(`${item.id}-${suffix}@govview`)}`,
    `DTSTAMP:${stamp(now)}`,
    `SEQUENCE:${sequence(item)}`,
    `DTSTART${start}`,
    `DTEND${end}`,
    `SUMMARY:${escapeText(label)}`,
    `DESCRIPTION:${escapeText(`Confirm on official site. Downloaded calendar copies do not automatically update. Evidence revision: ${revision}`)}`,
    `URL:${url}`,
    "END:VEVENT",
  ];
}

/** Returns null unless record, evidence revision, dates, and official URL are approved. */
export function calendarForOpportunity(item: OpportunityCycle, now: Date = new Date()): string | null {
  if (!approvedRevision(item)) return null;
  if (item.status === "cancelled") return null;
  const url = trustedUrl(item);
  if (!url) return null;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GOV View//Exam calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  const window = item.applicationWindow;
  if (window.closesOn && isIsoDate(window.closesOn)) {
    const label = `Application deadline: ${item.title}`;
    if ((window.precision === "minute" || window.precision === "second") && window.cutoffLocalTime && window.officialTimeZone) {
      const cutoff = localToUtc(window.closesOn, window.cutoffLocalTime, window.officialTimeZone);
      if (cutoff) {
        lines.push(...event(item, "application-deadline", label, `:${stamp(cutoff)}`, `:${stamp(new Date(cutoff.getTime() + (window.precision === "second" ? 1_000 : 60_000)))}`, now, url));
      }
    } else if (window.precision === "date" && !window.cutoffLocalTime) {
      lines.push(...event(item, "application-deadline", label, `;VALUE=DATE:${dateValue(window.closesOn)}`, `;VALUE=DATE:${dateValue(nextDate(window.closesOn))}`, now, url));
    }
  }
  const extras = (item as OpportunityCycle & { examEvents?: ExamEventInput[] }).examEvents ?? [];
  for (const [index, extra] of extras.entries()) {
    if (!extra.verified || !isIsoDate(extra.date) || (extra.endDate && !isIsoDate(extra.endDate))) continue;
    const suffix = `exam-${extra.id && /^[a-z0-9-]{1,64}$/.test(extra.id) ? extra.id : index}`;
    if (extra.localTime && extra.timezone) {
      const start = localToUtc(extra.date, extra.localTime, extra.timezone);
      const end = start && new Date(start.getTime() + 60_000);
      if (start && end) lines.push(...event(item, suffix, `Exam starts: ${extra.label}`, `:${stamp(start)}`, `:${stamp(end)}`, now, extra.sourceUrl && /^https:\/\//i.test(extra.sourceUrl) ? extra.sourceUrl : url));
    } else if (!extra.localTime) {
      const through = extra.endDate ?? extra.date;
      if (through >= extra.date) lines.push(...event(item, suffix, extra.label, `;VALUE=DATE:${dateValue(extra.date)}`, `;VALUE=DATE:${dateValue(nextDate(through))}`, now, extra.sourceUrl && /^https:\/\//i.test(extra.sourceUrl) ? extra.sourceUrl : url));
    }
  }
  if (lines.length === 5) return null;
  return [...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
