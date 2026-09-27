/** Draft-only Haryana Group-D CET and Group-C prison recruitment notices. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { Connector } from "./types.ts";
import { evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  cycleId: string; indexUrl: string; originalUrl: string; originalSha256: string;
  extensionUrl: string; extensionSha256: string; opensOn: string; originalClosesOn: string;
  closesOn: string; cutoffLocalTime: string; extensionPublishedOn: string;
  feeClosesOn: string; correctionClosesOn: string; applicationUrl: string;
}
interface GroupCExtraction {
  cycleId: string; publicNoticesUrl: string; documentUrl: string; documentSha256: string;
  opensOn: string; closesOn: string; cutoffLocalTime: string; correctionClosesOn: string;
  applicationUrl: string;
  posts: { category: number; group: number; name: string; vacancies: number; minimumEducation: string; generalAge: string }[];
  selectionNotices: { publishedOn: string; kind: string; url: string }[];
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/hssc-cet-group-d-05-2026.json", import.meta.url), "utf8")) as Extraction;
const groupC = JSON.parse(readFileSync(new URL("../data/extractions/hssc-prison-group-c-06-2026.json", import.meta.url), "utf8")) as GroupCExtraction;
export const HSSC_INDEX = extraction.indexUrl;
export const HSSC_ORIGINAL = extraction.originalUrl;
export const HSSC_EXTENSION = extraction.extensionUrl;
export const HSSC_GROUP_C = groupC.documentUrl;
export const HSSC_PUBLIC_NOTICES = groupC.publicNoticesUrl;

export function checkHsscIndex(html: string): void {
  const relevant = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => ({ text: stripTags(match[1]), href: /<a\b[^>]*href="([^"]+)"/i.exec(match[1])?.[1] }))
    .filter((row) => /\b(?:05|06)\/2026\b/.test(row.text));
  const original = relevant.find((row) => /^05\/2026\s+2026-06-18\b/.test(row.text));
  const extension = relevant.find((row) => /^Advt\. No\. 05\/2026 \(Group-D\) Closing Date Extension\s+2026-07-03\b/.test(row.text));
  const prison = relevant.find((row) => /^Advt\. No\. 06\/2026 \(Group-C\)\s+2026-06-22\b/.test(row.text));
  if (relevant.length !== 3 || original?.href !== HSSC_ORIGINAL || extension?.href !== HSSC_EXTENSION || prison?.href !== HSSC_GROUP_C) {
    throw new Error("HSSC 05/2026 or 06/2026 register changed; review new notices and links");
  }
}

export function checkHsscPublicNotices(html: string): void {
  const relevant = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => ({ text: stripTags(match[1]), href: /<a\b[^>]*href="([^"]+)"/i.exec(match[1])?.[1] }))
    .filter((row) => /\b06\/2026\b/.test(row.text));
  if (relevant.length !== groupC.selectionNotices.length || groupC.selectionNotices.some((notice) => {
    const matches = relevant.filter((row) => row.href === notice.url && row.text.includes(notice.publishedOn));
    return matches.length !== 1 || !/PST|PHYSICAL SCREENING TEST/i.test(matches[0].text);
  })) throw new Error("HSSC 06/2026 public-notice set changed; review later notices");
}

export const haryanaSsc: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("HSSC original PDF byte fetch required");
  const index = await fetchText(HSSC_INDEX, { accept: "text/html" });
  if (index.evidence.url !== HSSC_INDEX) throw new Error("HSSC advertisement index redirected; review required");
  checkHsscIndex(index.text);
  const notices = await fetchText(HSSC_PUBLIC_NOTICES, { accept: "text/html" });
  if (notices.evidence.url !== HSSC_PUBLIC_NOTICES) throw new Error("HSSC public notices redirected; review required");
  checkHsscPublicNotices(notices.text);
  const [original, extension, prison] = await Promise.all([
    fetchBytes(HSSC_ORIGINAL, { accept: "application/pdf" }),
    fetchBytes(HSSC_EXTENSION, { accept: "application/pdf" }),
    fetchBytes(HSSC_GROUP_C, { accept: "application/pdf" }),
  ]);
  for (const [document, url, expected] of [
    [original, HSSC_ORIGINAL, extraction.originalSha256],
    [extension, HSSC_EXTENSION, extraction.extensionSha256],
    [prison, HSSC_GROUP_C, groupC.documentSha256],
  ] as const) {
    const hash = createHash("sha256").update(document.bytes).digest("hex");
    if (document.bytes.subarray(0, 5).toString() !== "%PDF-" || document.evidence.url !== url ||
      document.evidence.sha256 !== hash || hash !== expected) {
      throw new Error("HSSC PDF changed; extracted fields withheld");
    }
  }
  const today = civilDateIn("Asia/Kolkata", now);
  const status = today < extraction.opensOn ? "upcoming" : today > extraction.closesOn ? "closed" : "open";
  const cycle = makeCycle({
    id: extraction.cycleId,
    sourceId: source.id,
    title: "Haryana Group-D Common Eligibility Test 2026",
    cycleLabel: "HSSC advertisement 05/2026, extended 3 July 2026",
    programme: "Haryana Group-D Common Eligibility Test",
    authority: source.authority,
    pathway: "recruitment",
    jurisdictionCode: "IN",
    jurisdictionName: "India",
    subdivisionCodes: ["IN-HR"],
    scopeLabel: "Haryana Group-D CET registration; post details published separately, so vacancy count is unknown",
    outcome: "CET score for eligible Haryana Group-D recruitment; qualifying does not by itself award a job or licence",
    status,
    statusNote: "Application close extended to 5 July 2026 at 23:59. Separate fee and correction periods do not reopen applications. Founder review pending.",
    applicationWindow: {
      opensOn: extraction.opensOn,
      closesOn: extraction.closesOn,
      officialTimeZone: "Asia/Kolkata",
      cutoffLocalTime: extraction.cutoffLocalTime,
      cutoffInclusive: true,
      precision: "minute",
      note: "Original PDF page 1 opens registration 19 June and closes 3 July at 11:59 PM; 3 July extension page 1 moves online application close to 5 July at 11:59 PM. Asia/Kolkata is the Haryana local timezone.",
    },
    qualifications: "CET policy page 40: Matric with Hindi or Sanskrit as a subject, Hindi at a higher standard, or the Group-D Employees Act route. Chapter 2 page 3 gives narrower wording for most posts; founder must reconcile exceptions. No formal language level is published.",
    citizenshipRule: "CET policy page 40 permits Indian citizens and Nepal/Bhutan subjects; Nepal/Bhutan subjects need a Government-issued eligibility certificate. Other nationalities cannot enter this CET under the published policy. Final post appointment rules require separate review.",
    residenceRule: "Original PDF page 4 reserves Haryana category benefits for bona fide Haryana residents. Non-resident Indian applicants compete for general posts; no universal Haryana domicile requirement is asserted.",
    selectionStages: ["One-time registration and online CET application", "Offline bilingual Hindi/English Group-D CET; examination date and centre announced separately", "CET merit and post-specific willingness/consent", "Post-specific document verification and appointment checks"],
    fee: "CET processing fee depends on category, Haryana residence and identity number; policy page 41 sets a ₹1,000 standard rate with percentage concessions. Some earlier CET applicants need not pay again. Confirm individual amount on official portal.",
    rules: { complete: false, asOn: extraction.closesOn,
      age: { min: 18, evidence: "Original advertisement page 4: at least 18 on registration closing date. Upper limit 42 has category and service relaxations that require manual review." },
      nationality: { allowed: ["IN"], conditional: ["NP", "BT"], stage: "selection", evidence: "CET policy in original advertisement appendix B, PDF page 40: Indian citizen; Nepal/Bhutan subjects only with Government eligibility certificate; no other categories listed for CET entry. Policy addresses CET entry, not registration form access." },
      languages: [{ language: "hi-or-sa", stage: "apply", requirement: "Matric subject in Hindi or Sanskrit, Hindi at a higher standard, or eligibility under Haryana Group-D Employees Act; no CEFR or numerical proficiency level.", evidence: "Original advertisement chapter 2 page 3 and CET policy appendix B page 40.", sourceUrl: HSSC_ORIGINAL }],
      manualChecks: [
        { stage: "apply", text: "Confirm whether non-Indian candidates can submit the registration form; the cited policy explicitly governs CET entry and does not separately settle form access." },
        { stage: "apply", text: "Confirm Matric qualification and Hindi/Sanskrit alternative under CET policy versus chapter 2; check original documents and any statutory exception." },
        { stage: "apply", text: "Check upper age limit 42 and any Haryana-government relaxation; fee and identity-document route vary." },
        { stage: "selection", text: "For Nepal/Bhutan subjects, verify Government-issued eligibility certificate before CET entry. Exam centre and date were not published in the retained notice." },
        { stage: "outcome", text: "Review separate Group-D post notice, job-specific eligibility and foreign-national appointment rules before treating CET qualification as job eligibility." },
      ],
    },
    venues: [{ kind: "unknown", name: "CET examination centre to be shown on admit card; HSSC office is not an exam venue" }],
    sources: [
      evidenceSource(source, index.evidence, "HSSC advertisement register", "HTML", "English"),
      evidenceSource(source, original.evidence, "HSSC Group-D CET original advertisement 05/2026", "PDF", "English and Hindi"),
      evidenceSource(source, extension.evidence, "HSSC Group-D CET application deadline extension", "PDF", "English"),
    ],
    applicationUrl: extraction.applicationUrl,
    changes: [{ at: extraction.extensionPublishedOn, kind: "extended", summary: `Online application close moved from ${extraction.originalClosesOn} to ${extraction.closesOn} at 23:59 Haryana time; fee close ${extraction.feeClosesOn}, edit close ${extraction.correctionClosesOn}.` }],
  });
  const groupCTodayStatus = today < groupC.opensOn ? "upcoming" : today > groupC.closesOn ? "closed" : "open";
  const prisonCycle = makeCycle({
    id: groupC.cycleId,
    sourceId: source.id,
    title: "Haryana prison Group-C recruitment 2026",
    cycleLabel: "HSSC advertisement 06/2026; two groups, four post categories",
    programme: "Haryana Group-C prison recruitment after CET Phase-I",
    authority: source.authority,
    pathway: "recruitment",
    jurisdictionCode: "IN",
    jurisdictionName: "India",
    subdivisionCodes: ["IN-HR"],
    scopeLabel: `${groupC.posts.reduce((sum, post) => sum + post.vacancies, 0).toLocaleString("en-IN")} Haryana Prison Department vacancies across two examination groups and four post categories; one provisional advertisement-level application cycle`,
    outcome: "Selection for Assistant Superintendent Jail (male or female) or Warder (male or female) posts, subject to role preference, physical standards, verification and appointment rules",
    status: groupCTodayStatus,
    statusNote: "Online applications closed 30 June 2026 at 23:59. Correction period and later physical-screening notices do not reopen applications. Founder must confirm form grouping before approval.",
    applicationWindow: {
      opensOn: groupC.opensOn,
      closesOn: groupC.closesOn,
      officialTimeZone: "Asia/Kolkata",
      cutoffLocalTime: groupC.cutoffLocalTime,
      cutoffInclusive: true,
      precision: "minute",
      note: `Original advertisement page 1 and chapter 1 page 2: online applications 24–30 June 2026 until 11:59 PM. Correction/edit window ends ${groupC.correctionClosesOn}; it is not an application extension. Asia/Kolkata is Haryana local interpretation.`,
    },
    qualifications: "Appendix A pages 19–21: Assistant Superintendent Jail categories 1–2 need graduation and general age 21–27; Warder categories 3–4 need 10+2 and general age 18–25. All require Hindi or Sanskrit as a subject in Matric or Higher Education; no formal proficiency level. Physical height, chest, screening and age relaxations differ by category.",
    citizenshipRule: "Only candidates qualified in Group-C CET advertisement 01/2025 may apply (chapter 1). CET policy in appendix D page 30 permits Indian citizens and Nepal/Bhutan subjects with Government eligibility certificate to enter CET. Other nationalities cannot meet that CET-entry condition under published policy. Prison appointment permission needs post-specific review.",
    residenceRule: "Chapter 6 page 4: Haryana residence is required for specified reservation benefits. Other Indian state/UT candidates may compete for general category posts; no blanket Haryana domicile bar is asserted.",
    selectionStages: ["Group-C CET 01/2025 qualification prerequisite and online application with post preferences", "Physical Measurement Test, then qualifying Physical Screening Test for relevant prison posts", "Bilingual Hindi/English written or skill exam and post-specific merit list", "Document scrutiny and Prison Department appointment checks"],
    fee: "Original advertisement page 1 states no fee for applying against any advertised post.",
    rules: { complete: false, asOn: groupC.closesOn,
      nationality: { allowed: ["IN"], conditional: ["NP", "BT"], stage: "selection", evidence: "Original advertisement chapter 1 page 2 requires Group-C CET 01/2025 qualification. Its appendix D CET policy page 30 permits Indian citizens or Nepal/Bhutan subjects with a Government eligibility certificate to enter CET. Registration form access and prison appointment are not separately established." },
      languages: [{ language: "hi-or-sa", stage: "apply", requirement: "Hindi or Sanskrit as one subject in Matric or Higher Education for each of four post categories; no CEFR or numerical level.", evidence: "Original advertisement appendix A PDF pages 19–21, categories 1–4.", sourceUrl: HSSC_GROUP_C }],
      manualChecks: [
        { stage: "apply", text: "Confirm Group-C CET 01/2025 qualification, role preference and whether groups require separate application forms. Foreign registration form access is not separately stated." },
        { stage: "apply", text: "Apply role-specific graduation versus 10+2, age 21–27 versus 18–25, Hindi/Sanskrit academic subject and all claimed relaxations; one combined draft cannot determine an individual post match." },
        { stage: "selection", text: "Verify Nepal/Bhutan Government eligibility certificate, physical measurement/screening standards, CET marks and later admit-card instructions for the chosen post." },
        { stage: "outcome", text: "Verify Prison Department service rules, documents and foreign-national appointment eligibility for the chosen category." },
      ],
    },
    venues: [{ kind: "unknown", name: "Physical-screening and examination venues are on candidate admit cards; commission office is not a test venue" }],
    sources: [
      evidenceSource(source, index.evidence, "HSSC advertisement register", "HTML", "English"),
      evidenceSource(source, prison.evidence, "HSSC Group-C prison advertisement 06/2026", "PDF", "English and Hindi"),
      evidenceSource(source, notices.evidence, "HSSC public-notice register", "HTML", "English"),
      ...groupC.selectionNotices.map((notice) => evidenceSource(source, notices.evidence, `HSSC 06/2026 ${notice.kind} notice ${notice.publishedOn}`, "PDF", "English", notice.url)),
    ],
    applicationUrl: groupC.applicationUrl,
  });
  return { cycles: [cycle, prisonCycle], evidence: [index.evidence, notices.evidence, original.evidence, extension.evidence, prison.evidence], complete: false, warnings: [
    "Only HSSC advertisements 05/2026 and 06/2026 are extracted; other HSSC advertisements and later amendments remain coverage gaps.",
    "One CET registration cycle is counted; separately published Group-D posts and examination centres are unknown.",
    "Indian citizens may enter CET; Nepal/Bhutan subjects need a Government eligibility certificate; other foreign nationalities are excluded by the published CET policy. Post appointment conditions remain unresolved.",
    "Chapter 2 and policy appendix use different Hindi/Sanskrit qualification wording. Founder must reconcile exceptions; no formal language proficiency level is asserted.",
    "Group-C advertisement 06/2026 has four prison post categories in two examination groups. One application cycle is provisional until founder checks whether each group needs a separate form; role-specific age, degrees and physical standards must be assessed individually.",
    "Later 06/2026 physical-screening notices were linked from the official public-notice register; they are selection updates, not application extensions. Candidate-level lists and venues are not extracted.",
    "HPSC is a separate Haryana authority with robots.txt disallowing automated collection.",
  ] };
};
