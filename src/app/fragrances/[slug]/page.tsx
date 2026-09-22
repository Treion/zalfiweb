import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import { NotesPyramid } from "@/components/product/NotesPyramid";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { getFragrance, getFragrances } from "@/db/queries";
import { availability } from "@/lib/assets";
import { NOTE_LAYERS, notesByLayer, worldVars } from "@/lib/fragrance";

export const revalidate = 300;

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
  const all = await getFragrances();
  const index = all.findIndex((x) => x.slug === slug);
  const f = all[index];
  if (!f) notFound();
  const next = all[(index + 1) % all.length];
  const noteAvail = availability(f.notes.map((n) => n.image));
  const from = f.variants[0];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `ZALFI ${f.name}`,
    description: f.story,
    brand: { "@type": "Brand", name: "ZALFI" },
    image: new URL(f.bottleImage, site).toString(),
    category: "Eau de parfum",
    offers: f.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      price: (v.priceCents / 100).toFixed(2),
      priceCurrency: v.currency,
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(`/fragrances/${f.slug}`, site).toString(),
    })),
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
              className="relative h-[52svh] md:h-[74svh]"
              style={{ aspectRatio: bottleAspect(f.slug) }}
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
          <nav aria-label="Breadcrumb" className="eyebrow opacity-70">
            <Link href="/#collection" className="border-b border-current/40 pb-0.5">
              Collection
            </Link>
            <span className="mx-3">/</span>
            <span aria-current="page" className="tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
          </nav>
          <h1 className="font-display mt-8 text-[clamp(4rem,9vw,9.5rem)] leading-[0.85]">
            {f.name}
          </h1>
          <p className="display-italic mt-6 max-w-md text-[clamp(1.4rem,2vw,2rem)] leading-snug">
            {f.tagline}
          </p>
          <p className="mt-6 max-w-md leading-relaxed opacity-80">{f.story}</p>
          <p className="eyebrow mt-8 opacity-70">
            Eau de parfum · {f.mood}
            {from ? ` · from ${from.sizeMl} ml` : ""}
          </p>

          <div className="mt-12 max-w-md">
            <ProductPurchase fragrance={f} />
          </div>

          <div className="mt-24">
            <NotesPyramid fragrance={f} noteAvail={noteAvail} />
          </div>

          <Link
            href={`/fragrances/${next.slug}`}
            data-cursor="Next"
            className="group mt-24 flex items-end justify-between border-t border-current/15 pt-8"
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
