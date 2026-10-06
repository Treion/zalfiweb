import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import { NotesPyramid } from "@/components/product/NotesPyramid";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ScentProfile } from "@/components/product/ScentProfile";
import { SimilarWorlds } from "@/components/product/SimilarWorlds";
import { DeliveryNote } from "@/components/product/DeliveryNote";
import { RatingLine, Reviews } from "@/components/product/Reviews";
import { getReviews } from "@/server/reviews/public";
import { getShopTerms } from "@/server/checkout/terms";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { BOTTLE_MODELS } from "@/components/stage/model-manifest";
import { SetHint } from "@/components/discovery/SetHint";
import { getDiscoverySets, getFragrance, getFragrances } from "@/db/queries";
import { availability, withNotePhotos } from "@/lib/assets";
import { similarWorlds } from "@/lib/finder";
import { NOTE_LAYERS, notesByLayer, worldVars } from "@/lib/fragrance";

export const revalidate = 300;

/** Text blocks that rise into place, in order, when the page is reached by navigation */
const enter = (order: number) => ({
  "data-enter": "",
  style: { "--enter": order } as CSSProperties,
});

export async function generateStaticParams() {
  return (await getFragrances()).map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/fragrances/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const f = await getFragrance(slug);
  if (!f) return {};
  const notes = NOTE_LAYERS.flatMap((l) => notesByLayer(f, l).map((n) => n.label)).join(", ");
  return {
    title: `${f.name}, eau de parfum`,
    description: `${f.tagline} Notes of ${notes}.`,
    alternates: { canonical: `/fragrances/${f.slug}` },
    openGraph: { title: `${f.name} | ZALFI`, description: f.tagline, type: "website" },
  };
}

export default async function FragrancePage({ params }: PageProps<"/fragrances/[slug]">) {
  const { slug } = await params;
  const [all, sets, terms, reviews] = await Promise.all([
    getFragrances(),
    getDiscoverySets(),
    getShopTerms(),
    getReviews("fragrance", slug),
  ]);
  const index = all.findIndex((x) => x.slug === slug);
  if (!all[index]) notFound();
  const f = withNotePhotos(all[index]);
  const next = all[(index + 1) % all.length];
  const noteAvail = availability(f.notes.map((n) => n.image));
  const from = f.variants[0];
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `ZALFI ${f.name}`,
    description: f.story,
    brand: { "@type": "Brand", name: "ZALFI" },
    image: [f.bottleImage, ...f.images.map((i) => i.url)].map((u) => new URL(u, site).toString()),
    category: "Eau de parfum",
    offers: f.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      price: (v.pricePoisha / 100).toFixed(2),
      priceCurrency: "BDT",
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(`/fragrances/${f.slug}`, site).toString(),
    })),
    ...(reviews && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviews.average,
        reviewCount: reviews.count,
        bestRating: 5,
        worstRating: 1,
      },
      review: reviews.reviews.slice(0, 5).map((r) => ({
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
        author: { "@type": "Person", name: r.name },
        datePublished: r.date.slice(0, 10),
        ...(r.body && { reviewBody: r.body }),
      })),
    }),
  };

  return (
    <main
      id="main"
      className="world-surface text-world-ink static:bg-world-bg relative"
      style={worldVars(f)}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="px-gutter grid grid-cols-12 gap-x-4">
        {/* The bottle, lit live by the stage (DOM photo until then, and for reduced motion) */}
        <div className="col-span-12 md:col-span-7">
          <div className="flex h-[70svh] items-end justify-center pt-24 md:sticky md:top-0 md:h-svh md:items-center md:pt-0">
            <StageAnchor
              kind="product"
              slug={f.slug}
              spin={f.slug in BOTTLE_MODELS}
              className="relative h-[52svh] md:h-[74svh]"
              style={{ aspectRatio: bottleAspect(f) }}
            >
              <div data-stage-fallback={f.slug} className="absolute inset-0">
                <BottleImage
                  fragrance={f}
                  fit="trim"
                  preload
                  sizes="(min-width: 768px) 38svh, 37svh"
                />
              </div>
            </StageAnchor>
          </div>
        </div>

        <div className="col-span-12 pb-24 md:col-span-5 md:pt-40">
          <nav aria-label="Breadcrumb" className="eyebrow opacity-70" {...enter(0)}>
            <Link href="/fragrances" className="border-b border-current/40 pb-0.5">
              All fragrances
            </Link>
            <span className="mx-3">/</span>
            <span aria-current="page" className="tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
          </nav>
          <h1
            className="font-display mt-8 text-[clamp(4rem,9vw,9.5rem)] leading-[0.85]"
            {...enter(1)}
          >
            {f.name}
          </h1>
          <p
            className="display-italic mt-6 max-w-md text-[clamp(1.4rem,2vw,2rem)] leading-snug"
            {...enter(2)}
          >
            {f.tagline}
          </p>
          <p className="eyebrow mt-8 opacity-70" {...enter(3)}>
            Eau de parfum · {f.mood}
            {from ? ` · ${f.variants.length > 1 ? "from " : ""}${from.sizeMl} ml` : ""}
          </p>
          {reviews && (
            <div className="mt-4" {...enter(3)}>
              <RatingLine summary={reviews} />
            </div>
          )}

          <div className="mt-12 max-w-md" {...enter(4)}>
            <ProductPurchase fragrance={f} />
            <DeliveryNote
              terms={terms}
              className="mt-8"
              whatsappText={`Hi ZALFI, a question about ${f.name}`}
            />
            <SetHint sets={sets} slug={f.slug} className="mt-6 opacity-80" />
          </div>

          <div className="mt-20 max-w-md" {...enter(5)}>
            <ScentProfile profile={f.profile} />
          </div>

          <div className="mt-24" {...enter(6)}>
            <NotesPyramid fragrance={f} noteAvail={noteAvail} />
          </div>

          {f.images.length > 0 && (
            <section
              aria-label={`${f.name}, in photographs`}
              className="mt-24 grid grid-cols-2 gap-3 border-t border-current/15 pt-8"
              {...enter(7)}
            >
              {f.images.map((img, i) => (
                <figure
                  key={img.url}
                  className={`relative overflow-hidden ${i === 0 && f.images.length % 2 === 1 ? "col-span-2" : ""}`}
                  style={{
                    aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : "4 / 5",
                  }}
                >
                  <Image
                    src={img.url}
                    alt={img.alt}
                    fill
                    sizes="(min-width: 768px) 20vw, 50vw"
                    className="object-cover"
                  />
                </figure>
              ))}
            </section>
          )}

          {reviews && <Reviews summary={reviews} name={f.name} className="mt-24" />}

          <div className="mt-16">
            <SimilarWorlds worlds={similarWorlds(f, all)} />
          </div>

          <Link
            href={`/fragrances/${next.slug}`}
            data-cursor="Next"
            className="group mt-16 flex items-end justify-between border-t border-current/15 pt-8"
          >
            <span>
              <span className="eyebrow block opacity-60">Next world</span>
              <span className="font-display mt-3 block text-6xl leading-none">{next.name}</span>
              <span className="display-italic mt-2 block opacity-70">{next.mood}</span>
            </span>
            <span
              aria-hidden
              className="text-3xl transition-transform duration-700 ease-(--ease-cinema) group-hover:translate-x-2"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
