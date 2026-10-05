import { Experience } from "@/components/sections/Experience";
import { DiscoverySpread } from "@/components/discovery/DiscoverySpread";
import { Story } from "@/components/sections/Story";
import { getDiscoverySets, getFragrances } from "@/db/queries";
import { NOTES } from "@/db/seed-data";
import { availability, withNotePhotos } from "@/lib/assets";

// Catalogue edits (prices, copy, stock) in Postgres appear within 5 minutes, no redeploy needed
export const revalidate = 300;

export default async function Home() {
  const [all, sets] = await Promise.all([getFragrances(), getDiscoverySets()]);
  const fragrances = all.map(withNotePhotos);
  const noteAvail = availability([
    ...new Set([...NOTES, ...fragrances.flatMap((f) => f.notes)].map((n) => n.image)),
  ]);
  return (
    <main id="main">
      <Experience fragrances={fragrances} noteAvail={noteAvail} />
      <Story
        feature={fragrances.find((f) => f.slug === "bond") ?? fragrances[0]}
        count={fragrances.length}
      />
      <DiscoverySpread sets={sets} />
    </main>
  );
}
