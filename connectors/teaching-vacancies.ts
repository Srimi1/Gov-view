/**
 * Teaching Vacancies (Department for Education, England) — official open API.
 * schema.org JobPosting records under the Open Government Licence v3.
 * Postcodes map hiring scope only; school addresses are not selection venues.
 */
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence } from "./types.ts";
import { evidenceSource, itemHash, localDatePart, localTimePart, makeCycle, regionAt, shortHash, slug, stripTags } from "./util.ts";

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
  const workLocations = [...new Set(addresses.map((address) =>
    [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode].filter(Boolean).join(", "),
  ).filter(Boolean))];
  const subdivisionCodes = [...new Set(addresses.flatMap((address) => {
    const postcode = address.postalCode?.toUpperCase().replace(/\s+/g, " ").trim();
    const place = postcode ? places.get(postcode) : undefined;
    const region = place ? regionAt("GB", place.latitude, place.longitude) : null;
    return region ? [region] : [];
  }))];
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
    subdivisionCodes,
    scopeLabel: "State-funded school in England",
    outcome: `${roleNames[job.occupationalCategory ?? ""] ?? "School post"}${job.employmentType?.length ? ` · ${job.employmentType.map((type) => type.replace("_", "-").toLowerCase()).join(", ")}` : ""}`,
    salary: salary ? `${salary}${job.baseSalary?.value?.unitText === "YEAR" ? " a year" : ""}` : undefined,
    applicationWindow: {
      opensOn: null,
      closesOn: closes,
      officialTimeZone: "Europe/London",
      cutoffLocalTime: localTimePart(job.validThrough),
      precision: localTimePart(job.validThrough) ? "minute" : closes ? "date" : "unknown",
      note: job.datePosted ? `Listing posted ${job.datePosted}; application opening date not verified from this feed.` : undefined,
    },
    qualifications: "Check this post's official advert; requirements vary by role.",
    citizenshipRule: "Nationality eligibility not verified from this feed; check the employer's advert and UK right-to-work rules.",
    residenceRule: "Residence requirement not verified from this feed.",
    selectionStages: [],
    fee: "Application fee not verified from this feed.",
    workLocations,
    venues: [{ kind: "unknown", name: "Examination or selection venue not verified from this feed" }],
    sources: [{ ...evidenceSource(source, evidence, "Teaching Vacancies listing", "JSON", "English", job.url), itemSha256: itemHash(job) }],
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

  // Postcodes support regional hiring-scope filters, never venue pins.
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
  log(`${places.size} of ${postcodes.length} postcodes resolved for hiring scope`);
  const cycles = jobs.map(({ job, evidence: pageEvidence }) => toCycle(job, source, pageEvidence, places));
  return { cycles, evidence, warnings, complete: !next, continuation: next ?? undefined };
};
