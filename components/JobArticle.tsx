"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, CircleHelp, FileText, Link2, MapPin, XCircle } from "lucide-react";
import { evaluateEligibility, profileIsEmpty } from "@/lib/eligibility/evaluate";
import type { ApplicantProfile, Assessment, EligibilityResult } from "@/lib/eligibility/types";
import {
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
  const canApply = !!item.applicationUrl && !item.fixture && (item.status === "open" || item.status === "extended");
  const officialSources = item.sources.filter((source) => source.url);
  return (
    <article className="job-article">
      <div className="article-scroll">
        <p className="eyebrow">{item.jurisdictionName} · {pathwayLabels[item.pathway]}</p>
        <h2 className="article-title">{item.title}</h2>
        <p className="article-authority">{item.authority}{item.cycleLabel ? ` — ${item.cycleLabel}` : ""}</p>

        <div className="article-status">
          <span className={`status-tag status-${item.status}`}>{statusLabels[item.status]}</span>
          <span className={deadlineUrgent(item) ? "deadline urgent" : "deadline"}>{deadlineText(item)}</span>
          {onShare && <button type="button" className="icon-button" onClick={onShare} aria-label="Copy link to this page" title="Copy link"><Link2 size={16} /></button>}
        </div>
        {item.statusNote && <p className="status-note">{item.statusNote}</p>}

        <section>
          <h3>Key dates</h3>
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
          <Eligibility item={item} profile={profile} onEditProfile={onEditProfile} />
          <dl className="facts stacked">
            <div><dt>Qualifications</dt><dd>{item.qualifications}</dd></div>
            <div><dt>Nationality</dt><dd>{item.citizenshipRule}</dd></div>
            <div><dt>Residence</dt><dd>{item.residenceRule}</dd></div>
          </dl>
        </section>

        <section>
          <h3>What you get</h3>
          <p>{item.outcome}{item.salary ? ` · ${item.salary}` : ""}</p>
        </section>

        <section>
          <h3>How selection works</h3>
          <ol className="stages">{item.selectionStages.map((stage) => <li key={stage}>{stage}</li>)}</ol>
        </section>

        <section>
          <h3>Fee and venue</h3>
          <dl className="facts stacked">
            <div><dt>Application fee</dt><dd>{item.fee}</dd></div>
            <div><dt><MapPin size={13} aria-hidden="true" /> Where</dt><dd>{venueText(item)}</dd></div>
          </dl>
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
          <a className="button-primary wide" href={item.applicationUrl!} target="_blank" rel="noopener noreferrer">Apply on the official site <ArrowUpRight size={16} aria-hidden="true" /></a>
        ) : (
          <>
            <button type="button" className="button-primary wide" disabled>Apply on the official site</button>
            <p>{item.fixture ? "Demo record — there is no real application." : item.status === "closed" || item.status === "cancelled" ? "Applications for this cycle are not being accepted." : "We don't have a verified application link yet."}</p>
          </>
        )}
      </footer>
    </article>
  );
}
