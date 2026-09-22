"use client";

import { useEffect, useId, useState } from "react";
import { motion } from "motion/react";
import { useCart } from "@/components/cart/cart-store";
import type { Fragrance } from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";

type Stock = Record<string, { stock: number; priceCents: number }>;

/** Size + price selection and Add to bag, with live stock from /api/stock. */
export function ProductPurchase({ fragrance: f }: { fragrance: Fragrance }) {
  const { add } = useCart();
  const id = useId();
  const [sku, setSku] = useState(f.variants[0]?.sku);
  const [stock, setStock] = useState<Stock | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/stock?skus=${f.variants.map((v) => v.sku).join(",")}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { stock: Stock } | null) => d && setStock(d.stock))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [f.variants]);

  const v = f.variants.find((x) => x.sku === sku) ?? f.variants[0];
  if (!v) return null;
  const live = stock?.[v.sku];
  const left = live?.stock ?? v.stock;
  const price = live?.priceCents ?? v.priceCents;
  const soldOut = left <= 0;

  function addToBag() {
    add({
      sku: v.sku,
      slug: f.slug,
      name: f.name,
      sizeMl: v.sizeMl,
      priceCents: price,
      currency: v.currency,
      bottleImage: f.bottleImage,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2400);
  }

  return (
    <div>
      <fieldset>
        <legend className="eyebrow mb-4 opacity-70">Size</legend>
        <div className="grid grid-cols-2 gap-3">
          {f.variants.map((x) => {
            const checked = x.sku === v.sku;
            return (
              <label
                key={x.sku}
                className="group relative flex cursor-pointer items-baseline justify-between border border-current/25 px-4 py-4 transition-colors has-[:checked]:border-current has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-4"
              >
                <input
                  type="radio"
                  name={`${id}-size`}
                  value={x.sku}
                  checked={checked}
                  onChange={() => setSku(x.sku)}
                  className="sr-only"
                />
                <span className="font-display text-2xl">{x.sizeMl} ml</span>
                <span className="text-sm tabular-nums opacity-80">
                  {formatPrice(stock?.[x.sku]?.priceCents ?? x.priceCents, x.currency)}
                </span>
                {checked && (
                  <motion.span
                    layoutId={`${id}-sel`}
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-current"
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 flex items-baseline justify-between">
        <span className="font-display text-4xl tabular-nums">{formatPrice(price, v.currency)}</span>
        <span className="eyebrow opacity-70" aria-live="polite">
          {soldOut ? "Sold out" : left <= 5 ? `Only ${left} left` : "In stock"}
        </span>
      </div>

      <button
        type="button"
        onClick={addToBag}
        disabled={soldOut}
        data-cursor="Add"
        className="eyebrow bg-world-ink text-world-bg relative mt-6 w-full overflow-hidden py-5 transition-opacity disabled:opacity-40"
      >
        <motion.span
          key={added ? "added" : "add"}
          className="block"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {soldOut ? "Sold out" : added ? "Added to your bag" : "Add to bag"}
        </motion.span>
      </button>
      <p className="mt-3 text-xs opacity-60">Shipping and taxes are calculated at checkout.</p>
    </div>
  );
}
