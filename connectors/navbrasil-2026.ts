/** Exact-document pilot for one NAV Brasil public employment role. Review only. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Connector } from "./types.ts";
import { cityVenue, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Extraction {
  notice: string;
  indexUrl: string;
  organizerUrl: string;
  documents: { label: string; url: string; sha256: string }[];
  role: string;
  vacancies: number;
  opensOn: string;
  opensAt: string;
  closesOn: string;
  closesAt: string;
  feePaymentClosesOn: string;
  feePaymentClosesAt: string;
  timeZone: string;
}
const extraction = JSON.parse(readFileSync(new URL("../data/extractions/navbrasil-2026-tower-control.json", import.meta.url), "utf8")) as Extraction;

function labeledLinks(html: string) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: match[1], label: stripTags(match[2]).trim() }));
}

export function verifyNavbrasilRegisters(indexHtml: string, organizerHtml: string) {
  const indexLinks = labeledLinks(indexHtml);
  const amendments = indexLinks.filter((link) => /^\d+ª Retificação$/u.test(link.label));
  if (amendments.length !== 2 || amendments.some((link, i) => link.label !== extraction.documents[i + 1].label || link.url !== extraction.documents[i + 1].url)) {
    throw new Error("NAV Brasil amendment register changed; review required");
  }
  for (const document of extraction.documents) {
    if (indexLinks.filter((link) => link.label === document.label && link.url === document.url).length !== 1) {
      throw new Error("NAV Brasil edital or amendment link changed; review required");
    }
  }
  const organizerAmendments = labeledLinks(organizerHtml).filter((link) => /^\d+ª Retificação$/u.test(link.label));
  if (organizerAmendments.length !== 2 || organizerAmendments[0].label !== "2ª Retificação" || organizerAmendments[1].label !== "1ª Retificação") {
    throw new Error("FGV organizer amendment register changed; review required");
  }
}

export const navbrasil2026: Connector = async ({ source, fetchText, fetchBytes, now }) => {
  if (!fetchBytes) throw new Error("NAV Brasil original PDF byte fetch required");
  const [index, organizer] = await Promise.all([
    fetchText(extraction.indexUrl, { accept: "text/html" }),
    fetchText(extraction.organizerUrl, { accept: "text/html" }),
  ]);
  if (index.evidence.url !== extraction.indexUrl || organizer.evidence.url !== extraction.organizerUrl) {
    throw new Error("NAV Brasil or FGV register redirected; review required");
  }
  verifyNavbrasilRegisters(index.text, organizer.text);
  const evidence = [index.evidence, organizer.evidence];
  const sources = [
    evidenceSource(source, index.evidence, "NAV Brasil official concurso 01/2026 document register", "HTML", "Portuguese"),
    evidenceSource(source, organizer.evidence, "FGV official organizer register", "HTML", "Portuguese"),
  ];
  for (const document of extraction.documents) {
    const pdf = await fetchBytes(document.url, { accept: "application/pdf" });
    const hash = createHash("sha256").update(pdf.bytes).digest("hex");
    if (pdf.bytes.subarray(0, 5).toString() !== "%PDF-" || pdf.evidence.url !== document.url || pdf.evidence.sha256 !== hash || hash !== document.sha256) {
      throw new Error(`NAV Brasil ${document.label} changed; extracted applicant rules withheld`);
    }
    evidence.push(pdf.evidence);
    sources.push(evidenceSource(source, pdf.evidence, `NAV Brasil concurso 01/2026: ${document.label}`, "PDF", "Portuguese"));
  }
  const opens = Date.parse(`${extraction.opensOn}T${extraction.opensAt}:00-03:00`);
  const closes = Date.parse(`${extraction.closesOn}T${extraction.closesAt}:00-03:00`);
  const status = now.getTime() < opens ? "upcoming" as const : now.getTime() >= closes ? "closed" as const : "open" as const;
  const cities = ["Macapá", "Palmas", "Santarém", "Belo Horizonte", "São Paulo", "Rio de Janeiro", "Vitória", "Goiânia", "Londrina", "Aracaju", "Teresina"];
  const cycle = makeCycle({
    id: "navbrasil-2026-tower-control-operator", sourceId: source.id,
    title: "Tower Control Operator — NAV Brasil", cycleLabel: "Concurso Público 01/2026 · Profissional Técnico de Navegação Aérea",
    authority: source.authority, pathway: "recruitment", jurisdictionCode: "BR", jurisdictionName: "Brazil",
    scopeLabel: "Federal public company employment under Brazil's CLT labor regime; this is one role option within a multi-role concurso, not 128 separate application cycles.",
    outcome: `${extraction.vacancies} immediate Tower Control Operator public-employment vacancies plus reserve list; initial placement follows training and may be anywhere in NAV Brasil's network.`,
    status,
    statusNote: "Application window closed. Official employer and FGV organizer registers remain available; founder must check later role-specific notices before publication.",
    applicationWindow: { opensOn: extraction.opensOn, closesOn: extraction.closesOn, cutoffLocalTime: extraction.closesAt, officialTimeZone: extraction.timeZone, precision: "minute", note: "Retified edital section 4.1: applications 27 April 2026 16:00 to 28 May 2026 18:00 Brasília time. Fee payment has separate 29 May 23:59 deadline; it is not a new-application deadline." },
    qualifications: "Completed secondary education. Valid unrestricted Aeronautical Medical Certificate, successful Air Traffic Controller training course and operational internship are required at later stages (retified edital Annex I, page 33).",
    citizenshipRule: "Application registration requires CPF but prints no blanket nationality restriction. Before Tower Control training and at appointment, Brazilian nationality qualifies; Portuguese nationality requires Brazil–Portugal Equality Statute status with political rights. Other citizenships do not meet the published later-stage criterion (edital sections 14.3.1 and 19.1(a)).",
    residenceRule: "No applicant domicile requirement printed. Listed airport cities are possible work placements or exam-centre cities, not applicant residence rules.",
    selectionStages: ["FGV online application and R$83.64 fee", "Objective exam: Portuguese 10 and English 20 questions plus other subjects", "Medical and psychological assessments", "Air Traffic Controller training course", "Operational internship", "Employment admission checks"],
    fee: "R$83.64 application fee for secondary-level role. Payment deadline 29 May 2026 at 23:59 Brasília time, separate from application closure.",
    salary: "R$5,944.03 monthly in retified edital role table, subject to employer terms.",
    rules: { complete: false, asOn: null,
      education: { minLevel: "secondary", evidence: "Retified edital Annex I, page 33: Ensino médio completo for Tower Control Operator." },
      nationality: { allowed: ["BR"], conditional: ["PT"], stage: "selection", evidence: "Retified edital 14.3.1 requires Brazilian or Portuguese nationality before training; Portuguese candidates need Equality Statute status and political rights. Section 19.1(a) repeats this for hiring. Application nationality access is not explicitly settled." },
      languages: [
        { language: "pt", stage: "selection", requirement: "Objective exam includes 10 Portuguese-language questions for this secondary-level role; no CEFR or separate minimum proficiency level stated.", evidence: "Retified edital 9.3, page 16, and Annex II syllabus.", sourceUrl: extraction.documents[0].url },
        { language: "en", stage: "selection", requirement: "Objective exam includes 20 English-language questions; second amendment revises English reading syllabus. No CEFR or separate minimum proficiency level stated.", evidence: "Retified edital 9.3, page 16; second amendment 03/2026, pages 2–3.", sourceUrl: extraction.documents[2].url },
      ],
      manualChecks: [
        { stage: "apply", text: "Confirm CPF, payment or waiver, chosen role and any portal nationality gate. No general foreign-citizen application permission is inferred from the absence of a ban." },
        { stage: "selection", text: "Confirm exam result, unrestricted Aeronautical Medical Certificate, psychological assessment and, for Portuguese citizens, recognized Equality Statute status and political rights before training." },
        { stage: "outcome", text: "Confirm successful training and operational internship, citizenship/equality status, medical and employment requirements in edital section 19.1." },
      ],
    },
    venues: cities.map((city) => cityVenue(`${city} objective-exam city (centre assignment may differ)`, city, "BR")),
    sources, applicationUrl: extraction.organizerUrl,
    changes: [{ at: "2026-05-08", kind: "updated", summary: "Second amendment revises English syllabus; this role's application deadline remains 28 May at 18:00." }],
  });
  return { cycles: [cycle], evidence, complete: false, warnings: [
    "Only Tower Control Operator role is extracted; other NAV Brasil 01/2026 roles remain coverage gaps.",
    "Employer and organizer registers show first and second amendments; later role-specific convocations, result changes and admission rules need founder review.",
    "Application-stage foreign nationality access is not explicit. Portuguese Equality Statute status is conditional; no language framework level is printed.",
  ] };
};
