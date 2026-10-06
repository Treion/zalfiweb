import Link from "next/link";
import clsx from "clsx";
import { whatsappUrl } from "@/lib/contact";
import { formatPrice } from "@/lib/money";
import type { ShopTerms } from "@/lib/terms";

/**
 * The house's services in one hairline row, as perfume houses put them by the shop: only what is
 * true today, from Settings (free delivery, cash on delivery) and the catalogue (discovery sets).
 */
export function Services({
  terms,
  sets,
  className,
}: {
  terms: ShopTerms;
  /** Whether discovery sets are on sale */
  sets: boolean;
  className?: string;
}) {
  const items: { label: string; href?: string; external?: boolean }[] = [
    ...(terms.freeFrom !== null && terms.freeFrom > 0
      ? [{ label: `Free delivery over ${formatPrice(terms.freeFrom)}` }]
      : []),
    ...(terms.cod ? [{ label: "Cash on delivery" }] : []),
    { label: "Free gift note" },
    ...(sets ? [{ label: "Try them first: discovery sets", href: "/discovery" }] : []),
    {
      label: "Questions? WhatsApp",
      href: whatsappUrl("Hi ZALFI, a question about a perfume"),
      external: true,
    },
  ];
  return (
    <ul
      aria-label="Our services"
      className={clsx(
        "border-noir/15 flex flex-wrap gap-x-8 gap-y-2 border-t py-4 text-sm",
        className,
      )}
    >
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span aria-hidden className="bg-noir/40 block size-1" />
          {it.href ? (
            it.external ? (
              <a
                href={it.href}
                target="_blank"
                rel="noreferrer"
                className="border-noir/30 hover:border-noir border-b"
              >
                {it.label}
              </a>
            ) : (
              <Link href={it.href} className="border-noir/30 hover:border-noir border-b">
                {it.label}
              </Link>
            )
          ) : (
            it.label
          )}
        </li>
      ))}
    </ul>
  );
}
