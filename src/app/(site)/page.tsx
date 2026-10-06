import { Experience } from "@/components/sections/Experience";
import { BannerCarousel } from "@/components/content/BannerCarousel";
import { getBanners } from "@/server/content/public";
import { DiscoverySpread } from "@/components/discovery/DiscoverySpread";
import { Story } from "@/components/sections/Story";
import { getDiscoverySets, getFragrances } from "@/db/queries";
import { NOTES } from "@/db/seed-data";
import { availability, withNotePhotos } from "@/lib/assets";

// Catalogue edits (prices, copy, stock) in Postgres appear within 5 minutes, no redeploy needed
export const revalidate = 300;

export default async function Home() {
  const [all, sets, banners] = await Promise.all([
    getFragrances(),
    getDiscoverySets(),
    getBanners("home"),
  ]);
  const fragrances = all.map(withNotePhotos);
  const noteAvail = availability([
    ...new Set([...NOTES, ...fragrances.flatMap((f) => f.notes)].map((n) => n.image)),
  ]);
  return (
    <main id="main">
      <Experience fragrances={fragrances} noteAvail={noteAvail} />
      {/* The owner's campaign banners (Admin → Content), after the worlds: each whole, on the
          house dark, one after another; none, and nothing shows */}
      {banners.length > 0 && (
        <section
          aria-label="From the house"
          className="bg-noir text-bone px-gutter relative flex flex-col gap-10 py-20 md:gap-16 md:py-28"
        >
          {banners.map((b) => (
            <BannerCarousel key={b.id} banners={[b]} label={b.headline || b.alt} />
          ))}
        </section>
      )}
      <Story
        feature={fragrances.find((f) => f.slug === "bond") ?? fragrances[0]}
        count={fragrances.length}
      />
      <DiscoverySpread sets={sets} />
    </main>
  );
}
