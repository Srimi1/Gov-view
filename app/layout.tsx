import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://srimi1.github.io"),
  title: { default: "GOV View — government jobs, exams and licences", template: "%s — GOV View" },
  description: "Search official government job openings, recruitment exams, licences and public admissions, check whether you can apply, and go straight to the official notice. Free and open source.",
};

export const viewport: Viewport = {
  themeColor: "#faf8f3",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
