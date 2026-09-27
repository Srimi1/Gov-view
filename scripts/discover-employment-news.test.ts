import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseEmploymentNews } from "./discover-employment-news.ts";

const html = readFileSync(new URL("../data/evidence/research/employment-news-alljobs-2026.html", import.meta.url), "utf8");

test("Employment News leads keep source date order and exclude applicant claims", () => {
  const leads = parseEmploymentNews(html);
  assert.equal(leads.length, 12);
  assert.equal(new Set(leads.map((lead) => lead.id)).size, leads.length);
  const mecl = leads.find((lead) => lead.organisation === "MINERAL EXPLORATION AND CONSULTANCY LIMITED")!;
  assert.equal(mecl.issueDate, "2026-09-12");
  assert.equal(mecl.issueDateRaw, "12/09/2026");
  assert.equal(mecl.reportedDeadline, "2026-10-11");
  assert.equal(mecl.appointmentMethod, "Recruitment");
  assert.equal(mecl.verification, "authority-not-checked");
  assert.equal(leads.find((lead) => lead.organisation === "NATIONAL DISASTER MANAGEMENT AUTHORITY")?.issueDate, "2026-08-31");
  assert.ok(leads.every((lead) => !("citizenshipRule" in lead) && !("languageNote" in lead) && !("status" in lead)));
});

test("Employment News table mutations fail instead of replacing leads with partial data", () => {
  assert.throws(() => parseEmploymentNews(html.replace("All JOBS", "Other Jobs")), /heading missing/);
  assert.throws(() => parseEmploymentNews(html.replace("11/10/2026", "31/02/2026")), /Invalid Employment News date/);
  assert.throws(() => parseEmploymentNews(html.replace("ACCOUNTANT &amp; OTHERS", "")), /row shape changed/);
  const row = /<tr style="text-align:center; padding-top:2px[\s\S]*?<\/tr>/i.exec(html)![0];
  assert.throws(() => parseEmploymentNews(html.replace(row, `${row}${row}`)), /duplicate lead identity/);
});
