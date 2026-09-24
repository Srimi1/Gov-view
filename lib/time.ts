/** Civil-date helpers. Dates are ISO `YYYY-MM-DD` strings in the authority's own timezone. */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = formatterCache.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatterCache.set(timeZone, cached);
  }
  return cached;
}

/** Today's calendar date as seen in `timeZone`. Falls back to UTC for unknown zones. */
export function civilDateIn(timeZone: string, now: Date = new Date()): string {
  try {
    return formatter(timeZone).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function civilDay(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return civilDay(to) - civilDay(from);
}

/** Completed years of age on `onDate`. A 29 Feb birthday turns over on 1 Mar in common years. */
export function ageOn(dateOfBirth: string, onDate: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [oy, om, od] = onDate.split("-").map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age -= 1;
  return age;
}

/** Short abbreviation for an IANA zone, e.g. "IST" or "GMT+9". */
export function zoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
      .formatToParts(at)
      .find((item) => item.type === "timeZoneName");
    if (timeZone === "Asia/Kolkata") return "IST";
    if (timeZone === "Asia/Tokyo") return "JST";
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** Current "HH:MM" wall-clock time in `timeZone`. */
export function clockIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    return `${get("hour")}:${get("minute")}`;
  } catch {
    return now.toISOString().slice(11, 16);
  }
}
