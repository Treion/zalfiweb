import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Fragrance } from "@/lib/fragrance";

/** The footer: an index of the six worlds, and the wordmark set as large as the page allows. */
export function Footer({
  fragrances,
}: {
  fragrances: Pick<Fragrance, "slug" | "name" | "mood">[];
}) {
  return (
    <footer className="bg-noir px-gutter text-bone relative overflow-hidden pt-24 pb-8">
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <nav aria-labelledby="footer-worlds" className="col-span-12 md:col-span-5">
          <h2 id="footer-worlds" className="eyebrow text-bone-dim">
            The six worlds
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
            {fragrances.map((f) => (
              <li key={f.slug}>
                <Link href={`/fragrances/${f.slug}`} className="group block">
                  <span className="font-display text-3xl leading-none transition-opacity group-hover:opacity-70">
                    {f.name}
                  </span>
                  <span className="text-bone-dim mt-1 block text-xs">{f.mood}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-house" className="col-span-6 md:col-span-2 md:col-start-8">
          <h2 id="footer-house" className="eyebrow text-bone-dim">
            The house
          </h2>
          <ul className="mt-6 space-y-3 text-sm">
            <li>
              <Link href="/#story" className="hover:underline">
                Our story
              </Link>
            </li>
            <li>
              <Link href="/#collection" className="hover:underline">
                The collection
              </Link>
            </li>
            <li>
              <Link href="/find" className="hover:underline">
                Find your world
              </Link>
            </li>
            <li>
              <Link href="/checkout" className="hover:underline">
                Your bag
              </Link>
            </li>
          </ul>
        </nav>
        <div className="text-bone-dim col-span-6 text-sm md:col-span-3 md:col-start-10">
          <p className="eyebrow">Eau de parfum</p>
          <p className="mt-6 leading-relaxed">
            Six compositions in smoked glass. Worn close, remembered long.
          </p>
        </div>
      </div>

      <Logo variant="wordmark" className="text-bone mt-24 w-full md:mt-32" title="ZALFI" />

      <div className="border-bone/10 text-bone-dim mt-8 flex flex-col justify-between gap-2 border-t pt-6 text-xs sm:flex-row">
        <p>© {new Date().getFullYear()} ZALFI. All rights reserved.</p>
        <p>Maison de parfum</p>
      </div>
    </footer>
  );
}
