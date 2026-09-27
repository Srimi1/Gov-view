/** DNH & DD September 2026 government intakes; exact official documents, draft only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { civilDateIn, clockIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence } from "./types.ts";
import { cityVenue, dayFirstDate, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Row { key: string; title: string; startsOn: string; endsOn: string; url: string; sha256: string }
const manifest = JSON.parse(readFileSync(new URL("../data/extractions/ddd-recruitments-september-2026.json", import.meta.url), "utf8")) as { indexUrl: string; rows: Row[] };
export const DDD_RECRUITMENT_INDEX = manifest.indexUrl;

/** Read current table, including the grant-aided school row that must not become a government job. */
export function checkDddRecruitmentIndex(html: string): void {
  const table = /<table\b[^>]*class=["'][^"']*\bdata-table-1\b[^"']*["'][\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1];
  if (!table) throw new Error("DNH & DD recruitment table missing");
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  if (rows.length !== manifest.rows.length) throw new Error("DNH & DD recruitment row set changed; review required");
  for (const [index, row] of rows.entries()) {
    const expected = manifest.rows[index];
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (cells.length !== 6 || stripTags(cells[0]) !== String(index + 1) || stripTags(cells[1]) !== expected.title || dayFirstDate(stripTags(cells[3])) !== expected.startsOn || dayFirstDate(stripTags(cells[4])) !== expected.endsOn) {
      throw new Error(`DNH & DD ${expected.key} identity or listed dates changed`);
    }
    const links = [...cells[5].matchAll(/<a\b[^>]*href=["']([^"']+\.pdf)["'][^>]*>/gi)].map((match) => match[1]);
    if (links.length !== 1 || links[0] !== expected.url) throw new Error(`DNH & DD ${expected.key} document link changed`);
  }
}

function windowStatus(now: Date, closesOn: string, cutoff: string, opensOn: string | null): OpportunityCycle["status"] {
  const today = civilDateIn("Asia/Kolkata", now);
  if (today > closesOn || (today === closesOn && clockIn("Asia/Kolkata", now) >= cutoff)) return "closed";
  if (opensOn && today < opensOn) return "upcoming";
  return opensOn ? "open" : "uncertain";
}

export const dddRecruitments: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("DNH & DD exact official PDF bytes required");
  const index = await fetchText(DDD_RECRUITMENT_INDEX, { accept: "text/html" });
  if (index.evidence.url !== DDD_RECRUITMENT_INDEX) throw new Error("DNH & DD register redirected");
  checkDddRecruitmentIndex(index.text);
  const documents = new Map<string, Evidence>();
  for (const row of manifest.rows) {
    const pdf = await fetchBytes(row.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== row.url || pdf.evidence.sha256 !== hash || hash !== row.sha256) {
      throw new Error(`DNH & DD ${row.key} PDF changed; extracted fields withheld`);
    }
    documents.set(row.key, pdf.evidence);
  }
  const official = (key: string) => manifest.rows.find((row) => row.key === key)!;
  const evidence = (key: string, title: string, language: string, format: "PDF" | "scanned PDF" = "PDF") => [
    evidenceSource(source, index.evidence, "DNH & DD recruitment register", "HTML", "English"),
    evidenceSource(source, documents.get(key)!, title, format, language),
  ];
  const common = { sourceId: source.id, authority: source.authority, pathway: "recruitment" as const,
    jurisdictionCode: "IN", jurisdictionName: "India", subdivisionCodes: ["IN-DH"],
    citizenshipRule: "The retained notice gives no nationality or foreign-citizen hiring rule. International applicant eligibility requires authority confirmation.",
    residenceRule: "The retained notice gives no blanket DNH & DD domicile condition. Any local preference or age relaxation requires separate review.",
  };
  const poly = official("polytechnic");
  const college = official("engineering-college");
  const hospital = official("namo-hospital");
  const cycles = [
    makeCycle({ ...common, id: "ddd-govt-polytechnic-plastic-lecturer-2026-658",
      title: "Government Polytechnic Daman — Lecturer in Plastic Engineering", cycleLabel: "Advertisement 39.1-EST-GP/2026-27/658",
      scopeLabel: "One short-term contract lecturer post for six months at Government Polytechnic, Daman.",
      outcome: "One Lecturer in Plastic Engineering post; six-month contract, ₹45,000 per month, no claim to regularisation.",
      status: windowStatus(now, poly.endsOn, "17:00", poly.startsOn), statusNote: "English, Hindi and Gujarati notice retained. First extraction needs founder review; postal delivery must reach office by deadline.",
      applicationWindow: { opensOn: poly.startsOn, closesOn: poly.endsOn, cutoffLocalTime: "17:00", officialTimeZone: "Asia/Kolkata", precision: "minute", note: "Notice page 1: receive application 16 September–15 October 2026 by 5 pm. Timezone not printed; Asia/Kolkata is local interpretation. Hand, speed post or courier to Principal, Government Polytechnic, Varkund, Nani Daman 396210." },
      qualifications: "First-class or equivalent bachelor's in Plastic Engineering/Technology from a recognised university; if candidate has a master's, first class may be at bachelor's or master's level. Master's and teaching experience are desirable. Age must not exceed 35; reference date and relaxations are not printed in English notice (page 1).",
      selectionStages: ["Application and document scrutiny", "Interview for eligible candidates; date and venue not stated in this notice"],
      fee: "No application fee stated in retained notice.",
      rules: { complete: false, asOn: null, education: { minLevel: "bachelor", fields: ["Plastic Engineering", "Plastic Technology"], evidence: "Advertisement page 1: first-class or equivalent degree in Plastic Engineering/Technology." },
        languages: [{ language: "gu", stage: "selection", mandatory: false, requirement: "Knowledge of Gujarati is desirable, not stated as mandatory; no proficiency level given.", evidence: "Advertisement page 1, desirable qualification 3.", sourceUrl: poly.url }],
        manualChecks: [{ stage: "apply", text: "Confirm first-class or equivalent grade, recognised university, age reference date and any relaxation with authority." }, { stage: "apply", text: "Confirm nationality and work authorisation; notice states no citizenship rule." }, { stage: "outcome", text: "Confirm interview result and short-term contract appointment conditions." }] },
      venues: [{ kind: "unknown", name: "Interview location not stated; postal application office is not an examination venue." }],
      sources: evidence(poly.key, "Government Polytechnic Lecturer advertisement", "English/Hindi/Gujarati"), applicationUrl: poly.url,
    }),
    makeCycle({ ...common, id: "ddd-govt-engineering-college-biomedical-professor-2026-495",
      title: "Government Engineering College Daman — Assistant Professor in Bio-Medical Engineering", cycleLabel: "Advertisement 1.0-EST-GEC/2026-27/495",
      scopeLabel: "One short-term contract Assistant Professor post for six months at Government Engineering College, Daman.",
      outcome: "One Bio-Medical Engineering Assistant Professor post; six-month contract, ₹50,000 per month, no claim to regularisation.",
      status: windowStatus(now, college.endsOn, "17:00", college.startsOn), statusNote: "Multilingual notice retained; founder must reconcile local-resident selection preference stated in Hindi pages with English wording.",
      applicationWindow: { opensOn: college.startsOn, closesOn: college.endsOn, cutoffLocalTime: "17:00", officialTimeZone: "Asia/Kolkata", precision: "minute", note: "Notice page 1: receive application 10 September–9 October 2026 by 5 pm. Timezone not printed; Asia/Kolkata is local interpretation. Hand, speed post or courier to Principal, Government Engineering College, Varkund, Nani Daman 396210." },
      qualifications: "B.E./B.Tech. and M.E./M.Tech. in Bio-Medical Engineering, with first class or equivalent at either degree level. Age must not exceed 35; age reference date and possible local-worker relaxation require review (notice pages 1–2).",
      selectionStages: ["Application and document scrutiny", "Interview for eligible candidates; date and venue not stated in this notice"],
      fee: "No application fee stated in retained notice.",
      rules: { complete: false, asOn: null, education: { minLevel: "master", fields: ["Bio-Medical Engineering", "Biomedical Engineering"], evidence: "Advertisement page 1: BE/BTech plus ME/MTech in Bio-Medical Engineering, first class or equivalent at either level." },
        manualChecks: [{ stage: "apply", text: "Confirm both required degrees, grade equivalence, age reference date and any relaxation." }, { stage: "apply", text: "Confirm nationality and work authorisation; notice states no citizenship rule." }, { stage: "selection", text: "Confirm whether Daman and Diu local-resident preference in Hindi text applies and how it is scored; it is not an application ban." }] },
      venues: [{ kind: "unknown", name: "Interview location not stated; postal application office is not an examination venue." }],
      sources: evidence(college.key, "Government Engineering College Assistant Professor advertisement", "English/Hindi/Gujarati"), applicationUrl: college.url,
    }),
    makeCycle({ ...common, id: "ddd-namo-hospital-specialists-walkin-2026-1517",
      title: "NAMO Hospital Daman — Specialist recruitment in five disciplines", cycleLabel: "Walk-in notice NAMO/DMN/Specialist/2026-27/1517",
      scopeLabel: "One shared application window and role-named form covering five specialties; 8 vacancies total. Founder to confirm whether post-specific submissions require separate cycle records.",
      outcome: "Short-term contracts: Anaesthetist 2, Ophthalmic Surgeon 2, Paediatrician 2, Orthopaedic Surgeon 1, General Surgeon 1. Monthly pay varies by degree/diploma and experience (notice page 1).",
      status: windowStatus(now, hospital.endsOn, "17:30", null), statusNote: "Scanned three-page notice, visually checked. Index 21 September is listing start, not proven application opening. Application-submission method needs founder confirmation.",
      applicationWindow: { opensOn: null, closesOn: hospital.endsOn, cutoffLocalTime: "17:30", officialTimeZone: "Asia/Kolkata", precision: "minute", note: "Notice page 1: application submission closes 10 October 2026 at 5:30 pm. Index lists 21 September start but PDF does not establish application opening. Timezone not printed; Asia/Kolkata is local interpretation. Presentation may reach office or printed email by same deadline; whether the application itself may be emailed needs confirmation." },
      qualifications: "MBBS with postgraduate degree or diploma (MS/MD/DNB) in relevant specialty from an NMC/MCI-recognised institution, with NMC or State Medical Council registration. Experience is desirable. The form asks age on 15 October 2026 but page 1 states no upper limit (notice pages 1–2).",
      selectionStages: ["Application and document scrutiny", "Walk-in interview 15 October 2026 at 11:00; report by 10:00, Conference Hall, NAMO Hospital, Daman", "Original documents and five-minute professional-achievement presentation"],
      fee: "No application fee stated in retained notice.",
      rules: { complete: false, asOn: null,
        languages: [{ language: "und", stage: "selection", mandatory: false, requirement: "Knowledge of local language is desirable; notice names no specific language or proficiency level.", evidence: "Walk-in notice page 1, desirable qualification 2.", sourceUrl: hospital.url }],
        manualChecks: [{ stage: "apply", text: "Confirm role-specific PG specialty and NMC or State Medical Council registration." }, { stage: "apply", text: "Confirm application submission method and nationality/work authorisation; notice does not resolve either." }, { stage: "selection", text: "Bring original documents and five-minute presentation; interview report at 10:00 on 15 October." }, { stage: "outcome", text: "Confirm medical registration and short-term contract appointment conditions." }] },
      venues: [cityVenue("Conference Hall, NAMO Hospital, Daman (interview; city centre on map)", "Daman", "IN", "IN-DH")],
      sources: evidence(hospital.key, "NAMO Hospital specialist walk-in notice", "English", "scanned PDF"), applicationUrl: hospital.url,
    }),
  ];
  return { cycles, evidence: [index.evidence, ...documents.values()], complete: false, warnings: [
    "Three current government recruitment intakes staged. The grant-aided Sarvajanik Vidyalaya notice is retained but excluded from government-job counts pending scope review.",
    "Two college notices give explicit 17:00 postal cutoffs. NAMO notice gives 17:30 application cutoff but no proven opening date or unambiguous application-submission channel.",
    "No notice establishes general foreign-citizen permission; Gujarati and unnamed local language are desirable only, without formal proficiency levels.",
    "Other DNH & DD departmental sources, the archived recruitment register, later amendments and current grant-aided school scope remain coverage gaps.",
  ] };
};
