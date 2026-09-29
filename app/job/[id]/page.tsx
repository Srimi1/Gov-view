import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { withBase } from "@/lib/base-path";
import { cutoffText, dateLabel, pathwayLabels, statusLabels, venueText } from "@/lib/format";
import { liveStatus } from "@/lib/opportunities";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { approvedStaticPage, approvedStaticPages, publicUrl } from "@/lib/static-pages.server";

type Props = { params: Promise<{ id: string }> };

function timestampLabel(value: string | null | undefined, fallback = "Never"): string {
  if (!value || Number.isNaN(Date.parse(value))) return fallback;
  return `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`;
}

export const dynamicParams = false;
// Next static export requires one generated path even when approval queue is empty.
// This reserved path renders 404 and is never listed in the sitemap.
const EMPTY_APPROVAL_PATH = "__no_approved_records__";

export function generateStaticParams() {
  const approved = approvedStaticPages();
  return approved.length ? approved.map(({ id }) => ({ id })) : [{ id: EMPTY_APPROVAL_PATH }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = approvedStaticPage(id);
  if (!item) return { title: "Opportunity not found", robots: { index: false } };
  const close = item.applicationWindow.closesOn;
  const description = `${item.authority} · ${item.jurisdictionName}${close ? ` · Applications close ${dateLabel(close)}` : ""}. Confirm details on the official notice.`;
  return {
    title: item.title,
    description,
    alternates: { canonical: publicUrl(`/job/${encodeURIComponent(id)}/`) },
  };
}

export default async function StaticJobPage({ params }: Props) {
  const { id } = await params;
  const item = approvedStaticPage(id);
  if (!item) notFound();
  const status = liveStatus(item);
  const sources = item.sources.filter((source) => isSafeHttpUrl(source.url));
  const review = item.reviewDecision!;
  const asOf = new Date().toISOString();
  const dates = item.applicationWindow;
  return <div className="app">
    <SiteHeader current="job" />
    <div />
    <main className="page">
      <div className="job-page">
        <a className="back-link" href={withBase(`/?cycle=${encodeURIComponent(item.id)}`)}>← All opportunities</a>
        <article className="job-article">
          <div className="article-scroll">
            <p className="eyebrow">{item.jurisdictionName} · {pathwayLabels[item.pathway]}</p>
            <h1 className="article-title">{item.title}</h1>
            <p className="article-authority">{item.authority}{item.cycleLabel ? ` — ${item.cycleLabel}` : ""}</p>
            <p className="article-status"><span className={`status-tag status-${status}`}>{statusLabels[status]}</span></p>
            {item.statusNote && <p className="status-note">{item.statusNote}</p>}
            <p className="fine-print"><strong>Not a government website—confirm on official site.</strong> Page built as of <time dateTime={asOf}>{timestampLabel(asOf)}</time>. Downloaded copies can become outdated.</p>

            <section>
              <h2>Key dates</h2>
              <dl className="facts stacked">
                <div><dt>Applications open</dt><dd>{dateLabel(dates.opensOn)}</dd></div>
                <div><dt>Applications close</dt><dd>{dateLabel(dates.closesOn)}</dd></div>
                <div><dt>Closing time</dt><dd>{cutoffText(item)}</dd></div>
              </dl>
              {dates.note && <p className="fine-print">{dates.note}</p>}
            </section>

            <section>
              <h2>Eligibility and selection</h2>
              <dl className="facts stacked">
                <div><dt>Qualifications</dt><dd>{item.qualifications}</dd></div>
                <div><dt>Nationality conditions</dt><dd>{item.citizenshipRule}</dd></div>
                <div><dt>Residence conditions</dt><dd>{item.residenceRule}</dd></div>
                <div><dt>Application fee</dt><dd>{item.fee}</dd></div>
                <div><dt>Venue</dt><dd>{venueText(item)}</dd></div>
              </dl>
              <h3>Selection stages</h3>
              <ol className="stages">{item.selectionStages.map((stage) => <li key={stage}>{stage}</li>)}</ol>
            </section>

            {item.syllabus?.status === "verified" && <section>
              <h2>Syllabus · {item.syllabus.edition}</h2>
              <p>Official syllabus language: {item.syllabus.language}</p>
              <ul className="sources">{item.syllabus.officialDocuments.filter((citation) => isSafeHttpUrl(citation.url)).map((citation) =>
                <li key={`${citation.sourceId}-${citation.url}`}><a href={citation.url} target="_blank" rel="noopener noreferrer">Official syllabus ↗</a></li>
              )}</ul>
              {item.syllabus.topics.length > 0 && <ul>{item.syllabus.topics.map((topic, index) => <li key={`${topic.stage}-${topic.subject}-${index}`}>
                <strong>{topic.stage} · {topic.subject}:</strong> {topic.topic}{topic.citation.page ? ` (page ${topic.citation.page})` : ""}
              </li>)}</ul>}
            </section>}

            {!!item.examEvents?.filter((event) => event.verified).length && <section>
              <h2>Exam events</h2>
              <ul>{item.examEvents.filter((event) => event.verified).map((event, index) => <li key={event.id ?? `${event.label}-${index}`}>
                {event.label}: {dateLabel(event.date)}{event.endDate ? `–${dateLabel(event.endDate)}` : ""}{event.localTime ? ` at ${event.localTime}${event.timezone ? ` ${event.timezone}` : ""}` : ""}
              </li>)}</ul>
            </section>}

            {!!item.requiredDocuments?.length && <section>
              <h2>Documents required</h2>
              <ul>{item.requiredDocuments.map((document, index) => <li key={`${document.name}-${index}`}>
                <strong>{document.name}</strong> · {document.stage}{document.conditions ? ` · ${document.conditions}` : ""}{document.specifications ? ` · ${document.specifications}` : ""}
              </li>)}</ul>
            </section>}

            {!!item.structuredFees?.length && <section>
              <h2>Fee details</h2>
              <ul>{item.structuredFees.map((fee, index) => <li key={`${fee.category}-${index}`}>
                <strong>{fee.category}:</strong> {fee.exemption ? "Exempt" : fee.amount === null ? "Amount not specified" : `${fee.amount} ${fee.currency}`}{fee.conditions ? ` · ${fee.conditions}` : ""}
              </li>)}</ul>
            </section>}

            {!!item.imageRequirements?.filter((requirement) => requirement.verified).length && <section>
              <h2>Photo and signature requirements</h2>
              <ul>{item.imageRequirements.filter((requirement) => requirement.verified).map((requirement, index) => <li key={`${requirement.kind}-${index}`}>
                <strong>{requirement.kind === "photo" ? "Photo" : "Signature"}:</strong> {requirement.formats.join(", ")}
                {requirement.width && requirement.height ? ` · ${requirement.width} × ${requirement.height} px` : ""}
                {requirement.maxBytes ? ` · maximum ${requirement.maxBytes.toLocaleString()} bytes` : ""}
              </li>)}</ul>
            </section>}

            <section>
              <h2>Official sources</h2>
              <ul className="sources">
                {sources.map((source) => <li key={source.id}>
                  <div>
                    <a href={source.url!} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
                    <small>{source.authority} · {source.language} · {source.format}</small>
                    <small>Last fetched {timestampLabel(source.lastSuccessfulFetchAt)} · checked {timestampLabel(source.lastValidatedAt)}</small>
                  </div>
                </li>)}
              </ul>
              <p className="fine-print">Reviewed {timestampLabel(review.reviewedAt)}. Evidence revision recorded for this page; check official source again before applying.</p>
            </section>
            <p className="fine-print"><a href={withBase("/job/?id=" + encodeURIComponent(item.id))}>Check eligibility with your browser-local profile</a>. <a href={withBase("/privacy/")}>Privacy details</a>.</p>
          </div>
          <footer className="article-foot">
            {isSafeHttpUrl(item.applicationUrl) && (status === "open" || status === "extended")
              ? <a className="button-primary wide" href={item.applicationUrl} target="_blank" rel="noopener noreferrer">Apply on official site ↗</a>
              : <p>Application link unavailable or application window closed. Check official source.</p>}
          </footer>
        </article>
      </div>
    </main>
  </div>;
}
