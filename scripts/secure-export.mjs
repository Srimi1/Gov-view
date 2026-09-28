#!/usr/bin/env node
/** Apply per-page CSP hashes, enforce the publication gates, and enforce the Cloudflare Free export budget. */
import { createHash } from "node:crypto";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPORT_LIMITS = Object.freeze({ files: 18_000, assetBytes: 20 * 1024 * 1024, totalBytes: 750 * 1024 * 1024 });

const CSP_META = /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i;
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const SECRET_PATTERNS = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/],
  ["npm token", /\bnpm_[A-Za-z0-9]{36,}\b/],
  ["GitLab token", /\bglpat-[A-Za-z0-9_-]{20,}\b/],
];
// Publication gates: selectPublicRecords emits exactly two record shapes, both
// approved — current approvals (publicationApproved) and exact prior-approved
// snapshots under re-review (reviewPending). Anything else is a leak.
const RECORD_SHARD = /^data\/(?:list|detail)\/[^/]+\.json$/;
const JOB_PAGE = /^job\/([^/]+)\/index\.html$/;
const REVIEW_TOOL_SEGMENTS = ["tools", "review"];
const REVIEW_TOOL_REFERENCE = "tools/review/";

function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const match of html.matchAll(SCRIPT)) {
    if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
    hashes.add(`'sha256-${createHash("sha256").update(match[2], "utf8").digest("base64")}'`);
  }
  return [...hashes].sort();
}

export function secureHtml(html) {
  if (!html.includes("<head>")) throw new Error("Exported HTML lacks <head>");
  const hashes = inlineScriptHashes(html);
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`.trim(),
    "script-src-attr 'none'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
  ].join("; ");
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  // Parse policy before Next's external or inline bootstrap scripts in <head>.
  return html.replace(CSP_META, "").replace("<head>", `<head>${tag}`);
}

async function* filesUnder(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* filesUnder(path);
    else if (entry.isFile()) yield path;
  }
}

function secretCategory(contents) {
  for (const [name, pattern] of SECRET_PATTERNS) if (pattern.test(contents)) return name;
  return null;
}

function isReviewToolPath(label) {
  const segments = label.split("/");
  const toolsIndex = segments.indexOf(REVIEW_TOOL_SEGMENTS[0]);
  return toolsIndex !== -1 && segments[toolsIndex + 1] === REVIEW_TOOL_SEGMENTS[1];
}

function assertPublicRecord(record, label) {
  const id = typeof record?.id === "string" ? record.id : "(missing id)";
  if (record?.fixture === true) throw new Error(`Fixture record in export: ${label} (id ${id}). Fixtures are never approved and must not ship.`);
  if (record?.publicationApproved !== true && record?.reviewPending !== true) {
    throw new Error(`Unapproved record in export: ${label} (id ${id}). Only approved records or exact prior-approved snapshots under re-review may ship.`);
  }
  if (record?.reviewDecision !== undefined && record.reviewDecision?.status !== "approved") {
    throw new Error(`Unapproved record in export: ${label} (id ${id}). Exported records must carry an approved review decision.`);
  }
}

async function assertPublicRecords(path, label) {
  const records = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(records)) throw new Error(`Record shard is not an array: ${label}.`);
  for (const record of records) assertPublicRecord(record, label);
}

export async function secureExport(dir) {
  // Next requires one generated dynamic path even with zero approvals. Remove
  // its 404-only placeholder so it cannot be served with HTTP 200 by a host.
  await rm(join(dir, "job", "__no_approved_records__"), { recursive: true, force: true });
  const inventory = [];
  for await (const path of filesUnder(dir)) {
    if (path.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      await writeFile(path, secureHtml(html));
    }
    inventory.push(path);
  }

  let totalBytes = 0;
  const jobPageIds = [];
  for (const path of inventory) {
    const label = relative(dir, path).split(sep).join("/");
    if (isReviewToolPath(label)) throw new Error(`Review tooling leaked into export: ${label}. The tools/review server must never ship in static output.`);
    const name = basename(path);
    if (name === ".env" || name.startsWith(".env.")) throw new Error(`Environment file in export: ${label}. Environment files must never ship.`);
    const jobPage = label.match(JOB_PAGE);
    if (jobPage) jobPageIds.push(jobPage[1]);
    const size = (await stat(path)).size;
    if (size > EXPORT_LIMITS.assetBytes) throw new Error(`Export asset exceeds 20 MiB: ${label} (${size} bytes)`);
    totalBytes += size;
    if (/\.(?:html|js|mjs|json|css|xml|txt|svg)$/i.test(path)) {
      const contents = await readFile(path, "utf8");
      const category = secretCategory(contents);
      if (category) throw new Error(`Possible ${category} in exported asset: ${label}. Remove or rotate credential before publishing.`);
      if (contents.includes(REVIEW_TOOL_REFERENCE)) {
        throw new Error(`Review tool reference in exported asset: ${label}. The tools/review server must never ship in static output.`);
      }
    }
    if (RECORD_SHARD.test(label)) await assertPublicRecords(path, label);
  }
  if (jobPageIds.length) {
    let approved;
    try {
      approved = new Set(JSON.parse(await readFile(join(dir, "data", "approved-pages.json"), "utf8")).ids);
    } catch {
      throw new Error("Exported job pages cannot be verified: data/approved-pages.json is missing or invalid.");
    }
    for (const id of jobPageIds) {
      if (!approved.has(id)) throw new Error(`Exported job page without approval: ${id}. Job pages must be listed in data/approved-pages.json.`);
    }
  }
  if (inventory.length > EXPORT_LIMITS.files) throw new Error(`Export exceeds 18,000 files: ${inventory.length}`);
  if (totalBytes > EXPORT_LIMITS.totalBytes) throw new Error(`Export exceeds 750 MiB: ${totalBytes} bytes`);
  return { files: inventory.length, bytes: totalBytes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2] ?? fileURLToPath(new URL("../out", import.meta.url));
  secureExport(dir).then(({ files, bytes }) => {
    console.log(`Secure export: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB; per-page CSP hashes; publication gates passed; no detected secrets.`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
