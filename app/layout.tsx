import type { Metadata, Viewport } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Both fonts are open licensed and self-hosted by Next at build time.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap", weight: ["600"] });

export const metadata: Metadata = {
  title: { default: "GOV View — government jobs, exams and licences", template: "%s — GOV View" },
  description: "Search official government job openings, recruitment exams, licences and public admissions, check whether you can apply, and go straight to the official notice. Free and open source.",
};

export const viewport: Viewport = {
  themeColor: "#faf8f3",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${publicSans.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
