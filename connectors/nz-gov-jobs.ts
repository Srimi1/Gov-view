/** Two exact New Zealand Government Jobs notices; portal-wide coverage remains a gap. */
import { readFileSync } from "node:fs";
import { civilDateIn } from "../lib/time.ts";
import type { OpportunityCycle } from "../lib/opportunities.ts";
import type { Connector, Evidence, SourceConfig } from "./types.ts";
import { decodeEntities, evidenceSource, makeCycle, stripTags } from "./util.ts";

interface Listing {
  id: string; url: string; title: string; employer: string; location: string; workSite: string;
  positionType: string; listedOn: string; closingDate: string; closesOn: string;
  cutoffLocalTime: string | null; precision: "date" | "minute"; reference: string;
  applicationUrl: string; bodyChecks: string[];
}
const listings = JSON.parse(readFileSync(new URL("../data/extractions/nz-gov-jobs-2026.json", import.meta.url), "utf8")) as Listing[];

/** Bind each proposal to its visible role article, detail table and linked apply target. */
export function verifyNzJob(html: string, listing: Listing): void {
  const heading = /<h1 class="details-heading">([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "";
  const articleStart = html.indexOf('<div class="jobDesc">');
  const detailStart = html.indexOf('<div class="job-details', articleStart);
  const detailEnd = html.indexOf("</table>", detailStart);
  if (articleStart < 0 || detailStart < 0 || detailEnd < 0) throw new Error(`${listing.reference} official job article missing; review required`);
  const article = stripTags(html.slice(articleStart, detailStart)).replace(/\s+/g, " ");
  const details = stripTags(html.slice(detailStart, detailEnd)).replace(/\s+/g, " ");
  const title = stripTags(heading).replace(/\s+/g, " ");
  const applyRaw = /<input type="hidden" value="([^"]+)" id="ApplyURL"/i.exec(html)?.[1] ?? "";
  const applyUrl = decodeEntities(applyRaw).trim();
  if (!title.startsWith(`${listing.title} at ${listing.employer}, ${listing.location}`) ||
      !details.includes(`Employer: ${listing.employer}`) ||
      !details.includes(`Location: ${listing.location}`) ||
      !details.includes(`Position type: ${listing.positionType}`) ||
      !details.includes(`Date listed: ${listing.listedOn}`) ||
      !details.includes(`Closing date: ${listing.closingDate}`) ||
      !details.includes(`Reference: ${listing.reference}`) ||
      !listing.bodyChecks.every((phrase) => article.includes(phrase)) ||
      applyUrl !== listing.applicationUrl) {
    throw new Error(`${listing.reference} official job details changed; review required`);
  }
}

function proposal(listing: Listing, source: SourceConfig, evidence: Evidence, now: Date): OpportunityCycle {
  const probation = listing.reference === "NZ/1946342";
  const pastEverywhere = civilDateIn("Etc/GMT+12", now) > listing.closesOn;
  return makeCycle({
    id: listing.id, sourceId: source.id, title: listing.title,
    programme: probation ? "Ara Poutama Aotearoa probation officer recruitment" : "Ministry of Social Development customer service recruitment",
    cycleLabel: `2026 · ${listing.reference}`,
    authority: listing.employer, pathway: "recruitment",
    appointmentType: "permanent",
    jurisdictionCode: "NZ", jurisdictionName: "New Zealand",
    scopeLabel: `Permanent government job based in ${listing.workSite}. This work location is not a published examination venue.`,
    outcome: probation ? "Permanent, full-time Probation Officer role, 40 hours per week; advertised starting salary NZD 70,596." : "Multiple permanent, full-time customer service roles at Waitakere Contact Centre; advertised salary NZD 63,004–73,903.",
    status: pastEverywhere ? "closed" : "open",
    statusNote: `Official ${listing.reference} job page lists ${listing.closingDate}${listing.cutoffLocalTime ? " at 11:59pm" : ""}. Governing cutoff timezone is not printed; further postings, changes and agency application page need review.`,
    applicationWindow: { opensOn: null, closesOn: listing.closesOn, officialTimeZone: null,
      cutoffLocalTime: listing.cutoffLocalTime, precision: listing.precision,
      note: `Job page lists date first published ${listing.listedOn}, which is not proof of application opening. Official cutoff timezone is not printed.` },
    qualifications: probation ? "Excellent spoken and written communication, full New Zealand driver's licence, and legal right to work in New Zealand. Criminal-history check applies. Large-caseload experience is an advantage, not stated as mandatory." : "Ability to handle inbound calls, give clear information, work rostered shifts and use support systems. Citizenship or Permanent Resident visa is mandatory at application. The page does not specify a degree, age limit or formal language certificate.",
    citizenshipRule: probation ? "Applicants must already have legal right to work in New Zealand. The notice does not impose NZ citizenship and says visa support may be unavailable; a foreign citizen with appropriate existing work rights may be considered, subject to full checks." : "NZ citizenship OR a Permanent Resident visa is required at application. Foreign citizens who hold the stated permanent-resident visa are not excluded by citizenship alone; other foreign applicants do not meet this published condition.",
    residenceRule: probation ? "No separate domicile rule printed. Existing legal NZ work rights are required; verify visa conditions for this role." : "Permanent Resident visa is an alternative to NZ citizenship. No separate applicant domicile rule is printed; verify right to work and agency process.",
    languageNote: probation ? "Excellent spoken and written communication is required. Relevant Māori/Pasifika experience or willingness to learn is prioritised, and language skills may be highlighted. The page gives no mandatory named-language level or certificate." : "The checked job page gives no formal English, te reo Māori or other language proficiency level or certificate. Telephone communication and online assessment are described; verify role-specific language expectations with employer.",
    selectionStages: probation ? ["Online application with CV and cover letter", "Employer screening and interview", "Criminal-history and work-right checks"] : ["Online application and screening question", "Video assessment if shortlisted", "Face-to-face information session and interview; possible skills test", "Two work references", "Internal integrity and Ministry of Justice checks"],
    fee: "No application fee stated on checked job page.",
    salary: probation ? "From NZD 70,596 per year" : "NZD 63,004–73,903 per year",
    rules: { complete: false, asOn: null, manualChecks: probation ? [
      { stage: "apply", text: "Confirm existing legal right to work in New Zealand and full NZ driver's licence. Visa sponsorship is not guaranteed." },
      { stage: "selection", text: "Confirm spoken/written communication, interview requirements and criminal-history declaration with employer." },
      { stage: "outcome", text: "Confirm visa permits this permanent role and employer's final integrity checks." },
    ] : [
      { stage: "apply", text: "Confirm NZ citizenship OR Permanent Resident visa at application; nationality alone cannot decide this alternative." },
      { stage: "selection", text: "Confirm online/video assessment, interview, possible skills testing and any language expectation." },
      { stage: "outcome", text: "Confirm right to work, references and Ministry of Justice/integrity checks." },
    ] },
    venues: [{ kind: "unknown", name: `Selection venue not specified; ${listing.workSite} is job location only` }],
    sources: [evidenceSource(source, evidence, `New Zealand Government Jobs — ${listing.title} (${listing.reference})`, "HTML", "English")],
    applicationMethod: "online", applicationUrl: listing.applicationUrl,
  });
}

export const nzGovJobs: Connector = async ({ source, fetchText, now }) => {
  const cycles: OpportunityCycle[] = [];
  const evidence: Evidence[] = [];
  for (const listing of listings) {
    const page = await fetchText(listing.url, { accept: "text/html" });
    if (page.evidence.url !== listing.url) throw new Error(`${listing.reference} redirected; review required`);
    verifyNzJob(page.text, listing);
    evidence.push(page.evidence);
    cycles.push(proposal(listing, source, page.evidence, now));
  }
  return { cycles, evidence, complete: false, warnings: [
    "This pilot checks two exact public job pages only; other jobs.govt.nz vacancies, agencies, amendments and closures remain coverage gaps.",
    "Linked position descriptions and agency application pages were not fetched; founder must confirm conditions before publication.",
    "Neither notice prints an official cutoff timezone or formal language proficiency level. Distinct NZ citizenship, permanent-resident and work-right routes must not be collapsed.",
  ] };
};
