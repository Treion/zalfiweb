import type { CSSProperties } from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { DiscoverySpread } from "@/components/discovery/DiscoverySpread";
import { CollectionBrowser, FragranceList } from "@/components/product/CollectionBrowser";
import { getDiscoverySets, getFragrances } from "@/db/queries";
import { notesInUse } from "@/lib/collection";
import { countWord, listNames } from "@/lib/words";

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
    title: "All fragrances",
    description: `${countWord(all.length, true)} ZALFI eaux de parfum, 50 ml: ${listNames(all.map((f) => f.name))}. Choose by moment, season or note.`,
    alternates: { canonical: "/fragrances" },
    openGraph: { title: "All fragrances | ZALFI" },
  };
}

/**
 * Every fragrance on one calm page, on bone paper, with filters (when to wear it, season, notes):
 * the quick way in, next to the home page's slow one. The discovery sets close the page.
 */
export default async function AllFragrancesPage() {
  const [fragrances, sets] = await Promise.all([getFragrances(), getDiscoverySets()]);
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
      <div className="px-gutter pb-32">
        <header className="grid grid-cols-12 gap-x-4 gap-y-8 pt-36 pb-12 md:pt-48 md:pb-16">
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
        <Suspense fallback={<FragranceList fragrances={fragrances} />}>
          <CollectionBrowser fragrances={fragrances} notes={notesInUse(fragrances)} />
        </Suspense>
      </div>
      <DiscoverySpread sets={sets} />
    </main>
  );
}
