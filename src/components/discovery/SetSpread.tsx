import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import type { DiscoverySet } from "@/lib/discovery";
import type { ReviewSummary } from "@/lib/reviews";
import { RatingLine, Reviews } from "@/components/product/Reviews";
import { sizeLabel } from "@/lib/size";
import { Rise } from "./Rise";
import { SetBuy } from "./SetBuy";

/**
 * One set on the Discovery page: the box large, its name running into it, the three fragrances
 * inside (each to its own page), and the Add. Sets alternate sides down the page.
 */
export function SetSpread({
  set: s,
  flip,
  preload,
  reviews,
}: {
  set: DiscoverySet;
  flip: boolean;
  preload: boolean;
  /** Its approved reviews, if it has any */
  reviews?: ReviewSummary | null;
}) {
  const label = s.variant ? sizeLabel(s.variant.sizeMl, s.variant.pieces) : null;
  return (
    <section
      id={s.slug}
      aria-labelledby={`set-${s.slug}`}
      className="border-noir/15 grid scroll-mt-24 grid-cols-12 items-center gap-x-4 gap-y-10 border-t py-20 md:py-28"
    >
      <div
        className={clsx(
          "col-span-12 md:col-span-6",
          flip ? "md:col-start-7 md:row-start-1" : "md:col-start-1",
        )}
      >
        <Rise>
          <div
            className="relative mx-auto w-[78%] md:w-[84%]"
            style={{ aspectRatio: `${s.width} / ${s.height}` }}
          >
            <Image
              src={s.image}
              alt={s.imageAlt}
              fill
              quality={90}
              preload={preload}
              sizes="(min-width: 768px) 42vw, 78vw"
              className="object-contain"
            />
          </div>
        </Rise>
      </div>

      <div
        className={clsx(
          "relative z-10 col-span-12 md:col-span-5",
          flip ? "md:col-start-1 md:row-start-1" : "md:col-start-7 md:-ml-[12%]",
        )}
      >
        <p className="eyebrow text-smoke">Discovery set{label && ` · ${label}`}</p>
        <h2
          id={`set-${s.slug}`}
          className="display-italic mt-6 text-[clamp(3.5rem,7.5vw,8rem)] leading-[0.86]"
        >
          {s.name}
        </h2>
        <p className="mt-6 max-w-sm text-lg leading-snug">{s.tagline}</p>
        {reviews && <RatingLine summary={reviews} href={`#${s.slug}-reviews`} className="mt-4" />}

        <h3 className="eyebrow text-smoke mt-12">Inside</h3>
        <ul className="border-noir/15 mt-4 max-w-md border-t">
          {s.fragrances.map((f) => (
            <li key={f.slug} className="border-noir/15 border-b">
              <Link
                href={`/fragrances/${f.slug}`}
                data-cursor="Discover"
                className="group grid grid-cols-[3rem_1fr_auto] items-center gap-4 py-4"
              >
                <span className="relative block aspect-square">
                  <Image
                    src={f.bottleImage}
                    alt=""
                    fill
                    quality={90}
                    sizes="48px"
                    className="object-contain"
                  />
                </span>
                <span>
                  <span className="font-display block text-2xl leading-none">{f.name}</span>
                  <span className="text-smoke mt-1 block text-sm">{f.tagline}</span>
                </span>
                <span
                  aria-hidden
                  className="transition-transform duration-700 ease-(--ease-cinema) group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <SetBuy set={s} className="mt-10" />
        {reviews && (
          <Reviews
            summary={reviews}
            name={`the ${s.name}`}
            id={`${s.slug}-reviews`}
            limit={3}
            className="mt-16 max-w-md"
          />
        )}
      </div>
    </section>
  );
}
