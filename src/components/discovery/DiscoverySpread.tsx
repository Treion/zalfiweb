import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import type { DiscoverySet } from "@/lib/discovery";
import { Rise } from "./Rise";
import { SetBuy } from "./SetBuy";

/**
 * The discovery sets on the home page: one quiet spread on the same bone paper as the house's
 * story, after it. The boxes stand side by side, one lower than the other, each with what's
 * inside and a one-tap Add. No pinning, no stage: they rise a little with the scroll, and that's
 * all.
 */
export function DiscoverySpread({ sets }: { sets: DiscoverySet[] }) {
  if (!sets.length) return null;
  return (
    <section
      id="discovery"
      aria-labelledby="discovery-title"
      className="bg-bone px-gutter text-noir relative scroll-mt-10 pb-32 md:pb-48"
    >
      <div className="border-noir/15 grid grid-cols-12 gap-x-4 gap-y-14 border-t pt-24 md:gap-y-20 md:pt-32">
        <p className="eyebrow text-smoke col-span-12 md:col-span-2">Discovery sets</p>
        <h2
          id="discovery-title"
          className="font-display col-span-12 text-[clamp(2.75rem,6.4vw,7rem)] leading-[0.92] tracking-[-0.01em] md:col-span-10"
        >
          Not sure yet?
          <br />
          <span className="display-italic">Start with three.</span>
        </h2>

        {sets.map((s, i) => (
          <article
            key={s.slug}
            aria-labelledby={`home-set-${s.slug}`}
            className={clsx(
              "col-span-12 md:col-span-5",
              i % 2 === 0 ? "md:col-start-2" : "md:col-start-8 md:mt-40",
            )}
          >
            <Link
              href={`/discovery#${s.slug}`}
              data-cursor="Discover"
              aria-label={`${s.name}: what's inside`}
              className="group block"
            >
              <Rise>
                <div
                  className="relative mx-auto w-[82%] transition-transform duration-700 ease-(--ease-cinema) group-hover:-translate-y-2 group-focus-visible:-translate-y-2"
                  style={{ aspectRatio: `${s.width} / ${s.height}` }}
                >
                  <Image
                    src={s.image}
                    alt={s.imageAlt}
                    fill
                    quality={90}
                    sizes="(min-width: 768px) 34vw, 82vw"
                    className="object-contain"
                  />
                </div>
              </Rise>
            </Link>
            <h3
              id={`home-set-${s.slug}`}
              className="font-display mt-10 text-[clamp(2.5rem,4vw,4rem)] leading-none"
            >
              {s.name}
            </h3>
            <p className="eyebrow text-smoke mt-4">
              {s.fragrances.map((f, j) => (
                <span key={f.slug}>
                  {j > 0 && <span aria-hidden> · </span>}
                  <Link href={`/fragrances/${f.slug}`} className="hover:text-noir">
                    {f.name}
                  </Link>
                </span>
              ))}
            </p>
            <SetBuy set={s} className="mt-8" />
          </article>
        ))}

        <p className="col-span-12 md:col-span-10 md:col-start-2">
          <Link
            href="/discovery"
            data-cursor="Discover"
            className="eyebrow border-noir border-b pb-1"
          >
            How the sets work
          </Link>
        </p>
      </div>
    </section>
  );
}
