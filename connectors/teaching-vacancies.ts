/**
 * Teaching Vacancies (Department for Education, England) — official open API.
 * schema.org JobPosting records under the Open Government Licence v3.
 * Postcodes are placed with postcodes.io (ONS open data), so pins are exact.
 */
import type { OpportunityCycle, Venue } from "../lib/opportunities.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, localDatePart, localTimePart, makeCycle, regionAt, shortHash, slug, stripTags } from "./util.ts";

const FIRST_PAGE = "https://teaching-vacancies.service.gov.uk/api/v1/jobs.json";

interface Address { addressLocality?: string; addressRegion?: string; streetAddress?: string; postalCode?: string; addressCountry?: string }
export interface JobPosting {
  title: string;
  datePosted?: string;
  validThrough?: string;
  url: string;
  employmentType?: string[];
  occupationalCategory?: string;
  hiringOrganization?: { name?: string; identifier?: string };
  jobLocation?: { address?: Address } | { address?: Address }[];
  baseSalary?: { value?: { value?: string; unitText?: string } };
  description?: string;
}

const locations = (job: JobPosting): Address[] =>
  (Array.isArray(job.jobLocation) ? job.jobLocation : job.jobLocation ? [job.jobLocation] : []).flatMap((item) => (item.address ? [item.address] : []));

const roleNames: Record<string, string> = {
  teacher: "Teacher",
  higher_level_teaching_assistant: "Higher level teaching assistant",
  teaching_assistant: "Teaching assistant",
  education_support: "Education support",
  sendco: "SENCO",
  headteacher: "Headteacher",
  deputy_headteacher: "Deputy headteacher",
  assistant_headteacher: "Assistant headteacher",
  head_of_year_or_phase: "Head of year or phase",
  head_of_department_or_curriculum: "Head of department",
  other_support: "Support staff",
};

export function toCycle(job: JobPosting, source: Parameters<Connector>[0]["source"], evidence: Evidence, places: Map<string, { latitude: number; longitude: number }>): OpportunityCycle {
  const school = job.hiringOrganization?.name?.trim() || "School";
  const addresses = locations(job);
  const venues: Venue[] = addresses.map((address) => {
    const place = address.postalCode ? places.get(address.postalCode.toUpperCase().replace(/\s+/g, " ").trim()) : undefined;
    const name = [school, address.addressLocality].filter(Boolean).join(", ");
    if (!place) return { kind: "unknown", name: `${name}${address.postalCode ? ` (${address.postalCode})` : ""}` };
    return {
      kind: "published",
      name: school,
      city: address.addressLocality ?? address.postalCode ?? "",
      latitude: place.latitude,
      longitude: place.longitude,
      precision: "exact",
      subdivision: regionAt("GB", place.latitude, place.longitude) ?? undefined,
    };
  });
  const closes = localDatePart(job.validThrough);
  const salary = job.baseSalary?.value?.value;
  const summary = stripTags(job.description ?? "").slice(0, 280);
  return makeCycle({
    id: `tv-${slug(job.url.split("/").pop() ?? job.title, 70)}-${shortHash(job.url, 6)}`,
    title: job.title.trim(),
    authority: school,
    programme: roleNames[job.occupationalCategory ?? ""] ?? "School job",
    pathway: "recruitment",
    status: "open",
    statusNote: summary ? `${summary}${summary.length >= 280 ? "…" : ""}` : "",
    jurisdictionCode: "GB",
    jurisdictionName: "United Kingdom",
    subdivisionCodes: [...new Set(venues.flatMap((venue) => (venue.kind === "published" && venue.subdivision ? [venue.subdivision] : [])))],
    scopeLabel: "State-funded school in England",
    outcome: `${roleNames[job.occupationalCategory ?? ""] ?? "School post"}${job.employmentType?.length ? ` · ${job.employmentType.map((type) => type.replace("_", "-").toLowerCase()).join(", ")}` : ""}`,
    salary: salary ? `${salary}${job.baseSalary?.value?.unitText === "YEAR" ? " a year" : ""}` : undefined,
    applicationWindow: {
      opensOn: job.datePosted ?? null,
      closesOn: closes,
      officialTimeZone: "Europe/London",
      cutoffLocalTime: localTimePart(job.validThrough),
      precision: localTimePart(job.validThrough) ? "minute" : closes ? "date" : "unknown",
    },
    qualifications: job.occupationalCategory === "teacher" ? "Usually qualified teacher status (QTS) — see the advert." : "See the advert.",
    citizenshipRule: "You need the right to work in the UK.",
    residenceRule: "No residence requirement stated.",
    selectionStages: ["Application", "Shortlisting", "Interview", "Safer recruitment checks (enhanced DBS)"],
    fee: "Free to apply.",
    venues: venues.length ? venues : [{ kind: "unknown", name: "Location not given" }],
    sources: [evidenceSource(source, evidence, "Teaching Vacancies listing", "JSON", "English", job.url)],
    applicationUrl: job.url,
  });
}

export const teachingVacancies: Connector = async ({ source, fetchText, log }) => {
  const jobs: { job: JobPosting; evidence: Evidence }[] = [];
  const evidence: Evidence[] = [];
  let next: string | null = FIRST_PAGE;
  let pages = 0;
  while (next && pages < 200) {
    const page = await fetchText(next, { accept: "application/json" });
    evidence.push(page.evidence);
    const body = JSON.parse(page.text) as { data: JobPosting[]; links?: { next?: string | null } };
    for (const job of body.data) jobs.push({ job, evidence: page.evidence });
    next = body.links?.next ?? null;
    pages += 1;
  }
  log(`${jobs.length} vacancies over ${pages} pages`);

  // Exact coordinates for each postcode, 100 at a time.
  const postcodes = [...new Set(jobs.flatMap(({ job }) => locations(job).flatMap((address) => (address.postalCode ? [address.postalCode.toUpperCase().replace(/\s+/g, " ").trim()] : []))))];
  const places = new Map<string, { latitude: number; longitude: number }>();
  const warnings: string[] = [];
  for (let i = 0; i < postcodes.length; i += 100) {
    try {
      const batch = postcodes.slice(i, i + 100);
      const response = await fetchText("https://api.postcodes.io/postcodes", { method: "POST", body: JSON.stringify({ postcodes: batch }), accept: "application/json" });
      const body = JSON.parse(response.text) as { result: { query: string; result: { latitude: number; longitude: number } | null }[] };
      for (const item of body.result) {
        if (item.result && Number.isFinite(item.result.latitude)) places.set(item.query.toUpperCase().replace(/\s+/g, " ").trim(), { latitude: item.result.latitude, longitude: item.result.longitude });
      }
    } catch (error) {
      warnings.push(`Postcode lookup failed: ${(error as Error).message}`);
    }
  }
  log(`${places.size} of ${postcodes.length} postcodes placed`);
  const cycles = jobs.map(({ job, evidence: pageEvidence }) => toCycle(job, source, pageEvidence, places));
  return { cycles, evidence, warnings };
};
