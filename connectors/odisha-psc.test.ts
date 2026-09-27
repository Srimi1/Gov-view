import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import { ODISHA_HOME, odishaPsc, parseOdishaPostback } from "./odisha-psc.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const html = readFileSync(new URL("../data/evidence/research/opsc-home-2026.html", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../data/evidence/research/opsc-app-09-2026-second-corrigendum-response.bin", import.meta.url));
const source = (JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8")).sources as SourceConfig[]).find((item) => item.id === "in-or-recruitment")!;
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({ url, fetchedAt: "2026-09-25T00:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), contentType, bytes: bytes.length });
const context = (override: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-25T00:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => ({ text: html, evidence: evidence(url, Buffer.from(html), "text/html") }),
  fetchBytes: async (url, init) => {
    assert.equal(url, ODISHA_HOME);
    assert.equal(init?.method, "POST");
    assert.equal(init?.headers?.["Content-Type"], "application/x-www-form-urlencoded");
    const body = new URLSearchParams(init?.body);
    assert.equal(body.get("__EVENTTARGET"), parseOdishaPostback(html).get("__EVENTTARGET"));
    assert.ok(body.has("__VIEWSTATE"));
    return { bytes: pdf, evidence: evidence(url, pdf, "application/pdf") };
  },
  ...override,
});

test("Odisha public form binds one corrigendum action and rejects drift", () => {
  assert.equal(parseOdishaPostback(html).get("__EVENTTARGET"), "ctl00$generic_masterpage1$ctl73");
  assert.throws(() => parseOdishaPostback(html.replace("2nd Corrigendum notice", "3rd Corrigendum notice")), /missing, duplicated or date changed/);
  assert.throws(() => parseOdishaPostback(html.replace("</ul>", "<li>25 Sep - 2026 Assistant Public Prosecutor (Advt. No. 09 of 2026-27) - 3rd Corrigendum</li></ul>")), /another notice or amendment/);
  assert.throws(() => parseOdishaPostback(html.replace("ctl00$generic_masterpage1$ctl73", "ctl00$unsafe$ctl73")), /action changed/);
});

test("Odisha APP draft keeps one cycle, foreign citizens excluded, Odia proof explicit", async () => {
  assert.equal(source.reviewRequired, true);
  assert.equal(source.enabled, false);
  const result = await odishaPsc(context());
  assert.equal(result.cycles.length, 1);
  const cycle = result.cycles[0];
  assert.equal(cycle.status, "uncertain");
  assert.equal(cycle.applicationWindow.cutoffLocalTime, "17:00");
  assert.equal(cycle.examEvents?.[0].date, "2026-11-22");
  assert.equal(cycle.rules?.nationality?.allowed[0], "IN");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US" }).canApply.result, "does-not-match");
  assert.deepEqual(cycle.rules?.languages?.map((rule) => rule.language), ["or", "en"]);
  assert.match(cycle.rules!.languages![0].requirement, /Class X/);
  assert.equal(cycle.rules?.languages?.[0].minimumLevel, undefined);
  assert.equal(cycle.venues[0].kind, "published");
  assert.equal(cycle.venues[0].kind === "published" ? cycle.venues[0].precision : "", "city");
  assert.match(cycle.qualifications, /outside Odisha/);
  assert.match(cycle.outcome, /172/);
  assert.equal(cycle.sources[1].sha256, "6fd057e3f361be611558e575c3e6ba391fce274a2986062d691b64f41fb046e8");
});

test("Odisha changed PDF blocks old rules and deadline closes at local cutoff", async () => {
  const changed = Buffer.concat([pdf, Buffer.from("amended")]);
  await assert.rejects(() => odishaPsc(context({ fetchBytes: async (url) => ({ bytes: changed, evidence: evidence(url, changed, "application/pdf") }) })), /PDF bytes changed/);
  assert.equal((await odishaPsc(context({ now: new Date("2026-09-28T16:59:00+05:30") }))).cycles[0].status, "uncertain");
  assert.equal((await odishaPsc(context({ now: new Date("2026-09-28T17:00:00+05:30") }))).cycles[0].status, "closed");
});
