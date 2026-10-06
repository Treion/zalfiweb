"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useCart } from "@/components/cart/cart-store";
import { NotifyMe } from "@/components/product/NotifyMe";
import type { DiscoverySet } from "@/lib/discovery";
import { formatPrice } from "@/lib/money";
import { sizeLabel } from "@/lib/size";

type Stock = Record<string, { stock: number; pricePoisha: number }>;

const EASE = [0.22, 1, 0.36, 1] as const;

/** The set's size, price and one-tap Add, with live stock and price from /api/stock */
export function SetBuy({
  set,
  className,
}: {
  set: Pick<DiscoverySet, "slug" | "name" | "image" | "variant">;
  className?: string;
}) {
  const { add } = useCart();
  const [live, setLive] = useState<Stock[string] | null>(null);
  const [added, setAdded] = useState(false);
  const v = set.variant;

  useEffect(() => {
    if (!v) return;
    const ctrl = new AbortController();
    fetch(`/api/stock?skus=${encodeURIComponent(v.sku)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { stock: Stock } | null) => d?.stock[v.sku] && setLive(d.stock[v.sku]!))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [v]);

  if (!v) return null;
  const price = live?.pricePoisha ?? v.pricePoisha;
  const soldOut = (live?.stock ?? v.stock) <= 0;

  function addToBag() {
    add({
      sku: v!.sku,
      slug: set.slug,
      name: set.name,
      kind: "set",
      sizeMl: v!.sizeMl,
      pieces: v!.pieces,
      pricePoisha: price,
      bottleImage: set.image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2400);
  }

  return (
    <div className={clsx("flex flex-wrap items-center gap-x-6 gap-y-4", className)}>
      <p className="flex items-baseline gap-3">
        <span className="font-display text-3xl tabular-nums">{formatPrice(price)}</span>
        <span className="eyebrow text-smoke">{sizeLabel(v.sizeMl, v.pieces)}</span>
      </p>
      <button
        type="button"
        onClick={addToBag}
        disabled={soldOut}
        data-cursor="Add"
        aria-label={
          soldOut
            ? `Sold out: ${set.name}`
            : added
              ? `In your bag: ${set.name}`
              : `Add the set: ${set.name}`
        }
        className="eyebrow bg-noir text-bone relative overflow-hidden px-8 py-4 transition-opacity disabled:opacity-40"
      >
        <motion.span
          key={added ? "added" : "add"}
          className="block"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {soldOut ? "Sold out" : added ? "In your bag" : "Add the set"}
        </motion.span>
      </button>
      {soldOut && <NotifyMe sku={v.sku} name={set.name} className="basis-full" />}
    </div>
  );
}
