import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SetSpread } from "@/components/discovery/SetSpread";
import { getDiscoverySets } from "@/db/queries";
import { sizeLabel } from "@/lib/size";
import { listNames } from "@/lib/words";

// Catalogue edits (prices, contents, stock) appear within 5 minutes, no redeploy needed
export const revalidate = 300;

/** Text blocks that rise into place, in order, when the page is reached by navigation */
const enter = (order: number) => ({
  "data-enter": "",
  style: { "--enter": order } as CSSProperties,
});

export async function generateMetadata(): Promise<Metadata> {
  const sets = await getDiscoverySets();
  const first = sets[0];
  return {
    title: "Discovery sets",
    description: first
      ? `Three ZALFI fragrances in small vials, in one box: ${sets
          .map((s) => `${s.name} (${listNames(s.fragrances.map((f) => f.name))})`)
          .join(", ")}.`
      : "ZALFI discovery sets.",
    alternates: { canonical: "/discovery" },
    openGraph: {
      title: "Discovery sets | ZALFI",
      images: first ? [{ url: first.image, width: first.width, height: first.height }] : [],
    },
  };
}

export default async function DiscoveryPage() {
  const sets = await getDiscoverySets();
  if (!sets.length) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const v = sets[0]!.variant!;

  const jsonLd = sets.map((s) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `ZALFI ${s.name}`,
    description: s.story || s.tagline,
    brand: { "@type": "Brand", name: "ZALFI" },
    image: [new URL(s.image, site).toString()],
    category: "Discovery set",
    size: sizeLabel(s.variant!.sizeMl, s.variant!.pieces),
    offers: {
      "@type": "Offer",
      sku: s.variant!.sku,
      price: (s.variant!.pricePoisha / 100).toFixed(2),
      priceCurrency: "BDT",
      availability:
        s.variant!.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(`/discovery#${s.slug}`, site).toString(),
    },
  }));

  return (
    <main id="main" className="bg-bone text-noir px-gutter relative min-h-svh">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="grid grid-cols-12 gap-x-4 gap-y-8 pt-36 pb-16 md:pt-48 md:pb-24">
        <p className="eyebrow text-smoke col-span-12 md:col-span-2" {...enter(0)}>
          Discovery sets
        </p>
        <h1
          className="font-display col-span-12 text-[clamp(3.25rem,9vw,10rem)] leading-[0.88] tracking-[-0.01em] md:col-span-10"
          {...enter(1)}
        >
          Three vials.
          <br />
          <span className="display-italic">One box.</span>
        </h1>
        <p
          className="col-span-12 max-w-md text-lg leading-snug md:col-span-5 md:col-start-3"
          {...enter(2)}
        >
          {`The house in ${sizeLabel(v.sizeMl)} vials, three to a box. Wear each for a day. Then choose your 50 ml.`}
        </p>
      </header>
      {sets.map((s, i) => (
        <SetSpread key={s.slug} set={s} flip={i % 2 === 1} preload={i === 0} />
      ))}
    </main>
  );
}
