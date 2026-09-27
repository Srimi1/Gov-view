import assert from "node:assert/strict";
import test from "node:test";
import { demoOpportunities, type OpportunityCycle } from "./opportunities.ts";
import { calendarForOpportunity } from "./ics.ts";

function approved(): OpportunityCycle {
  const source = demoOpportunities[0].sources[0];
  const revision = "a".repeat(64);
  return {
    ...demoOpportunities[0], id: "approved-cycle-2027", fixture: false,
    publicationApproved: true, evidenceRevision: revision,
    reviewDecision: { status: "approved", evidenceRevision: revision, recordRevision: "b".repeat(64), reviewer: "Reviewer", reviewedAt: "2026-09-25T10:00:00Z" },
    applicationWindow: { opensOn: "2027-01-01", closesOn: "2027-02-03", officialTimeZone: "Asia/Kolkata", cutoffLocalTime: null, precision: "date" },
    sources: [{ ...source, url: "https://official.example/notice", verificationStatus: "verified" }],
    title: "Research, Exams; Round 2\nNotice",
    status: "open",
    examEvents: [],
  };
}

test("date-only deadline stays all-day and text is escaped", () => {
  const calendar = calendarForOpportunity(approved(), new Date("2026-09-25T11:00:00Z"));
  assert.ok(calendar);
  assert.match(calendar, /DTSTART;VALUE=DATE:20270203/);
  assert.match(calendar, /DTEND;VALUE=DATE:20270204/);
  assert.match(calendar, /Research\\, Exams\\; Round 2\\nNotice/);
  assert.match(calendar, /\r\n/);
  assert.ok(calendar.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75));
});

test("explicit local cutoff is converted to UTC and exported once", () => {
  const item = approved();
  item.applicationWindow = { ...item.applicationWindow, cutoffLocalTime: "18:30", precision: "minute" };
  const calendar = calendarForOpportunity(item, new Date("2026-09-25T11:00:00Z"));
  assert.match(calendar!, /DTSTART:20270203T130000Z/);
  assert.match(calendar!, /DTEND:20270203T130100Z/);
  assert.equal((calendar!.match(/BEGIN:VEVENT/g) ?? []).length, 1);
});

test("second-precision deadline keeps final published second in calendar", () => {
  const item = approved();
  item.applicationWindow = { ...item.applicationWindow, cutoffLocalTime: "23:59:59", precision: "second" };
  const calendar = calendarForOpportunity(item, new Date("2026-09-25T11:00:00Z"));
  assert.match(calendar!, /DTSTART:20270203T182959Z/);
  assert.match(calendar!, /DTEND:20270203T183000Z/);
});

test("unapproved, unsupported precision, and invalid clock never export a deadline", () => {
  const item = approved();
  item.publicationApproved = false;
  assert.equal(calendarForOpportunity(item), null);
  item.publicationApproved = true;
  item.applicationWindow = { ...item.applicationWindow, precision: "unknown" };
  assert.equal(calendarForOpportunity(item), null);
  item.applicationWindow = { ...item.applicationWindow, precision: "minute", cutoffLocalTime: "18:99" };
  assert.equal(calendarForOpportunity(item), null);
  item.applicationWindow = { ...item.applicationWindow, precision: "minute", cutoffLocalTime: "18:30", officialTimeZone: null };
  assert.equal(calendarForOpportunity(item), null);
  item.applicationWindow = { ...item.applicationWindow, precision: "date", cutoffLocalTime: null };
  assert.match(calendarForOpportunity(item)!, /DTSTART;VALUE=DATE:20270203/);
});

test("verified exam start uses its official zone without inventing exam duration", () => {
  const item = approved();
  item.applicationWindow = { ...item.applicationWindow, closesOn: null };
  item.examEvents = [{ id: "written", label: "Written test", date: "2027-07-01", localTime: "09:00", timezone: "America/New_York", verified: true }];
  const calendar = calendarForOpportunity(item, new Date("2026-09-25T11:00:00Z"));
  assert.match(calendar!, /SUMMARY:Exam starts: Written test/);
  assert.match(calendar!, /DTSTART:20270701T130000Z/);
  assert.match(calendar!, /DTEND:20270701T130100Z/);
});
