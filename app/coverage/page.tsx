import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import CountryDirectory from "@/components/CountryDirectory";
import { withBase } from "@/lib/base-path";
import { coverageLabel, researchLabel } from "@/lib/coverage-labels";
import { dateLabel } from "@/lib/format";
import { jurisdictions } from "@/lib/opportunities";
import { publishedOverview } from "@/lib/published.server";
import { indiaSubdivisions, sortedCountries } from "@/lib/places";
import { isSafeHttpUrl } from "@/lib/safe-url";

export const metadata: Metadata = {
  title: "Where we look",
  description: "Which official sources GOV View checks in each country, when they were last checked, and what is still missing.",
};

export default function CoveragePage() {
  const { demo, sources, status, coverage, counts, approvedCounts, generatedAt } = publishedOverview();
  const countries = sortedCountries();
  const directory = countries.map(({ code, name }) => ({
    code,
    name,
    count: demo ? 0 : counts[code] ?? 0,
    approvedCount: demo ? 0 : approvedCounts[code] ?? 0,
    research: researchLabel(coverage.find((item) => item.jurisdictionCode === code), sources.filter((source) => source.country === code).length),
  }));
  const pilotCodes = new Set(["IN", "US", "GB", "BR", "FR", "JP"]);
  return (
    <div className="app">
      <SiteHeader current="coverage" />
      <div />
      <main className="page">
        <div className="page-inner">
          <h1>Where we look</h1>
          <p className="lede">Not a government website—confirm every notice on its official site. Directory built {dateLabel(generatedAt, "date unavailable")}.</p>
          <p className="lede">
            We only list opportunities from official sources: recruitment boards, public service commissions, regulators and gazettes.
            Here's what we check in each country, when it last worked, and the gaps we know about.
            "Sources checked; no current opportunities found" means we looked. "No verified listings" may mean we have not researched or connected sources yet.
          </p>
          {demo && <p className="lede"><strong>No real data has been published yet, so this page shows demo entries.</strong></p>}
          <p className="lede">This directory contains {jurisdictions.filter((place) => place.inventorySource === "UN M49").length} UN M49 countries and areas plus {jurisdictions.filter((place) => place.inventorySource !== "UN M49").length} documented supplements. Inclusion means a coverage page exists, not that GOV View has researched every authority or audited worldwide coverage. Separately administered jurisdictions without their own code still need inventory review.</p>
          <p className="lede">Source record counts below describe collection only. Public listings require exact evidence and human approval.</p>
          <p><a href="#india-sources">India: browse all 28 states and 8 union territories →</a></p>
          <h2 className="coverage-heading">Collection pilot</h2>
          <div className="coverage-grid">
            {jurisdictions.filter((jurisdiction) => pilotCodes.has(jurisdiction.code)).map((jurisdiction) => {
              const record = coverage.find((item) => item.jurisdictionCode === jurisdiction.code);
              const state = record?.status ?? "no-verified-listings";
              const countrySources = sources.filter((source) => source.country === jurisdiction.code && (jurisdiction.code !== "IN" || !source.subdivisionCodes?.length));
              return (
                <article className="coverage-card" key={jurisdiction.code}>
                  <h3><a href={withBase(`/coverage/${jurisdiction.code}/`)}>{jurisdiction.name}</a></h3>
                  <p className={`coverage-state ${state}`}>{coverageLabel(record)}</p>
                  <dl>
                    <dt>Public records</dt><dd>{demo ? "—" : counts[jurisdiction.code] ?? 0}</dd>
                    <dt>Currently approved records</dt><dd>{demo ? "—" : approvedCounts[jurisdiction.code] ?? 0}</dd>
                    <dt>Last checked</dt><dd>{dateLabel(record?.lastSuccessfulFetchAt, "Never")}</dd>
                  </dl>
                  {!demo && countrySources.length > 0 && (
                    <ul className="source-list">
                      {countrySources.map((source) => {
                        const info = status[source.id];
                        const note = source.connector === "none" ? "Official source linked · adapter not built" : source.reviewRequired ? `Draft connector · founder review pending${info?.pendingReviewCount ? ` · ${info.pendingReviewCount} draft${info.pendingReviewCount === 1 ? "" : "s"}` : ""}${info?.lastSuccessfulFetchAt ? ` · checked ${dateLabel(info.lastSuccessfulFetchAt)}` : ""}${info?.lastError ? ` · last check failed: ${info.lastError}` : ""}` : !source.enabled ? "Not connected" : info?.needsSecret ? "Waiting for a free API key" : info?.lastError ? `Last check failed: ${info.lastError}` : info?.lastSuccessfulFetchAt ? `${info.recordCount} collected records · checked ${dateLabel(info.lastSuccessfulFetchAt)}` : "Not checked yet";
                        return (
                          <li key={source.id}>
                            {isSafeHttpUrl(source.homepage) ? <a href={source.homepage} target="_blank" rel="noopener noreferrer">{source.name}</a> : <span>{source.name}</span>}
                            <small>{note}</small>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {!!record?.unresolvedGaps.length && (<><strong>Known gaps</strong><ul>{record.unresolvedGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></>)}
                  <a href={withBase(`/?country=${jurisdiction.code}`)}>See {jurisdiction.name} opportunities →</a>
                </article>
              );
            })}
          </div>
          <section className="world-directory" aria-labelledby="world-directory-heading">
            <h2 id="world-directory-heading">Worldwide coverage directory</h2>
            <p>Browse each place's official sources, published count, last successful check, validation time and known gaps. Unresearched places are marked plainly.</p>
            <CountryDirectory entries={directory} />
          </section>
          <section aria-labelledby="india-sources" className="india-source-directory">
            <h2 id="india-sources">India: every state and union territory</h2>
            <p>India is our first coverage priority. Official recruitment links are available for all 28 states and 8 union territories. A source link does not mean its notices have been imported or that every department is covered.</p>
            <p>Hiring location does not establish a domicile or language requirement. Those conditions come from each notice.</p>
            <div className="coverage-grid">
              {indiaSubdivisions.map(([code, name]) => {
                const regionalSources = sources.filter((source) => source.country === "IN" && source.subdivisionCodes?.includes(code));
                return <article className="coverage-card" key={code}>
                  <h3><a href={withBase(`/coverage/IN/?state=${code}#official-sources`)}>{name}</a></h3>
                  <ul className="source-list">
                    {regionalSources.map((source) => <li key={source.id}>
                      {isSafeHttpUrl(source.homepage) ? <a href={source.homepage} target="_blank" rel="noopener noreferrer">{source.name} ↗</a> : <span>{source.name}</span>}
                      <small>{source.connector === "none" ? "Official source linked · adapter not built" : source.reviewRequired ? `Draft connector · founder review pending${status[source.id]?.pendingReviewCount ? ` · ${status[source.id].pendingReviewCount} draft${status[source.id].pendingReviewCount === 1 ? "" : "s"}` : ""}${status[source.id]?.lastSuccessfulFetchAt ? ` · checked ${dateLabel(status[source.id].lastSuccessfulFetchAt)}` : ""}${status[source.id]?.lastError ? ` · last check failed: ${status[source.id].lastError}` : ""}` : source.enabled && status[source.id]?.lastError ? "Last check failed · previous records retained" : source.enabled && status[source.id]?.lastSuccessfulFetchAt ? `${status[source.id].recordCount} imported records · checked ${dateLabel(status[source.id].lastSuccessfulFetchAt)}` : "Official source linked · listings not imported"}</small>
                      {source.accessGap && <small>Collection gap: {source.accessGap}</small>}
                      {isSafeHttpUrl(source.discoveredFrom) && <small><a href={source.discoveredFrom} target="_blank" rel="noopener noreferrer">Source identification evidence</a> · {dateLabel(source.discoveredAt)}</small>}
                    </li>)}
                  </ul>
                  <a href={withBase(`/?country=IN&region=${code}`)}>Explore {name} opportunities →</a>
                </article>;
              })}
            </div>
          </section>
          <p className="lede" style={{ marginTop: 32 }}>
            Know an official source we're missing? GOV View is open source — add it to <code>sources/registry.json</code> and open a pull request.
          </p>
        </div>
      </main>
    </div>
  );
}
