"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { useCart } from "./cart-store";

export function CheckoutSummary() {
  const { lines, subtotalCents, hydrated } = useCart();
  if (!hydrated) return <div className="min-h-64" aria-busy="true" />;
  if (!lines.length) {
    return (
      <div className="border-noir/15 border-t pt-8">
        <p className="font-display text-3xl">Your bag is empty.</p>
        <Link href="/#collection" className="eyebrow border-noir mt-6 inline-block border-b pb-1">
          Discover the collection
        </Link>
      </div>
    );
  }
  return (
    <section aria-labelledby="summary-title" className="border-noir/15 border-t pt-8">
      <h2 id="summary-title" className="eyebrow text-smoke">
        Order summary
      </h2>
      <ul className="divide-noir/10 mt-6 divide-y">
        {lines.map((l) => (
          <li key={l.sku} className="grid grid-cols-[4rem_1fr_auto] items-center gap-5 py-5">
            <div className="relative aspect-square">
              <Image src={l.bottleImage} alt="" fill sizes="64px" className="object-contain" />
            </div>
            <div>
              <p className="font-display text-2xl leading-none">{l.name}</p>
              <p className="text-smoke mt-1 text-sm">
                {l.sizeMl} ml × {l.qty}
              </p>
            </div>
            <p className="tabular-nums">{formatPrice(l.priceCents * l.qty, l.currency)}</p>
          </li>
        ))}
      </ul>
      <div className="border-noir/15 mt-6 flex items-baseline justify-between border-t pt-6">
        <span className="eyebrow">Subtotal</span>
        <span className="font-display text-4xl tabular-nums">
          {formatPrice(subtotalCents, lines[0]?.currency)}
        </span>
      </div>
    </section>
  );
}
