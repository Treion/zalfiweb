import type { MetadataRoute } from "next";
import { getFragrances } from "@/db/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const fragrances = await getFragrances();
  return [
    { url: site, changeFrequency: "weekly", priority: 1 },
    ...fragrances.map((f) => ({
      url: `${site}/fragrances/${f.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
