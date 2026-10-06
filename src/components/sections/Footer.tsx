import Link from "next/link";
import clsx from "clsx";
import { Logo } from "@/components/brand/Logo";
import { HomeLink } from "./HomeLink";
import { ContactIcons } from "@/components/ui/ContactIcons";
import { INFO_PAGES, type InfoPage } from "@/content/pages";
import { CONTACT, MAPS_URL } from "@/lib/contact";
import type { Fragrance } from "@/lib/fragrance";
import { paymentMarks, type ShopTerms } from "@/lib/terms";
import { countWord } from "@/lib/words";

const pages = (group: InfoPage["group"]) =>
  INFO_PAGES.filter((p) => p.group === group).map((p) => ({ href: `/${p.slug}`, label: p.title }));

const columns = (
  discovery: boolean,
): { title: string; links: { href: string; label: string }[] }[] => [
  {
    title: "The house",
    links: [
      ...pages("house"),
      { href: "/fragrances", label: "Shop all fragrances" },
      ...(discovery ? [{ href: "/discovery", label: "Discovery sets" }] : []),
      { href: "/find", label: "Find your world" },
      { href: "/checkout", label: "Your bag" },
      { href: "/track", label: "Track your order" },
    ],
  },
  { title: "Help", links: pages("help") },
  { title: "Legal", links: pages("legal") },
];

/**
 * The footer: the six worlds, the house's pages, how to reach us, the ways to pay, and the
 * wordmark set as large as the page allows.
 */
export function Footer({
  fragrances,
  discovery = false,
  terms,
}: {
  fragrances: Pick<Fragrance, "slug" | "name" | "mood">[];
  /** Whether discovery sets are on sale (the house column links to them) */
  discovery?: boolean;
  /** How customers can pay, from Settings (only what checkout really offers) */
  terms?: ShopTerms;
}) {
  const marks = terms ? paymentMarks(terms) : [];
  return (
    <footer className="bg-noir px-gutter text-bone relative overflow-hidden pt-24 pb-8">
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <nav aria-labelledby="footer-worlds" className="col-span-12 lg:col-span-5">
          <h2 id="footer-worlds" className="eyebrow text-bone-dim">
            {`The ${countWord(fragrances.length)} worlds`}
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

        {columns(discovery).map((col, i) => (
          <nav
            key={col.title}
            aria-labelledby={`footer-${i}`}
            className={clsx("col-span-6 sm:col-span-4 lg:col-span-2", i === 0 && "lg:col-start-7")}
          >
            <h2 id={`footer-${i}`} className="eyebrow text-bone-dim">
              {col.title}
            </h2>
            <ul className="mt-6 space-y-3 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  {l.href === "/#collection" ? (
                    <HomeLink to="collection" className="underline-offset-4 hover:underline">
                      {l.label}
                    </HomeLink>
                  ) : (
                    <Link href={l.href} className="underline-offset-4 hover:underline">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* How to reach us */}
      <div className="border-bone/10 mt-16 grid grid-cols-12 items-end gap-x-4 gap-y-8 border-t pt-10">
        <address className="text-bone-dim col-span-12 text-sm leading-relaxed not-italic sm:col-span-6 lg:col-span-5">
          <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-bone">
            {CONTACT.address.join(", ")}
          </a>
          <br />
          <a href={`tel:${CONTACT.phone}`} className="hover:text-bone">
            {CONTACT.phoneDisplay}
          </a>
          <span className="mx-2 opacity-50">·</span>
          <a href={`mailto:${CONTACT.email}`} className="hover:text-bone">
            {CONTACT.email}
          </a>
        </address>
        <ContactIcons className="col-span-12 flex items-center gap-3 sm:col-span-6 sm:justify-end lg:col-span-7" />
        {marks.length > 0 && (
          <p className="col-span-12 flex flex-wrap items-center gap-1.5" aria-label="Ways to pay">
            <span className="eyebrow text-bone-dim mr-2">We accept</span>
            {marks.map((m) => (
              <span key={m} className="border-bone/25 border px-2 py-0.5 text-xs">
                {m}
              </span>
            ))}
          </p>
        )}
      </div>

      <Logo variant="wordmark" className="text-bone mt-20 w-full md:mt-28" title="ZALFI" />

      <div className="border-bone/10 text-bone-dim mt-8 border-t pt-6 text-xs">
        <p>© {new Date().getFullYear()} ZALFI. All rights reserved.</p>
      </div>
    </footer>
  );
}
