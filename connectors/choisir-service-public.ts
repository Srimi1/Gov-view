/**
 * Choisir le service public (France) — every public-sector vacancy across
 * State, territorial and hospital services, published weekly as open data by
 * the DGAFP on data.gouv.fr (Licence Ouverte 2.0).
 * Communes come from geo.api.gouv.fr in one request, so venues sit on the
 * commune centre rather than a guessed city.
 */
import type { EducationLevel, EligibilityRules } from "../lib/eligibility/types.ts";
import type { OpportunityCycle, Venue } from "../lib/opportunities.ts";
import { civilDateIn } from "../lib/time.ts";
import type { Connector, Evidence, SourceConfig } from "./types.ts";
import { dayFirstDate, evidenceSource, makeCycle, slug } from "./util.ts";

const DATASET = "https://www.data.gouv.fr/api/1/datasets/les-offres-diffusees-sur-choisir-le-service-public/";
const COMMUNES = "https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,centre,codeDepartement&format=json";

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

export interface Commune { nom: string; codesPostaux: string[]; centre?: { coordinates: [number, number] }; codeDepartement: string }
export interface CommuneIndex { byPostcode: Map<string, Commune[]>; byName: Map<string, Commune[]> }

const placeKey = (text: string) => text.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/^(st|ste)\b/, (m) => (m === "st" ? "saint" : "sainte")).replace(/[^a-z0-9]+/g, " ").trim();

export function indexCommunes(list: Commune[]): CommuneIndex {
  const byPostcode = new Map<string, Commune[]>();
  const byName = new Map<string, Commune[]>();
  for (const commune of list) {
    for (const postcode of commune.codesPostaux) byPostcode.set(postcode, [...(byPostcode.get(postcode) ?? []), commune]);
    const key = `${commune.codeDepartement}:${placeKey(commune.nom)}`;
    byName.set(key, [...(byName.get(key) ?? []), commune]);
  }
  return { byPostcode, byName };
}

/** "…, 75018 PARIS", "35703 RENNES CEDEX 7", "PARIS 04" → city name without cedex or arrondissement. */
export function cleanCity(text: string): string {
  return text.split(/\s[–—-]\s|,|\(|\//)[0].replace(/\bcedex\b.*$/i, "").replace(/\s+\d{1,2}(e|er|ème)?$/i, "").replace(/\s+/g, " ").trim();
}

function departmentsFor(postcode: string | undefined, region: string | null): string[] {
  if (postcode) {
    if (postcode.startsWith("97")) return [postcode.slice(0, 3)];
    if (postcode.startsWith("20")) return ["2A", "2B"];
    return [postcode.slice(0, 2)];
  }
  const code = region?.replace(/^FR-/, "");
  return code && /^\d/.test(code) ? [code] : [];
}

export function venueFor(place: string, fallbackCity: string, region: string | null, communes: CommuneIndex): Venue {
  const text = place.replace(/\s+/g, " ").trim();
  const postcodes = [...text.matchAll(/\b(\d{5})\b/g)];
  const last = postcodes.at(-1);
  const postcode = last?.[1];
  const afterPostcode = last ? text.slice((last.index ?? 0) + 5) : "";
  // Try the text after the postcode, the plain city field, then each address segment from the end.
  const segments = text.split(/\s[–—-]\s|,|:/).reverse();
  const candidatesText = [afterPostcode, fallbackCity, ...segments].map(cleanCity).filter(Boolean);
  let commune: Commune | undefined;
  const byCode = postcode ? communes.byPostcode.get(postcode) ?? [] : [];
  for (const name of candidatesText) {
    commune = byCode.find((item) => placeKey(item.nom) === placeKey(name));
    if (commune) break;
    for (const department of departmentsFor(postcode, region)) {
      const found = communes.byName.get(`${department}:${placeKey(name)}`);
      if (found?.length === 1) { commune = found[0]; break; }
    }
    if (commune) break;
  }
  if (!commune && byCode.length === 1) commune = byCode[0];
  if (!commune?.centre) return { kind: "unknown", name: text || fallbackCity || "Location not given" };
  const [longitude, latitude] = commune.centre.coordinates;
  return { kind: "published", name: text || commune.nom, city: commune.nom, latitude, longitude, precision: "city", subdivision: region ?? undefined };
}

export function rowToCycle(row: Record<string, string>, source: SourceConfig, evidence: Evidence, communes: CommuneIndex): OpportunityCycle | null {
  const reference = row["Référence"]?.trim();
  const title = row["Intitulé du poste"]?.trim();
  if (!reference || !title) return null;
  let closes = dayFirstDate(row["Date de fin de publication par défaut"]);
  if (closes && closes >= "2090-01-01") closes = null; // placeholder "no end date"
  const region = departmentRegion(row["Localisation du poste"] ?? "");
  const venue = venueFor(row["Lieu d'affectation"] ?? "", row["Lieu d'affectation (sans géolocalisation)"] ?? "", region, communes);
  const education = educationFromLevel(row["Niveau d'études"] ?? "");
  const nature = row["Nature de l'emploi"] ?? "";
  const reservedToCivilServants = /réservé aux fonctionnaires|uniquement aux titulaires/i.test(nature);
  const contractOnly = /uniquement aux contractuels/i.test(nature);
  const rules: EligibilityRules = {
    asOn: null,
    ...(education ? { education: { minLevel: education.level, evidence: `Niveau d'études : ${row["Niveau d'études"]}` } } : {}),
    manualChecks: reservedToCivilServants
      ? [{ stage: "apply", text: "Reserved for existing French civil servants (fonctionnaires) or people who passed the relevant concours." }]
      : contractOnly ? [] : [{ stage: "outcome", text: "Appointment as a civil servant (titulaire) needs EU/EEA or Swiss nationality; contract posts are open more widely." }],
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
    status: "open",
    statusNote: [row["Versant"], category].filter(Boolean).join(" · "),
    jurisdictionCode: "FR",
    jurisdictionName: "France",
    subdivisionCodes: region ? [region] : [],
    scopeLabel: row["Versant"]?.trim() || "Fonction publique",
    outcome: [row["Métier"], row["Durée du contrat"] ? `contract ${row["Durée du contrat"]}` : "", row["Temps Plein"]?.trim() === "Oui" ? "full time" : ""].filter(Boolean).join(" · "),
    applicationWindow: {
      opensOn: dayFirstDate(row["Date de début de publication par défaut"]),
      closesOn: closes,
      officialTimeZone: "Europe/Paris",
      cutoffLocalTime: null,
      precision: closes ? "date" : "unknown",
      note: closes ? "Last day the offer is published; the employer may close it earlier." : undefined,
    },
    qualifications: education ? `${education.label} or equivalent (${row["Niveau d'études"]}).` : "Not stated — see the offer.",
    citizenshipRule: reservedToCivilServants ? "Reserved for serving civil servants or concours laureates." : "Civil-servant posts need EU/EEA/Swiss nationality; contract posts are open to other nationalities.",
    residenceRule: "No residence requirement stated.",
    selectionStages: ["Application", "Interview"],
    fee: "Free to apply.",
    rules,
    venues: [venue],
    sources: [evidenceSource(source, evidence, `Choisir le service public — offer ${reference}`, "CSV", "French", `https://choisirleservicepublic.gouv.fr/nos-offres/filtres/mot-cles/${encodeURIComponent(reference)}/`)],
    applicationUrl: `https://choisirleservicepublic.gouv.fr/nos-offres/filtres/mot-cles/${encodeURIComponent(reference)}/`,
  });
}

export const choisirServicePublic: Connector = async ({ source, fetchText, now, log }) => {
  const dataset = JSON.parse((await fetchText(DATASET, { accept: "application/json" })).text) as { resources: { format: string; url: string; last_modified: string; title: string }[] };
  const latest = dataset.resources.filter((resource) => resource.format === "csv" && /offres-datagouv/.test(resource.title)).sort((a, b) => b.last_modified.localeCompare(a.last_modified))[0];
  if (!latest) throw new Error("No CSV resource found in the dataset");
  log(`Using ${latest.title} (${latest.last_modified})`);
  const csv = await fetchText(latest.url, { accept: "text/csv" });
  const communeList = JSON.parse((await fetchText(COMMUNES, { accept: "application/json" })).text) as Commune[];
  const communes = indexCommunes(communeList);

  const today = civilDateIn("Europe/Paris", now);
  let header: string[] | null = null;
  const cycles: OpportunityCycle[] = [];
  const seen = new Set<string>();
  for (const cells of parseCsv(csv.text)) {
    if (!header) { header = cells; continue; }
    const row = Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]));
    const ends = dayFirstDate(row["Date de fin de publication par défaut"]);
    if (!ends || ends < today) continue;
    const cycle = rowToCycle(row, source, csv.evidence, communes);
    if (!cycle || seen.has(cycle.id)) continue;
    seen.add(cycle.id);
    cycles.push(cycle);
  }
  cycles.sort((a, b) => (b.applicationWindow.opensOn ?? "").localeCompare(a.applicationWindow.opensOn ?? ""));
  const total = cycles.length;
  const kept = source.maxRecords ? cycles.slice(0, source.maxRecords) : cycles;
  log(`${total} offers still published; keeping ${kept.length}`);
  return { cycles: kept, evidence: [csv.evidence], totalAvailable: total, warnings: [] };
};
