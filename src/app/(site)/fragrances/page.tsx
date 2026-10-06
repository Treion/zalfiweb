import type { CSSProperties } from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BannerCarousel } from "@/components/content/BannerCarousel";
import { Services } from "@/components/content/Services";
import { VideoCard } from "@/components/content/VideoCard";
import { DiscoverySpread } from "@/components/discovery/DiscoverySpread";
import { CollectionBrowser, FragranceList } from "@/components/product/CollectionBrowser";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { getDiscoverySets, getFragrances } from "@/db/queries";
import { notesInUse } from "@/lib/collection";
import { viewedItems } from "@/lib/viewed";
import { countWord, listNames } from "@/lib/words";
import { getShopTerms } from "@/server/checkout/terms";
import { getBanners, getVideos } from "@/server/content/public";
import { getRatingSummaries } from "@/server/reviews/public";

// Catalogue edits (prices, notes, stock) appear within 5 minutes, no redeploy needed
export const revalidate = 300;

/** Text blocks that rise into place, in order, when the page is reached by navigation */
const enter = (order: number) => ({
  "data-enter": "",
  style: { "--enter": order } as CSSProperties,
});

export async function generateMetadata(): Promise<Metadata> {
  const all = await getFragrances();
  return {
    title: "Shop all fragrances",
    description: `${countWord(all.length, true)} ZALFI eaux de parfum, 50 ml: ${listNames(all.map((f) => f.name))}. Choose by moment, season or note.`,
    alternates: { canonical: "/fragrances" },
    openGraph: { title: "All fragrances | ZALFI" },
  };
}

/**
 * The shop: every fragrance on one calm page, on bone paper. The owner's banners open it (Admin →
 * Content), then the house's services, then the fragrances with filters and a sort. Videos, the
 * discovery sets and what this visitor looked at recently close it. Each part shows only when it
 * has something in it.
 */
export default async function AllFragrancesPage() {
  const [fragrances, sets, banners, terms, ratings, videos] = await Promise.all([
    getFragrances(),
    getDiscoverySets(),
    getBanners("shop"),
    getShopTerms(),
    getRatingSummaries(),
    getVideos(),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "ZALFI fragrances",
    itemListElement: fragrances.map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: new URL(`/fragrances/${f.slug}`, site).toString(),
      name: f.name,
    })),
  };

  return (
    <main id="main" className="bg-bone text-noir relative min-h-svh">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {banners.length > 0 && (
        // Below the header bar, so the nav never sits on the picture
        <div className="px-gutter pt-20 md:pt-24">
          <BannerCarousel banners={banners} eager label="From the house" />
        </div>
      )}
      <div className="px-gutter pb-32">
        <header
          className={`grid grid-cols-12 gap-x-4 gap-y-8 pb-10 md:pb-12 ${banners.length ? "pt-16 md:pt-24" : "pt-36 md:pt-48"}`}
        >
          <p className="eyebrow text-smoke col-span-12 md:col-span-2" {...enter(0)}>
            The collection
          </p>
          <h1
            className="font-display col-span-12 text-[clamp(3.25rem,9vw,10rem)] leading-[0.88] tracking-[-0.01em] md:col-span-10"
            {...enter(1)}
          >
            {countWord(fragrances.length, true)} worlds.
            <br />
            <span className="display-italic">Choose by feel.</span>
          </h1>
          <p
            className="col-span-12 max-w-md text-lg leading-snug md:col-span-6 md:col-start-3"
            {...enter(2)}
          >
            Eau de parfum, 50 ml. Or let{" "}
            <Link href="/find" data-cursor="Discover" className="border-noir border-b">
              three questions
            </Link>{" "}
            choose for you.
          </p>
        </header>
        <Services terms={terms} sets={sets.length > 0} className="mb-6" />
        <Suspense fallback={<FragranceList fragrances={fragrances} ratings={ratings} />}>
          <CollectionBrowser
            fragrances={fragrances}
            notes={notesInUse(fragrances)}
            ratings={ratings}
          />
        </Suspense>
        {videos.length > 0 && (
          <section aria-labelledby="videos-title" className="border-noir/15 mt-32 border-t pt-8">
            <h2 id="videos-title" className="eyebrow text-smoke">
              On YouTube
            </h2>
            <div className="mt-8 grid gap-x-8 gap-y-12 md:grid-cols-2">
              {videos.slice(0, 4).map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </section>
        )}
      </div>
      <DiscoverySpread sets={sets} />
      <div className="px-gutter pb-24">
        <RecentlyViewed items={viewedItems(fragrances)} />
      </div>
    </main>
  );
}
