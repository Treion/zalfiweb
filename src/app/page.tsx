import { Collection } from "@/components/sections/Collection";
import { Experience } from "@/components/sections/Experience";
import { Newsletter } from "@/components/sections/Newsletter";
import { Story } from "@/components/sections/Story";
import { getFragrances } from "@/db/queries";
import { NOTES } from "@/db/seed-data";
import { availability } from "@/lib/assets";

// Catalogue edits (prices, copy, stock) in Postgres appear within 5 minutes, no redeploy needed
export const revalidate = 300;

export default async function Home() {
  const fragrances = await getFragrances();
  const noteAvail = availability([
    ...new Set([...NOTES, ...fragrances.flatMap((f) => f.notes)].map((n) => n.image)),
  ]);
  return (
    <main id="main">
      <Experience fragrances={fragrances} noteAvail={noteAvail} />
      <Collection fragrances={fragrances} />
      <Story feature={fragrances.find((f) => f.slug === "bond") ?? fragrances[0]} />
      <Newsletter />
    </main>
  );
}
