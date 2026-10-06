import { PageHeader } from "@/components/admin/shell/PageHeader";
import { asc } from "drizzle-orm";
import { fragrances } from "@/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { listBannersAdmin, listVideosAdmin } from "@/server/content";
import { poolDb } from "@/server/db/pool";
import { ContentView } from "./ContentView";

export const metadata = { title: "Content" };

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  await requireAdmin("products.manage");
  const tab = (await searchParams).tab === "videos" ? "videos" : "banners";
  const [banners, videos, perfumes] = await Promise.all([
    listBannersAdmin(),
    listVideosAdmin(),
    poolDb()
      .select({ id: fragrances.id, name: fragrances.name })
      .from(fragrances)
      .orderBy(asc(fragrances.sortOrder)),
  ]);
  return (
    <>
      <PageHeader
        title="Content"
        description="Banners a designer made, and YouTube videos about your perfumes. Nothing shows on the shop until you add it and switch it on. Photos of each perfume (models, campaign) are in Products → Photos."
      />
      <ContentView banners={banners} videos={videos} perfumes={perfumes} tab={tab} />
    </>
  );
}
