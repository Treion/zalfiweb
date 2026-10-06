import Link from "next/link";
import { BottleImage } from "@/components/media/BottleImage";
import { worldVars, type Fragrance } from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";

/**
 * Two fragrances close to this one (similarWorlds in lib/finder.ts), each shown in its own world's
 * colours, so the next click stays a choice between places rather than a list.
 */
export function SimilarWorlds({ worlds }: { worlds: Fragrance[] }) {
  if (!worlds.length) return null;
  return (
    <section aria-labelledby="similar-title" className="border-t border-current/15 pt-8">
      <h2 id="similar-title" className="eyebrow opacity-70">
        Similar worlds
      </h2>
      <ul className="mt-6 grid grid-cols-2 gap-3">
        {worlds.map((w) => (
          <li key={w.slug}>
            <Link
              href={`/fragrances/${w.slug}`}
              data-cursor="Discover"
              style={worldVars(w)}
              className="bg-world-bg text-world-ink group block border border-current/15 p-4"
            >
              <span className="relative mx-auto block aspect-square w-3/4 transition-transform duration-700 ease-(--ease-cinema) group-hover:-translate-y-1">
                <BottleImage fragrance={w} sizes="(min-width: 768px) 12vw, 30vw" />
              </span>
              <span className="font-display mt-4 block text-3xl leading-none">{w.name}</span>
              <span className="display-italic mt-1 block text-sm opacity-75">{w.mood}</span>
              {w.variants[0] && (
                <span className="mt-3 block text-xs tabular-nums opacity-75">
                  {formatPrice(w.variants[0].pricePoisha)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
