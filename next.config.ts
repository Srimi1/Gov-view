import type { NextConfig } from "next";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

// Static export: the whole site is plain files, so it can be hosted free
// (Cloudflare Pages, GitHub Pages, Netlify). No server, no database.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
