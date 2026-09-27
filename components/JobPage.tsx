"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import JobArticle from "@/components/JobArticle";
import ProfileDialog from "@/components/ProfileDialog";
import SiteHeader from "@/components/SiteHeader";
import { useProfile } from "@/components/useProfile";
import { withBase } from "@/lib/base-path";
import { AmbiguousCycleIdError, loadDetailById, loadIndex } from "@/lib/data-client";
import { profileIsEmpty } from "@/lib/eligibility/evaluate";
import { liveStatus, type OpportunityCycle } from "@/lib/opportunities";

/** Shareable page for one opportunity: /job/?id=<id>. */
export default function JobPage() {
  const { profile, update, clear } = useProfile();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<OpportunityCycle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "ambiguous" | "error">("loading");
  const [buildAt, setBuildAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setState("missing"); return; }
    let active = true;
    setState("loading");
    void loadIndex().then((index) => { if (active) setBuildAt(index.generatedAt); }).catch(() => { if (active) setBuildAt(null); });
    loadDetailById(id)
      .then((record) => {
        if (!active) return;
        setItem(record);
        setState(record ? "ready" : "missing");
        if (record) document.title = `${record.title} — GOV View`;
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof AmbiguousCycleIdError) { setCandidates(error.candidates); setState("ambiguous"); }
        else setState("error");
      });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const refresh = () => setItem((current) => {
      if (!current) return current;
      const status = liveStatus(current);
      return status === current.status ? current : { ...current, status };
    });
    const onVisible = () => { if (!document.hidden) refresh(); };
    const delay = 60_000 - (Date.now() % 60_000) + 50;
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      refresh();
      interval = window.setInterval(refresh, 60_000);
    }, delay);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="app">
      <SiteHeader current="job" onProfile={() => setOpen(true)} hasProfile={!profileIsEmpty(profile)} />
      <div />
      <main className="page">
        <div className="job-page">
          <a className="back-link" href={withBase(item ? `/?cycle=${encodeURIComponent(item.id)}` : "/")}><ArrowLeft size={15} aria-hidden="true" />All opportunities</a>
          <p className="fine-print">Not a government website—confirm on official site. Data build as of {buildAt ? new Date(buildAt).toLocaleString() : "unavailable"}.</p>
          {state === "ready" && item && <JobArticle item={item} profile={profile} onEditProfile={() => setOpen(true)} />}
          {state === "loading" && <p className="reader-empty" role="status">Loading…</p>}
          {state === "error" && <div className="empty" role="alert"><p>Could not load this opportunity.</p><button type="button" className="button-quiet" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div>}
          {state === "ambiguous" && <div className="empty"><p>Old link matches multiple editions. Choose current record:</p><ul>{candidates.map((id) => <li key={id}><a href={withBase(`/job/?id=${encodeURIComponent(id)}`)}>{id}</a></li>)}</ul></div>}
          {state === "missing" && (
            <div className="empty">
              <p><strong>We couldn't find this opportunity.</strong></p>
              <p>It may have closed and been removed. <a href={withBase("/")}>Search current opportunities</a>.</p>
            </div>
          )}
        </div>
      </main>
      <ProfileDialog open={open} profile={profile} onClose={() => setOpen(false)} onSave={update} onClear={clear} />
    </div>
  );
}
