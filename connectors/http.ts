import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
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
// MECL's published robots.txt says Crawl-delay: 10 for User-agent: *.
const HOST_MIN_INTERVAL_MS = new Map([["mecl.co.in", 10_000]]);
const TIMEOUT_MS = 60_000;
// GitHub rejects individual files above 100 MiB; keep retained evidence below that ceiling.
const MAX_BYTES = 90 * 1024 * 1024;
const runFile = promisify(execFile);

const nextRequestAt = new Map<string, number>();
const robotsCache = new Map<string, { rules: RobotsRule[]; expiresAt: number }>();
// Exact official hosts checked with system curl and normal certificate validation.
// Keep this narrow: other legacy-renegotiation servers remain blocked pending review.
const LEGACY_OS_TLS_HOSTS = new Set(["punjab.gov.in", "dit.punjab.gov.in", "sssb.punjab.gov.in", "psc.wb.gov.in"]);
// These two official KVS hosts time out in Node's connection path on this host;
// system curl reaches them with ordinary certificate validation and no challenge bypass.
const OS_CONNECT_TIMEOUT_HOSTS = new Set(["kvsangathan.nic.in", "cdnbbsr.s3waas.gov.in"]);
// Node's resolver reports ENOTFOUND for this official host on the collection machine;
// system curl resolves it with ordinary certificate checks and still enforces robots.txt.
const OS_DNS_HOSTS = new Set(["www.iprc.gov.in"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isNodeTrustFailure(error: unknown): boolean {
  const code = (error as { cause?: { code?: string } })?.cause?.code;
  return code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" || code === "SELF_SIGNED_CERT_IN_CHAIN";
}

/** Retry Node-specific TLS/HTTP parsing failures through OS TLS, with certificate checks still on. */
export function canUseSystemFetch(error: unknown, url?: string): boolean {
  const code = (error as { cause?: { code?: string } })?.cause?.code;
  const legacyHost = url ? LEGACY_OS_TLS_HOSTS.has(new URL(url).hostname) : false;
  const connectTimeoutHost = url ? OS_CONNECT_TIMEOUT_HOSTS.has(new URL(url).hostname) : false;
  const dnsHost = url ? OS_DNS_HOSTS.has(new URL(url).hostname) : false;
  return isNodeTrustFailure(error) || (code === "ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED" && legacyHost) ||
    (code === "UND_ERR_CONNECT_TIMEOUT" && connectTimeoutHost) ||
    (code === "ENOTFOUND" && dnsHost) ||
    /Response does not match the HTTP\/1\.1 protocol \(Invalid header token\)/.test((error as { cause?: { message?: string } })?.cause?.message ?? "");
}

/** System curl uses OS trust store when Node lacks an intermediate certificate. TLS checks stay on. */
async function systemFetch(url: string, accept: string, headers: Record<string, string> = {}, method: "GET" | "POST" = "GET", requestBody?: string) {
  const directory = await mkdtemp(join(tmpdir(), "govview-source-"));
  const body = join(directory, "body");
  const head = join(directory, "headers");
  try {
    const args = ["--silent", "--show-error", "--max-time", "60", "--proto", "=https", "--max-filesize", String(MAX_BYTES), "--user-agent", USER_AGENT, "--header", `Accept: ${accept}`];
    if (OS_CONNECT_TIMEOUT_HOSTS.has(new URL(url).hostname)) {
      args.push("--ipv4", "--connect-timeout", "5", "--retry", "2", "--retry-delay", "1", "--retry-all-errors");
    }
    for (const [name, value] of Object.entries(headers)) args.push("--header", `${name}: ${value}`);
    if (method === "POST") args.push("--request", "POST", "--data-raw", requestBody ?? "");
    args.push("--output", body, "--dump-header", head, "--write-out", "%{http_code}\n%{url_effective}", url);
    const { stdout } = await runFile("curl", args, { timeout: TIMEOUT_MS + 5_000, maxBuffer: 8192 });
    const [statusText, effective] = stdout.trim().split("\n");
    const status = Number(statusText);
    if (!Number.isInteger(status) || status < 100 || status > 599 || new URL(effective).origin !== new URL(url).origin) throw new Error("System TLS fetch returned invalid response or redirect");
    const bytes = await readFile(body);
    if (bytes.length > MAX_BYTES) throw Object.assign(new Error("Response too large"), { permanent: true });
    const headerBlocks = (await readFile(head, "utf8")).split(/\r?\n\r?\n/).filter((block) => /^HTTP\/\d/i.test(block));
    const contentType = /(?:^|\r?\n)content-type:\s*([^\r\n]+)/i.exec(headerBlocks.at(-1) ?? "")?.[1] ?? "";
    return { status, bytes, contentType };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function throttle(host: string) {
  // Reserve the slot before yielding so concurrent callers cannot share it.
  const slot = Math.max(Date.now(), nextRequestAt.get(host) ?? 0);
  nextRequestAt.set(host, slot + (HOST_MIN_INTERVAL_MS.get(host) ?? MIN_INTERVAL_MS));
  const wait = slot - Date.now();
  if (wait > 0) await sleep(wait);
}

export interface RobotsRule { directive: "allow" | "disallow"; pattern: string }

/** Select most-specific matching user-agent group; keep its Allow and Disallow rules. */
export function parseRobots(text: string): RobotsRule[] {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  const flush = () => { if (agents.length) groups.push({ agents, rules }); agents = []; rules = []; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) { if (rules.length) flush(); continue; }
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, field, value] = match;
    const key = field.toLowerCase();
    if (key === "user-agent") {
      if (rules.length) flush();
      agents.push(value.toLowerCase());
    } else if (key === "disallow" || key === "allow") {
      if (agents.length && value) rules.push({ directive: key, pattern: value });
    }
  }
  flush();
  const specificity = (agent: string) => agent === "*" ? 0 : "govview".startsWith(agent) ? agent.length : -1;
  const best = Math.max(-1, ...groups.flatMap((group) => group.agents.map(specificity)));
  if (best < 0) return [];
  return groups.filter((group) => group.agents.some((agent) => specificity(agent) === best)).flatMap((group) => group.rules);
}

export function robotsAllows(rules: RobotsRule[], path: string): boolean {
  let winner: RobotsRule | null = null;
  let longest = -1;
  for (const rule of rules) {
    const anchored = rule.pattern.endsWith("$");
    const body = (anchored ? rule.pattern.slice(0, -1) : rule.pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    if (!new RegExp(`^${body}${anchored ? "$" : ""}`).test(path)) continue;
    const length = rule.pattern.replace(/[*$]/g, "").length;
    if (length > longest || (length === longest && rule.directive === "allow")) { winner = rule; longest = length; }
  }
  return winner?.directive !== "disallow";
}

async function robotsFor(origin: string): Promise<RobotsRule[]> {
  const cached = robotsCache.get(origin);
  if (cached && cached.expiresAt > Date.now()) return cached.rules;
  let rules: RobotsRule[] = [];
  let status = 0;
  try {
    await throttle(new URL(origin).host);
    const response = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    status = response.status;
    if (response.ok) {
      if (!(response.headers.get("content-type") ?? "").includes("text/plain")) throw new Error("robots.txt returned non-text content");
      rules = parseRobots(await response.text());
    }
  } catch (error) {
    if (canUseSystemFetch(error, `${origin}/robots.txt`)) {
      try {
        await throttle(new URL(origin).host);
        const system = await systemFetch(`${origin}/robots.txt`, "text/plain");
        status = system.status;
        if (system.status === 200) {
          if (!system.contentType.includes("text/plain")) throw new Error("robots.txt returned non-text content");
          rules = parseRobots(system.bytes.toString("utf8"));
        }
      } catch (fallbackError) {
        throw new Error(`robots.txt unreachable at ${origin}: ${(fallbackError as Error).message}`);
      }
    } else {
      throw new Error(`robots.txt unreachable at ${origin}: ${(error as Error).message}`);
    }
  }
  if (status === 401 || status === 403 || status >= 500 || status === 429) throw new Error(`robots.txt unavailable (HTTP ${status}) at ${origin}`);
  robotsCache.set(origin, { rules, expiresAt: Date.now() + 24 * 3_600_000 });
  return rules;
}

export type FetchInit = { headers?: Record<string, string>; accept?: string; method?: "GET" | "POST"; body?: string; ignoreRobotsFor?: string[] };

/** Respect a server's bounded retry window; do not hold free runners for hours. */
export function retryAfterDelay(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value.trim()) * 1000 : NaN;
  const delay = Number.isFinite(seconds) ? seconds : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.min(30_000, Math.max(0, delay)) : null;
}

/** Public JavaScript can mention CAPTCHA controls without being a challenge page. */
export function isBotChallenge(text: string, contentType: string): boolean {
  const sample = text.slice(0, 5000);
  const html = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType)
    || /^\s*(?:<!doctype\s+html|<html\b|<body\b|<div\b|<form\b)/i.test(sample);
  if (!html && /json|csv|javascript/i.test(contentType)) return false;
  if (/altcha|cf-challenge|are you a robot|verify (?:that )?you are human/i.test(sample)) return true;
  if (!/captcha/i.test(sample)) return false;
  // Some official public notice pages include a CAPTCHA for a separate account
  // login form. Their notice links are already available by ordinary GET.
  return !(/<form\b[^>]*\bid=["']loginForm["']/i.test(text) &&
    /href=["'](?:https:\/\/[^"']+\/)?Download\?param1=/i.test(text));
}

/** Retains exact bytes for PDF evidence; the same access policy applies to all formats. */
export async function politeFetchBytes(url: string, init: FetchInit = {}): Promise<{ bytes: Buffer; evidence: Evidence }> {
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
      if (response.status === 429 || response.status === 503) throw Object.assign(new Error(`HTTP ${response.status}`), { retryAfterMs: retryAfterDelay(response.headers.get("retry-after")) });
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), { permanent: true });
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > MAX_BYTES) throw Object.assign(new Error(`Response too large (${length} bytes)`), { permanent: true });
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) throw Object.assign(new Error("Response too large"), { permanent: true });
      const text = buffer.toString("utf8");
      if (isBotChallenge(text, response.headers.get("content-type") ?? "")) {
        throw Object.assign(new Error("Source answered with a bot check; not bypassing it"), { permanent: true });
      }
      return {
        bytes: buffer,
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
      if (canUseSystemFetch(error, url)) {
        try {
          await throttle(target.host);
          const headers = { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers };
          const system = await systemFetch(url, init.accept ?? "*/*", headers, init.method ?? "GET", init.body);
          if (system.status === 429 || system.status >= 500) throw new Error(`HTTP ${system.status}`);
          if (system.status < 200 || system.status >= 300) throw Object.assign(new Error(`HTTP ${system.status} for ${url}`), { permanent: true });
          if (isBotChallenge(system.bytes.toString("utf8"), system.contentType)) throw Object.assign(new Error("Source answered with a bot check; not bypassing it"), { permanent: true });
          return { bytes: system.bytes, evidence: { url, fetchedAt: new Date().toISOString(), sha256: createHash("sha256").update(system.bytes).digest("hex"), contentType: system.contentType, bytes: system.bytes.length } };
        } catch (systemError) {
          lastError = systemError;
        }
      }
      if ((lastError as { permanent?: boolean }).permanent) break;
      if (attempt < 2) await sleep((lastError as { retryAfterMs?: number }).retryAfterMs ?? 2000 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function politeFetchText(url: string, init: FetchInit = {}): Promise<{ text: string; bytes: Buffer; evidence: Evidence }> {
  const result = await politeFetchBytes(url, init);
  return { text: result.bytes.toString("utf8"), bytes: result.bytes, evidence: result.evidence };
}
