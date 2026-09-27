/**
 * Choisir le service public (France) — every public-sector vacancy across
 * State, territorial and hospital services, published weekly as open data by
 * the DGAFP on data.gouv.fr (Licence Ouverte 2.0).
 * Assignment addresses describe workplaces, not examination venues.
 */
import type { EducationLevel, EligibilityRules } from "../lib/eligibility/types.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence, SourceConfig } from "./types.ts";
import { dayFirstDate, evidenceSource, itemHash, makeCycle, slug } from "./util.ts";

const DATASET = "https://www.data.gouv.fr/api/1/datasets/les-offres-diffusees-sur-choisir-le-service-public/";

/** Semicolon CSV with quoted fields, as exported by the DGAFP. */
export function* parseCsv(text: string, separator = ";"): Generator<string[]> {
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); yield row; row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); yield row; }
}

const levelMap: [RegExp, EducationLevel, string][] = [
  [/Niveau 8/, "doctorate", "Doctorat"],
  [/Niveau 7/, "master", "Master"],
  [/Niveau 6/, "bachelor", "Licence"],
  [/Niveau 5/, "diploma", "Bac +2"],
  [/Niveau 4/, "higher-secondary", "Baccalauréat"],
  [/Niveau 3/, "secondary", "CAP/BEP"],
];

export function educationFromLevel(level: string): { level: EducationLevel; label: string } | null {
  const found = levelMap.find(([pattern]) => pattern.test(level));
  return found ? { level: found[1], label: found[2] } : null;
}

/** "Creuse (23)" → "FR-23"; overseas departments use their ISO letters. */
export function departmentRegion(location: string): string | null {
  const match = /\((\d[\dAB]{1,2})\)/.exec(location);
  if (!match) return null;
  const code = match[1];
  const overseas: Record<string, string> = { "971": "FR-GP", "972": "FR-MQ", "973": "FR-GF", "974": "FR-RE", "976": "FR-YT" };
  return overseas[code] ?? `FR-${code.padStart(2, "0")}`;
}

export function rowToCycle(row: Record<string, string>, source: SourceConfig, evidence: Evidence): OpportunityCycle | null {
  const reference = row["Référence"]?.trim();
  const title = row["Intitulé du poste"]?.trim();
  if (!reference || !title) return null;
  const publishedFrom = dayFirstDate(row["Date de début de publication par défaut"]);
  const publishedUntil = dayFirstDate(row["Date de fin de publication par défaut"]);
  const region = departmentRegion(row["Localisation du poste"] ?? "");
  const workLocations = [...new Set([row["Lieu d'affectation"], row["Lieu d'affectation (sans géolocalisation)"], row["Localisation du poste"]].map((value) => value?.replace(/\s+/g, " ").trim()).filter((value): value is string => Boolean(value)))];
  const education = educationFromLevel(row["Niveau d'études"] ?? "");
  const nature = row["Nature de l'emploi"] ?? "";
  const reservedToCivilServants = /réservé aux fonctionnaires|uniquement aux titulaires/i.test(nature);
  const language = row["Langues"]?.trim();
  const sourceLevel = row["Niveaux"]?.trim();
  const rules: EligibilityRules = {
    asOn: null,
    ...(education ? { education: { minLevel: education.level, evidence: `Niveau d'études : ${row["Niveau d'études"]}` } } : {}),
    manualChecks: reservedToCivilServants
      ? [{ stage: "apply", text: "Offer states a restricted civil-servant route; verify whether concours laureates also qualify and confirm nationality conditions in full offer." }]
      : [{ stage: "apply", text: "Verify whether international applicants may use this post's employment route and whether work authorisation is required." }, { stage: "outcome", text: "Verify nationality and appointment conditions for this specific post." }],
  };
  // The employer field sometimes carries a whole postal address; keep its first line.
  const employer = (row["Employeur"] ?? "").split(/\r?\n/)[0].trim() || row["Organisme de rattachement"]?.trim() || "French public service";
  const category = row["Catégorie"]?.trim();
  return makeCycle({
    id: `fr-${slug(reference, 40)}`,
    title,
    cycleLabel: reference,
    programme: row["Métier"]?.trim() || title,
    authority: employer,
    pathway: "recruitment",
    status: "uncertain",
    statusNote: [...[row["Versant"], category].filter(Boolean), "Published offer; application availability requires offer check"].join(" · "),
    jurisdictionCode: "FR",
    jurisdictionName: "France",
    subdivisionCodes: region ? [region] : [],
    scopeLabel: row["Versant"]?.trim() || "Fonction publique",
    outcome: [row["Métier"], row["Durée du contrat"] ? `contract ${row["Durée du contrat"]}` : "", row["Temps Plein"]?.trim() === "Oui" ? "full time" : ""].filter(Boolean).join(" · "),
    applicationWindow: {
      opensOn: null,
      closesOn: null,
      officialTimeZone: null,
      cutoffLocalTime: null,
      precision: "unknown",
      note: `CSV publication dates${publishedFrom ? ` ${publishedFrom}` : " unknown"}${publishedUntil && publishedUntil < "2090-01-01" ? `–${publishedUntil}` : ""}; application dates and cutoff time need full-offer verification.`,
    },
    qualifications: education ? `${education.label} or equivalent (${row["Niveau d'études"]}).` : "Not stated — see the offer.",
    ...(language || sourceLevel ? { languageNote: `CSV language field: ${language || "not stated"}; source level: ${sourceLevel || "not stated"}. Mandatory status and proficiency-framework equivalence require full-offer verification.` } : {}),
    citizenshipRule: reservedToCivilServants ? "Restricted civil-servant route stated; nationality and concours exceptions need full-offer verification." : "International-applicant eligibility varies by post and appointment route; not verified from this CSV.",
    residenceRule: "Residence requirement not verified from this CSV.",
    selectionStages: [],
    fee: "Application fee not verified from this CSV.",
    rules,
    workLocations,
    venues: [{ kind: "unknown", name: "Examination or selection venue not verified from this CSV" }],
    sources: [{ ...evidenceSource(source, evidence, `Choisir le service public — offer ${reference}`, "CSV", "French", `https://choisirleservicepublic.gouv.fr/nos-offres/filtres/mot-cles/${encodeURIComponent(reference)}/`), itemSha256: itemHash(row) }],
    applicationUrl: `https://choisirleservicepublic.gouv.fr/nos-offres/filtres/mot-cles/${encodeURIComponent(reference)}/`,
  });
}

export const choisirServicePublic: Connector = async ({ source, fetchText, now, log }) => {
  const dataset = JSON.parse((await fetchText(DATASET, { accept: "application/json" })).text) as { resources: { format: string; url: string; last_modified: string; title: string }[] };
  const latest = dataset.resources.filter((resource) => resource.format === "csv" && /offres-datagouv/.test(resource.title)).sort((a, b) => b.last_modified.localeCompare(a.last_modified))[0];
  if (!latest) throw new Error("No CSV resource found in the dataset");
  log(`Using ${latest.title} (${latest.last_modified})`);
  const csv = await fetchText(latest.url, { accept: "text/csv" });

  const today = civilDateIn("Europe/Paris", now);
  let header: string[] | null = null;
  const cycles: OpportunityCycle[] = [];
  const seen = new Set<string>();
  for (const cells of parseCsv(csv.text)) {
    if (!header) { header = cells; continue; }
    const row = Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]));
    const ends = dayFirstDate(row["Date de fin de publication par défaut"]);
    if (!ends || ends < today) continue;
    const cycle = rowToCycle(row, source, csv.evidence);
    if (!cycle || seen.has(cycle.id)) continue;
    seen.add(cycle.id);
    cycles.push(cycle);
  }
  cycles.sort((a, b) => a.id.localeCompare(b.id));
  const total = cycles.length;
  const kept = source.maxRecords ? cycles.slice(0, source.maxRecords) : cycles;
  log(`${total} offers still published; keeping ${kept.length}`);
  return { cycles: kept, evidence: [csv.evidence], totalAvailable: total, complete: kept.length === total, continuation: kept.length < total ? `csv-row:${kept.length}` : undefined, warnings: [] };
};
