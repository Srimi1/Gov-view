import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { extractNagalandNoticeText, NAGALAND_ARCHIVE, NAGALAND_NOTICE, nagalandPsc, parseNagalandArchive, verifyNagalandNotice } from "./nagaland-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const archive = readFileSync(new URL("../data/evidence/research/npsc-advertisements.html", import.meta.url), "utf8");
const notice = readFileSync(new URL("../data/evidence/research/npsc-steno-2026.html", import.meta.url), "utf8");
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-nl-recruitment")!;
const evidence = (url: string, text: string): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(text).digest("hex"), contentType: "text/html", bytes: Buffer.byteLength(text) });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { const text = url === NAGALAND_ARCHIVE ? archive : notice; return { text, evidence: evidence(url, text) }; },
  ...override,
});

test("Nagaland archive binds one 2026 exam and holds new amendments or unsafe links", () => {
  assert.equal(parseNagalandArchive(archive).url, NAGALAND_NOTICE);
  const title = "Advertisement NO. NPSC/EXAM-18/2023 dt. 19.08.2026 (Stenographer Recruitment Examination 2026)";
  assert.throws(() => parseNagalandArchive(archive.replace(title, "Unrelated advertisement")), /missing, duplicated or amended/);
  assert.throws(() => parseNagalandArchive(archive.replace(`href="${NAGALAND_NOTICE}">${title}`, `href="https://example.org/notice">${title}`)), /outside official notice archive/);
  assert.throws(() => parseNagalandArchive(archive.replace("</ul>", `<li><a href="${NAGALAND_NOTICE}">Corrigendum NPSC/EXAM-18/2023 dt. 25.09.2026</a></li></ul>`)), /amendment/);
});

test("Nagaland Stenographer draft counts one exam cycle, keeps nationality and language uncertain", async () => {
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
  const verified = verifyNagalandNotice(notice);
  assert.equal(verified.vacancies, 26);
  assert.equal(verified.sha256, "4186433c0aff21de5b319e574142a9150d90ca62117467fd5b53a0a8a76c8241");
  const result = await nagalandPsc(context());
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.title, "Stenographer (Grade III)");
  assert.equal(cycle.status, "closed");
  assert.deepEqual([cycle.applicationWindow.opensOn, cycle.applicationWindow.closesOn, cycle.applicationWindow.cutoffLocalTime], ["2026-08-21", "2026-09-03", "12:00"]);
  assert.equal(cycle.rules?.nationality, undefined);
  assert.equal(cycle.rules?.languages, undefined);
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "needs-verification");
  assert.equal(cycle.venues[0].kind, "unknown");
  assert.match(cycle.qualifications, /80 words-per-minute/);
  assert.match(cycle.residenceRule, /100%/);
  assert.equal(cycle.sources[1].itemSha256, verified.sha256);
});

test("Nagaland notice body drift blocks old rules but page counters do not", async () => {
  assert.equal(extractNagalandNoticeText(notice.replace("Visitor Count", "Counter changed")), extractNagalandNoticeText(notice));
  assert.throws(() => verifyNagalandNotice(notice.replace("80 words per minute", "90 words per minute")), /wording changed/);
  await assert.rejects(() => nagalandPsc(context({ fetchText: async (url) => {
    const text = url === NAGALAND_ARCHIVE ? archive : notice.replace("80 words per minute", "90 words per minute");
    return { text, evidence: evidence(url, text) };
  } })), /wording changed/);
  const beforeCutoff = await nagalandPsc(context({ now: new Date("2026-09-03T11:59:00+05:30") }));
  assert.equal(beforeCutoff.cycles[0].status, "uncertain");
  const atCutoff = await nagalandPsc(context({ now: new Date("2026-09-03T12:00:00+05:30") }));
  assert.equal(atCutoff.cycles[0].status, "closed");
});
