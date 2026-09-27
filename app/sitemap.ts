import type { MetadataRoute } from "next";
import { countryCodes } from "@/lib/places";
import { approvedStaticPages, publicUrl } from "@/lib/static-pages.server";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: publicUrl("/"), changeFrequency: "daily" },
    { url: publicUrl("/coverage/"), changeFrequency: "weekly" },
    ...countryCodes.map((code) => ({ url: publicUrl(`/coverage/${code}/`), changeFrequency: "weekly" as const })),
    ...approvedStaticPages().map((item) => ({
      url: publicUrl(`/job/${encodeURIComponent(item.id)}/`),
      lastModified: item.reviewDecision?.reviewedAt ?? undefined,
      changeFrequency: "daily" as const,
    })),
  ];
}
