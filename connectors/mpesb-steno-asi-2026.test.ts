import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mpesbStenoAsi2026, verifyStenoHome, verifyStenoDashboard, verifyStenoForms } from "./mpesb-steno-asi-2026.ts";
import { evaluateEligibility } from "../lib/eligibility/evaluate.ts";
import type { ConnectorContext, Evidence, SourceConfig } from "./types.ts";

const notice = JSON.parse(readFileSync(new URL("../data/extractions/mpesb-steno-asi-2026.json", import.meta.url), "utf8"));
const html = (name: string) => readFileSync(new URL(`../data/evidence/research/mpesb68-${name}-2026-09-27.html`, import.meta.url), "utf8");
const home = html("home"), dashboard = html("dashboard"), forms = html("forms");
const pdf = readFileSync(new URL("../data/evidence/research/mpesb68-in-mp-esb-steno-asi-2026-rulebook-2026-09-27.pdf", import.meta.url));
const source: SourceConfig = { id: "in-mp-esb-steno-asi-2026", name: "MPESB Steno/ASI 2026", country: "IN", authority: "Madhya Pradesh Employees Selection Board", homepage: notice.homeUrl, connector: "mpesb-steno-asi-2026", cadenceHours: 1, licence: "Official evidence awaiting review", enabled: false, reviewRequired: true };
const evidence = (url: string, bytes: Buffer, contentType: string): Evidence => ({ url, fetchedAt: "2026-09-27T03:00:00Z", sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, contentType });
const context = (overrides: Partial<ConnectorContext> = {}): ConnectorContext => ({
  source, now: new Date("2026-09-27T03:00:00Z"), env: {}, log: () => {},
  fetchText: async (url) => { const text = url === notice.homeUrl ? home : url === notice.dashboardUrl ? dashboard : forms; return { text, evidence: evidence(url, Buffer.from(text), "text/html") }; },
  fetchBytes: async (url) => ({ bytes: pdf, evidence: evidence(url, pdf, "application/pdf") }), ...overrides,
});

test("Steno/ASI binds current home, date row and new-application service; rejects extra amendments and correction-only forms", () => {
  verifyStenoHome(home); verifyStenoDashboard(dashboard); verifyStenoForms(forms);
  const ruleLink = 'href="Rulebooks/RB_2026/Steno_ASI_2026_Rulebook_17092026.pdf">Rulebook</a>';
  assert.throws(() => verifyStenoHome(home.replace(ruleLink, ruleLink+'<a href="changed.pdf">Amendment</a>')), /changed|missing|duplicated/);
  for (const anchor of ["<a href='changed.pdf'>Amendment</a>", "<a href=changed.pdf>Amendment</a>"]) {
    assert.throws(() => verifyStenoHome(home.replace(ruleLink, ruleLink + anchor)), /changed/);
  }
  const title = "Subedar (Stenographer) & Asst. Sub-Inspector Recruitment Test For Police H.Q., Home (Police) -2026</a>";
  assert.throws(() => verifyStenoDashboard(dashboard.replace(title, title + '<a href="changed.pdf">Amendment</a>')), /changed/);
  assert.throws(() => verifyStenoDashboard(dashboard.replace("08/10/2026", "13/10/2026")), /changed/);
  assert.throws(() => verifyStenoDashboard(dashboard + dashboard), /duplicated/);
  const current = forms.indexOf("सूबेदार (अनुसचिवीय) शीघ्रलेखक");
  const changed = forms.slice(0, current) + forms.slice(current).replace("आवेदन पत्र", "भुगतान पश्चात संशोधन");
  assert.throws(() => verifyStenoForms(changed), /changed/);
  assert.throws(() => verifyStenoForms(forms.replace("id=86", "id=90")), /changed/);
});

test("one joint draft separates citizenship, non-MP residence, Hindi certificate and exam medium", async () => {
  const result = await mpesbStenoAsi2026(context()); const cycle = result.cycles[0];
  assert.equal(result.cycles.length, 1); assert.equal(result.complete, false);
  assert.equal(cycle.reviewDecision, undefined); assert.equal(cycle.status, "open");
  assert.equal(cycle.applicationWindow.closesOn, "2026-10-08");
  assert.equal(cycle.applicationWindow.officialTimeZone, null); assert.equal(cycle.applicationWindow.cutoffLocalTime, null);
  assert.match(cycle.applicationWindow.note ?? "", /midnight/);
  assert.match(cycle.residenceRule, /Non-MP/); assert.equal(cycle.rules?.residence, undefined);
  assert.match(cycle.languageNote ?? "", /100 words per minute/);
  assert.equal(cycle.rules?.languages?.length, 2);
  assert.equal(cycle.rules?.languages?.[0].certificateRequired, true);
  assert.equal(cycle.rules?.languages?.[1].stage, "selection");
  assert.ok(cycle.rules?.languages?.every(rule => rule.framework === undefined && rule.minimumLevel === undefined));
  assert.equal(cycle.appointmentType, undefined); assert.equal(cycle.venues[0].kind, "unknown");
  assert.ok(cycle.rules?.manualChecks?.some(check => check.stage === "selection" && /prior appointing-authority permission/.test(check.text)));
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "US", education: "higher-secondary" }).canApply.result, "does-not-match");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "higher-secondary" }).canApply.result, "needs-verification");
  assert.equal(evaluateEligibility(cycle.rules, { nationality: "IN", education: "secondary" }).canApply.result, "does-not-match");
});

test("changed bytes, forged receipt and redirected PDF cannot reuse pinned extraction", async () => {
  for (const variant of ["changed", "forged", "redirected"] as const) {
    await assert.rejects(() => mpesbStenoAsi2026(context({ fetchBytes: async (url) => {
      const bytes = variant === "changed" || variant === "forged" ? Buffer.concat([pdf, Buffer.from("changed")]) : pdf;
      const receipt = evidence(variant === "redirected" ? "https://esb.mp.gov.in/other.pdf" : url, bytes, "application/pdf");
      if (variant === "forged") receipt.sha256 = notice.rulebookSha256;
      return { bytes, evidence: receipt };
    } })), /PDF changed/);
  }
});

test("unknown timezone leaves deadline boundary uncertain; correction window never keeps applications open", async () => {
  for (const [instant, status] of [["2026-09-22T12:00:00Z", "upcoming"], ["2026-10-08T00:00:00Z", "uncertain"], ["2026-10-10T12:00:00Z", "closed"]]) {
    const result = await mpesbStenoAsi2026(context({ now: new Date(instant) }));
    assert.equal(result.cycles[0].status, status);
  }
});
