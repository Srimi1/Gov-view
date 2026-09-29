import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = { title: "Privacy", description: "How GOV View handles browser-local applicant information and site requests." };

export default function PrivacyPage() {
  return <div className="app">
    <SiteHeader current="other" />
    <div />
    <main className="page">
      <div className="page-inner country-coverage">
        <h1>Privacy</h1>
        <p className="lede">Your applicant profile and saved opportunities stay in this browser. GOV View has no account or profile server.</p>
        <section>
          <h2>Information stored on your device</h2>
          <p>Details you enter for eligibility checks, including optional nationality and OCI status, and saved notices stay in this browser. Images selected for resizing are processed locally and are not uploaded. Clear browser storage to remove saved details; other devices do not sync them.</p>
        </section>
        <section>
          <h2>Requests to this site</h2>
          <p>Opening GOV View downloads pages and official-source summaries from the hosting provider. That provider receives ordinary request information, such as IP address and browser headers, and may keep access logs. Following an official link takes you to the authority’s separate website and privacy practices.</p>
        </section>
        <section>
          <h2>Age guidance</h2>
          <p>Enter a date of birth only when needed to check a notice’s age rule. If you are under the age required to use this service without a parent or guardian where you live, ask one to help. GOV View does not ask you to upload identity documents.</p>
        </section>
        <p><a href={withBase("/")}>Return to opportunities</a></p>
      </div>
    </main>
  </div>;
}
