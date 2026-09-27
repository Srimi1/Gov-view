"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, CircleHelp, FileText, Link2, MapPin, XCircle } from "lucide-react";
import { evaluateEligibility, profileIsEmpty } from "@/lib/eligibility/evaluate";
import type { ApplicantProfile, Assessment, EligibilityResult } from "@/lib/eligibility/types";
import {
  appointmentTypeLabels,
  cutoffText,
  dateLabel,
  deadlineText,
  deadlineUrgent,
  pathwayLabels,
  resultLabels,
  statusLabels,
  venueText,
} from "@/lib/format";
import type { OpportunityCycle } from "@/lib/opportunities";
import { languageName } from "@/lib/eligibility/languages";
import { approvedRevision } from "@/lib/public-approval";
import CalendarDownload from "@/components/CalendarDownload";
import LocalTracker from "@/components/LocalTracker";
import ImageResizer from "@/components/ImageResizer";
import FeedLinks from "@/components/FeedLinks";

type Props = {
  item: OpportunityCycle;
  profile: ApplicantProfile;
  onEditProfile: () => void;
  onShare?: () => void;
};

export function ResultIcon({ result, size = 16 }: { result: EligibilityResult; size?: number }) {
  if (result === "matches-published-criteria") return <CheckCircle2 size={size} aria-hidden="true" className="tone-ok" />;
  if (result === "does-not-match") return <XCircle size={size} aria-hidden="true" className="tone-bad" />;
  return <CircleHelp size={size} aria-hidden="true" className="tone-warn" />;
}

function AssessmentRow({ label, assessment }: { label: string; assessment: Assessment }) {
  return (
    <details className={`assessment result-${assessment.result}`}>
      <summary>
        <ResultIcon result={assessment.result} size={18} />
        <span className="assessment-label">{label}</span>
        <span className="assessment-result">{resultLabels[assessment.result]}</span>
        <ChevronDown size={14} className="assessment-chevron" aria-hidden="true" />
      </summary>
      <ul>
        {assessment.checks.map((check, index) => (
          <li key={`${check.rule}-${index}`}>
            <ResultIcon result={check.result} size={14} />
            <div>
              <p>{check.reason}</p>
              {check.evidence && <blockquote>{check.evidence}</blockquote>}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Eligibility({ item, profile, onEditProfile }: Props) {
  if (profileIsEmpty(profile)) {
    return (
      <div className="eligibility-empty">
        <p>Add a few details — date of birth, nationality, qualification — and we'll check them against this notice's rules. Nothing leaves your browser.</p>
        <button type="button" className="button-primary" onClick={onEditProfile}>Check if I can apply</button>
      </div>
    );
  }
  const report = evaluateEligibility(item.rules, profile);
  return (
    <>
      <div className="assessments">
        <AssessmentRow label="Can I apply?" assessment={report.canApply} />
        <AssessmentRow label="Can I sit the exam or selection?" assessment={report.canEnterSelection} />
        <AssessmentRow label={item.pathway === "licensing" ? "Can I get the licence?" : item.pathway === "admission" ? "Can I take up the place?" : "Can I be appointed?"} assessment={report.canObtainOutcome} />
      </div>
      <p className="fine-print">
        This is a guide based on the published rules, not a decision. The authority's notice is final.{" "}
        <button type="button" className="link-button" onClick={onEditProfile}>Change my details</button>
      </p>
    </>
  );
}

export default function JobArticle({ item, profile, onEditProfile, onShare }: Props) {
  const dates = item.applicationWindow;
  const approved = !!approvedRevision(item);
  const canApply = approved && !!item.applicationUrl && (item.status === "open" || item.status === "extended");
  const applicationActionLabel = item.applicationMethod ? {
    online: "Apply on the official site",
    post: "Get official postal application form",
    email: "Get official email application instructions",
    "in-person": "View official walk-in instructions",
  }[item.applicationMethod] : "View official application instructions";
  const officialSources = item.sources.filter((source) => source.url);
  return (
    <article className="job-article">
      <div className="article-scroll">
        <p className="eyebrow">{item.jurisdictionName} · {pathwayLabels[item.pathway]}</p>
        <h2 className="article-title">{item.title}</h2>
        <p className="article-authority">{item.authority}{item.cycleLabel ? ` — ${item.cycleLabel}` : ""}</p>
        {officialSources[0]?.url && <p className="fine-print"><a href={officialSources[0].url} target="_blank" rel="noopener noreferrer">Read official source ↗</a> · Last fetched {dateLabel(officialSources[0].lastSuccessfulFetchAt, "never")} · Last reviewed {dateLabel(item.reviewDecision?.reviewedAt ?? item.lastVerifiedAt, "never")}</p>}

        <div className="article-status">
          <span className={`status-tag status-${item.status}`}>{statusLabels[item.status]}</span>
          <span className={deadlineUrgent(item) ? "deadline urgent" : "deadline"}>{deadlineText(item)}</span>
          {onShare && <button type="button" className="icon-button" onClick={onShare} aria-label="Copy link to this page" title="Copy link"><Link2 size={16} /></button>}
        </div>
        {item.reviewPending ? <p className="fine-print">Previous verified version. Newer evidence or source availability awaits review; dates below may have changed. Confirm current details on the official site.</p> : !item.fixture && !approved && <p className="fine-print">This record awaits review against its current official evidence. Confirm every detail on the official site.</p>}
        {item.statusNote && <p className="status-note">{item.statusNote}</p>}

        <section>
          <h3>Key dates</h3>
          {item.reviewPending && <p className="fine-print">Dates from previous verified version; do not rely on them for current applications.</p>}
          <dl className="facts">
            <div><dt>Applications open</dt><dd>{dateLabel(dates.opensOn)}</dd></div>
            <div><dt>Last date</dt><dd>{dateLabel(dates.closesOn)}</dd></div>
            <div><dt>Closing time</dt><dd>{cutoffText(item)}</dd></div>
          </dl>
          {dates.precision === "date" && !dates.cutoffLocalTime && (
            <p className="fine-print">The notice gives a date but no time. Apply well before the end of the day, local time.</p>
          )}
          {dates.note && <p className="fine-print">{dates.note}</p>}
        </section>

        <section>
          <h3>Who can apply</h3>
          {approved || item.fixture ? <Eligibility item={item} profile={profile} onEditProfile={onEditProfile} /> : <p className="fine-print">Eligibility rules await review for this notice. Read official conditions before applying.</p>}
          <dl className="facts stacked">
            <div><dt>Qualifications</dt><dd>{item.qualifications}</dd></div>
          </dl>
        </section>

        <section>
          <h3>International applicants and languages</h3>
          <dl className="facts stacked">
            <div><dt>Nationality conditions</dt><dd>{item.citizenshipRule}</dd></div>
            <div><dt>Residence conditions</dt><dd>{item.residenceRule}</dd></div>
            <div><dt>Work authorisation / visa sponsorship</dt><dd>Not separately verified. Check the official notice and employer requirements before applying.</dd></div>
          </dl>
          {item.languageNote && <p className="fine-print"><strong>Language by post:</strong> {item.languageNote}</p>}
          {item.rules?.languages?.length ? (
            <ul className="language-requirements">
              {item.rules.languages.map((rule, index) => (
                <li key={`${rule.language}-${index}`}>
                  <strong>{languageName(rule.language)}{rule.mandatory === false ? " · desirable" : rule.framework && rule.minimumLevel ? ` · ${rule.framework} ${rule.minimumLevel}` : " · notice-specific requirement"}</strong>
                  <p>{rule.requirement}</p>
                  <p className="fine-print">{rule.mandatory === false ? "Desirable for" : "Required for"} {rule.stage === "apply" ? "application" : rule.stage === "selection" ? "examination / selection" : "appointment / licence"}.</p>
                  {!item.fixture && /^https:\/\//.test(rule.sourceUrl) && <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer">Official language wording ↗</a>}
                </li>
              ))}
            </ul>
          ) : !item.languageNote ? <p className="fine-print">Language level not yet verified for this notice. The language of a webpage or examination guide does not establish a proficiency requirement.</p> : null}
        </section>

        <section>
          <h3>What you get</h3>
          {item.pathway === "recruitment" && <dl className="facts stacked"><div><dt>Appointment type</dt><dd>{item.appointmentType ? appointmentTypeLabels[item.appointmentType] : "Not verified for this notice"}</dd></div></dl>}
          <p>{item.outcome}{item.salary ? ` · ${item.salary}` : ""}</p>
        </section>

        <section>
          <h3>How selection works</h3>
          <ol className="stages">{item.selectionStages.map((stage) => <li key={stage}>{stage}</li>)}</ol>
        </section>

        <section>
          <h3>Syllabus</h3>
          {approved && item.syllabus?.status === "verified" ? (
            <>
              <p>Edition {item.syllabus.edition} · {item.syllabus.language}</p>
              <ul className="source-list">
                {item.syllabus.officialDocuments.map((document, index) => <li key={`${document.sourceId}-${index}`}><a href={document.url} target="_blank" rel="noopener noreferrer">Official syllabus document ↗</a></li>)}
              </ul>
              {item.syllabus.topics.length > 0 && <ul>{item.syllabus.topics.map((topic, index) => <li key={`${topic.stage}-${topic.subject}-${index}`}><strong>{topic.stage} · {topic.subject}:</strong> {topic.topic}{topic.citation.page ? ` (p. ${topic.citation.page})` : ""}</li>)}</ul>}
            </>
          ) : <p className="fine-print">Syllabus topics not yet verified for this programme or cycle. Check the authority's official notice.</p>}
        </section>

        <section>
          <h3>Fee and locations</h3>
          <dl className="facts stacked">
            <div><dt>Application fee</dt><dd>{item.fee}</dd></div>
            {item.workLocations?.length ? <div><dt>Work location</dt><dd>{item.workLocations.join("; ")}</dd></div> : null}
            <div><dt><MapPin size={13} aria-hidden="true" /> Examination / selection venue</dt><dd>{venueText(item)}</dd></div>
          </dl>
          {approved && item.structuredFees?.length ? <ul>{item.structuredFees.map((fee, index) => <li key={index}>{fee.category}: {fee.exemption ? "exempt" : fee.amount === null ? "amount not specified" : `${fee.currency} ${fee.amount}`}{fee.conditions ? ` · ${fee.conditions}` : ""}</li>)}</ul> : null}
        </section>

        <section>
          <h3>Documents and images</h3>
          {approved && item.requiredDocuments?.length ? <ul>{item.requiredDocuments.map((document, index) => <li key={`${document.name}-${index}`}><strong>{document.name}</strong> · {document.stage}{document.conditions ? ` · ${document.conditions}` : ""}{document.specifications ? ` · ${document.specifications}` : ""}</li>)}</ul> : <p className="fine-print">Document list not yet verified for this notice.</p>}
          {approved && item.imageRequirements?.length ? <details><summary>Resize photo or signature locally</summary><ImageResizer key={item.id} requirements={item.imageRequirements} /></details> : null}
        </section>

        <section>
          <h3>Applicant tools</h3>
          <CalendarDownload key={item.id} item={item} />
          <FeedLinks key={item.id} item={item} />
          <details><summary>Saved notice tracker</summary><LocalTracker key={item.id} item={item} /></details>
        </section>

        <section>
          <h3>Official sources</h3>
          <ul className="sources">
            {item.sources.map((source) => (
              <li key={source.id}>
                <FileText size={15} aria-hidden="true" />
                <div>
                  {source.url
                    ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={12} aria-hidden="true" /></a>
                    : <span>{source.title}</span>}
                  <small>{source.authority} · {source.language} · {source.format}</small>
                  <small>Last fetched {dateLabel(source.lastSuccessfulFetchAt, "never")} · checked {dateLabel(source.lastValidatedAt, "never")}</small>
                </div>
              </li>
            ))}
          </ul>
          {!officialSources.length && <p className="fine-print"><AlertTriangle size={13} aria-hidden="true" /> No official link yet. Find the notice on the authority's own website before acting.</p>}
        </section>

        {item.changes.length > 0 && (
          <section>
            <h3>What changed</h3>
            <ul className="history">
              {[...item.changes].sort((a, b) => b.at.localeCompare(a.at)).map((change) => (
                <li key={`${change.at}-${change.kind}`}><time dateTime={change.at}>{dateLabel(change.at)}</time>{change.summary}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="article-foot">
        {canApply ? (
          <>
            <a className="button-primary wide" href={item.applicationUrl!} target="_blank" rel="noopener noreferrer">{applicationActionLabel} <ArrowUpRight size={16} aria-hidden="true" /></a>
            {item.applicationMethod === "post" && <p>Follow postal delivery instructions in official notice. Form must arrive by stated deadline.</p>}
          </>
        ) : (
          <>
            <button type="button" className="button-primary wide" disabled>Apply on the official site</button>
            <p>{item.fixture ? "Demo record — there is no real application." : !approved ? "Application details await review against current official evidence." : item.status === "closed" || item.status === "cancelled" ? "Applications for this cycle are not being accepted." : "We don't have a verified application link yet."}</p>
          </>
        )}
      </footer>
    </article>
  );
}
