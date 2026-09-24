import { UserRound } from "lucide-react";
import { withBase } from "@/lib/base-path";

type Props = {
  current: "explore" | "coverage" | "job";
  onProfile?: () => void;
  hasProfile?: boolean;
};

export function BrandMark() {
  // A simple meridian globe, drawn to sit on the baseline of the wordmark.
  return (
    <svg className="brand-mark" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="11.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="13" cy="13" rx="4.75" ry="11.25" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2.5 9.5h21M2.5 16.5h21" stroke="currentColor" strokeWidth="1.25" fill="none" />
    </svg>
  );
}

export default function SiteHeader({ current, onProfile, hasProfile }: Props) {
  return (
    <header className="site-header">
      <a className="brand" href={withBase("/")}>
        <BrandMark />
        <span>GOV&nbsp;View</span>
      </a>
      <nav aria-label="Main">
        <a href={withBase("/")} aria-current={current === "explore" ? "page" : undefined}><span className="long">Find opportunities</span><span className="short">Search</span></a>
        <a href={withBase("/coverage/")} aria-current={current === "coverage" ? "page" : undefined}><span className="long">Where we look</span><span className="short">Sources</span></a>
      </nav>
      {onProfile && (
        <button type="button" className={`profile-button ${hasProfile ? "has-profile" : ""}`} onClick={onProfile}>
          <UserRound size={16} aria-hidden="true" />
          <span>{hasProfile ? "My details" : "Check my eligibility"}</span>
        </button>
      )}
    </header>
  );
}
