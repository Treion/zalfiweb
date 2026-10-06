import type { MetadataRoute } from "next";
import { INFO_PAGES } from "@/content/pages";
import { getDiscoverySets, getFragrances } from "@/db/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [fragrances, sets] = await Promise.all([getFragrances(), getDiscoverySets()]);
  return [
    { url: site, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/fragrances`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site}/find`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/track`, changeFrequency: "yearly", priority: 0.2 },
    ...(sets.length
      ? [{ url: `${site}/discovery`, changeFrequency: "weekly" as const, priority: 0.7 }]
      : []),
    ...INFO_PAGES.map((p) => ({
      url: `${site}/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...fragrances.map((f) => ({
      url: `${site}/fragrances/${f.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
