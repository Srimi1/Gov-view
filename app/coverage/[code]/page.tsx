import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SourceDirectory from "@/components/SourceDirectory";
import { withBase } from "@/lib/base-path";
import { coverageLabel, researchLabel } from "@/lib/coverage-labels";
import { dateLabel } from "@/lib/format";
import { countryCodes, countryName, subdivisionName, subdivisionsByCountry } from "@/lib/places";
import { publishedOverview } from "@/lib/published.server";

type Props = { params: Promise<{ code: string }> };

export function generateStaticParams() {
  return countryCodes.map((code) => ({ code }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  if (!countryCodes.includes(code)) return { title: "Coverage not found" };
  return { title: `${countryName(code)} coverage`, description: `Official-source coverage and known gaps for ${countryName(code)} in GOV View.` };
}

export default async function CountryCoveragePage({ params }: Props) {
  const { code } = await params;
  if (!countryCodes.includes(code)) notFound();
  const name = countryName(code);
  const { demo, sources, status, coverage, counts, approvedCounts, generatedAt } = publishedOverview();
  const record = coverage.find((item) => item.jurisdictionCode === code);
  const registered = sources.filter((source) => source.country === code);
  const sourceEntries = registered.map((source) => {
    const info = status[source.id];
    const collectionStatus = source.connector === "none" ? "Official source linked; adapter not built" : source.reviewRequired ? `Draft collection; founder review pending${info?.pendingReviewCount ? ` (${info.pendingReviewCount} draft${info.pendingReviewCount === 1 ? "" : "s"})` : ""}${info?.lastSuccessfulFetchAt ? `; checked ${dateLabel(info.lastSuccessfulFetchAt)}` : ""}${info?.lastError ? `; last attempt failed: ${info.lastError}` : ""}` : !source.enabled ? "Linked; collection not connected" : info?.needsSecret ? "Waiting for API credentials" : info?.lastError ? `Last attempt failed: ${info.lastError}` : info?.lastSuccessfulFetchAt ? `Last successful check ${dateLabel(info.lastSuccessfulFetchAt)}` : "Not checked yet";
    return {
      id: source.id, name: source.name, authority: source.authority, homepage: source.homepage,
      collectionStatus,
      jurisdictions: (source.subdivisionCodes ?? []).map((code) => ({ code, name: subdivisionName(code) })),
      notes: source.notes, accessGap: source.accessGap,
      discoveredFrom: source.discoveredFrom, discoveredAt: source.discoveredAt,
    };
  });
  const publishedCount = demo ? 0 : counts[code] ?? 0;
  const research = researchLabel(record, registered.length);
  const researchedAuthorities = [...new Set(record?.researchedAuthorities ?? [])];
  const knownGaps = [...new Set([
    ...(record?.unresolvedGaps ?? []),
    ...registered.filter((source) => source.accessGap).map((source) => `${source.name}: ${source.accessGap}`),
  ])];

  return <div className="app">
    <SiteHeader current="coverage" />
    <div />
    <main className="page">
      <div className="page-inner country-coverage">
        <a href={withBase("/coverage/")}>← Worldwide coverage directory</a>
        <h1>{name} <small>{code}</small></h1>
        <p className="lede">{coverageLabel(record)}. {research}. Public count includes only reviewed records or a clearly marked prior approved version; it does not measure all opportunities in {name}.</p>
        <p>Not a government website—confirm on official site. Directory built {dateLabel(generatedAt, "date unavailable")}.</p>
        {demo && <p className="lede"><strong>Demo data is showing. No verified count is available.</strong></p>}
        <dl className="coverage-facts">
          <dt>Public records</dt><dd>{demo ? "—" : publishedCount.toLocaleString()}</dd>
          <dt>Currently approved records</dt><dd>{demo ? "—" : (approvedCounts[code] ?? 0).toLocaleString()}</dd>
          <dt>Official sources registered</dt><dd>{registered.length ? <a href="#official-sources">{registered.length} — search sources</a> : 0}</dd>
          <dt>Sources fetched</dt><dd>{record?.connectedSourceCount ?? 0}</dd>
          <dt>Last successful fetch</dt><dd>{dateLabel(record?.lastSuccessfulFetchAt, "Never")}</dd>
          <dt>Last validation</dt><dd>{dateLabel(record?.lastValidatedAt, "Never")}</dd>
        </dl>
        <section>
          <h2>Researched authorities</h2>
          {researchedAuthorities.length ? <ul>{researchedAuthorities.map((authority) => <li key={authority}>{authority}</li>)}</ul> : <p>None recorded yet.</p>}
        </section>
        <section id="official-sources">
          <h2>Official sources</h2>
          {registered.length ? <SourceDirectory entries={sourceEntries} jurisdictionOptions={(subdivisionsByCountry[code] ?? []).map(([code, name]) => ({ code, name }))} /> : <p>No official source is registered for this place yet. This does not mean there are no opportunities.</p>}
        </section>
        <section>
          <h2>Known gaps</h2>
          {knownGaps.length ? <ul>{knownGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p>{registered.length ? "No source-specific gap recorded. Authority discovery and completeness have not been audited." : "Authority discovery and source connection have not started."}</p>}
          <p>Worldwide authority coverage and source completeness have not passed independent audit.</p>
        </section>
        {code === "IN" && <p><a href={withBase("/coverage/#india-sources")}>Browse all Indian states and union territories →</a></p>}
        <p><a href={withBase(`/?country=${code}`)}>Browse {name} opportunities →</a></p>
      </div>
    </main>
  </div>;
}
