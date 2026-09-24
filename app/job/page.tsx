import type { Metadata } from "next";
import JobPage from "@/components/JobPage";

export const metadata: Metadata = { title: "Opportunity" };

export default function Page() {
  return <JobPage />;
}
