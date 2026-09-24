import { createHash } from "node:crypto";
import type { Evidence } from "./types.ts";

/**
 * Polite fetching for official sources:
 * - identifies itself with a contact URL
 * - obeys robots.txt (Disallow rules for our agent or *)
 * - at most one request per second per host
 * - time and size limits, a few retries on network/5xx errors
 * It never tries to get past CAPTCHAs or bot checks: a challenge page is an error.
 */
// Honest identification. Some government firewalls reject agents containing URLs, so the contact is written without a scheme.
export const USER_AGENT = "GOVView/0.2 (open-source public job index; github.com/gov-view)";
const MIN_INTERVAL_MS = 1000;
const TIMEOUT_MS = 60_000;
const MAX_BYTES = 250 * 1024 * 1024;

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<string, string[]>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(host: string) {
  const wait = (lastRequestAt.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

/** Disallow prefixes that apply to us, from the `*` group or a group naming GOVView. */
export function parseRobots(text: string): string[] {
  const rules: string[] = [];
  let applies = false;
  let groupHasRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, field, value] = match;
    const key = field.toLowerCase();
    if (key === "user-agent") {
      if (groupHasRules) { applies = false; groupHasRules = false; }
      if (value === "*" || /govview/i.test(value)) applies = true;
    } else if (key === "disallow" || key === "allow") {
      groupHasRules = true;
      if (applies && key === "disallow" && value) rules.push(value);
    }
  }
  return rules;
}

export function robotsAllows(rules: string[], path: string): boolean {
  return !rules.some((rule) => {
    const anchored = rule.endsWith("$");
    const body = (anchored ? rule.slice(0, -1) : rule).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
  });
}

async function robotsFor(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  let rules: string[] = [];
  try {
    await throttle(new URL(origin).host);
    const response = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    if (response.ok && (response.headers.get("content-type") ?? "").includes("text/plain")) rules = parseRobots(await response.text());
  } catch {
    // No robots.txt reachable: fall back to allowing, as crawlers conventionally do.
  }
  robotsCache.set(origin, rules);
  return rules;
}

export type FetchInit = { headers?: Record<string, string>; accept?: string; method?: "GET" | "POST"; body?: string; ignoreRobotsFor?: string[] };

export async function politeFetchText(url: string, init: FetchInit = {}): Promise<{ text: string; evidence: Evidence }> {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error(`Refusing non-HTTPS source: ${url}`);
  // A documented exception (sources/registry.json) skips robots.txt for named hosts only.
  // Rate limits, honest identification and the bot-check refusal still apply.
  if (!init.ignoreRobotsFor?.includes(target.host)) {
    const rules = await robotsFor(target.origin);
    if (!robotsAllows(rules, target.pathname + target.search)) throw new Error(`robots.txt disallows ${target.pathname}`);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await throttle(target.host);
    try {
      const response = await fetch(url, {
        method: init.method ?? "GET",
        body: init.body,
        headers: { "User-Agent": USER_AGENT, Accept: init.accept ?? "*/*", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), { permanent: true });
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > MAX_BYTES) throw Object.assign(new Error(`Response too large (${length} bytes)`), { permanent: true });
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) throw Object.assign(new Error("Response too large"), { permanent: true });
      const text = buffer.toString("utf8");
      if (/captcha|altcha|cf-challenge|are you a robot/i.test(text.slice(0, 5000)) && !/json|csv/.test(response.headers.get("content-type") ?? "")) {
        throw Object.assign(new Error("Source answered with a bot check; not bypassing it"), { permanent: true });
      }
      return {
        text,
        evidence: {
          url,
          fetchedAt: new Date().toISOString(),
          sha256: createHash("sha256").update(buffer).digest("hex"),
          contentType: response.headers.get("content-type") ?? "",
          bytes: buffer.byteLength,
        },
      };
    } catch (error) {
      lastError = error;
      if ((error as { permanent?: boolean }).permanent) break;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
