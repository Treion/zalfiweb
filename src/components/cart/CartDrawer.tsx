"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "@/components/motion/SmoothScroll";
import { formatPrice } from "@/lib/money";
import type { CheckoutResponse } from "@/app/api/checkout/route";
import { useCart } from "./cart-store";

const EASE = [0.22, 1, 0.36, 1] as const;

export function CartDrawer() {
  const cart = useCart();
  const { open, closeBag } = cart;
  const lenis = useLenis();
  const panel = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const [checkout, setCheckout] = useState<
    { state: "idle" } | { state: "loading" } | { state: "message"; text: string }
  >({ state: "idle" });

  // Scroll lock, focus management, Esc and focus trap
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    lenis?.stop();
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const t = setTimeout(
      () => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(),
      50,
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBag();
      if (e.key !== "Tab" || !panel.current) return;
      const focusables = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      lenis?.start();
      restoreFocus.current?.focus?.();
    };
  }, [open, closeBag, lenis]);

  async function startCheckout() {
    setCheckout({ state: "loading" });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.lines.map((l) => ({ sku: l.sku, qty: l.qty })) }),
      });
      const data = (await res.json()) as CheckoutResponse;
      if (data.status === "ready") {
        window.location.href = data.url;
        return;
      }
      setCheckout({ state: "message", text: data.message });
    } catch {
      setCheckout({ state: "message", text: "We couldn't reach checkout. Try again in a moment." });
    }
  }

  const currency = cart.lines[0]?.currency ?? "USD";

  return (
    <AnimatePresence onExitComplete={() => setCheckout({ state: "idle" })}>
      {cart.open && (
        <div className="fixed inset-0 z-[80]" data-lenis-prevent>
          <motion.button
            type="button"
            aria-label="Close bag"
            tabIndex={-1}
            className="bg-noir/60 absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            onClick={cart.closeBag}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bag-title"
            className="bg-bone text-noir absolute top-0 right-0 flex h-full w-full max-w-[30rem] flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.75, ease: EASE }}
          >
            <header className="border-noir/15 flex items-baseline justify-between border-b px-8 pt-8 pb-6">
              <h2 id="bag-title" className="display-italic text-4xl">
                Your bag{" "}
                <span className="eyebrow text-smoke align-middle not-italic">({cart.count})</span>
              </h2>
              <button
                type="button"
                data-autofocus
                onClick={cart.closeBag}
                className="eyebrow border-noir/30 border-b pb-0.5"
              >
                Close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-8" data-lenis-prevent>
              {cart.lines.length === 0 ? (
                <div className="flex h-full flex-col justify-center gap-6 pb-24">
                  <p className="font-display text-3xl leading-tight">Your bag is empty.</p>
                  <p className="text-smoke">
                    Six worlds are waiting. Start with the one you can smell from here.
                  </p>
                  <Link
                    href="/#collection"
                    onClick={cart.closeBag}
                    className="eyebrow border-noir self-start border-b pb-1"
                  >
                    Discover the collection
                  </Link>
                </div>
              ) : (
                <ul className="divide-noir/10 divide-y">
                  {cart.lines.map((l, i) => (
                    <motion.li
                      key={l.sku}
                      className="grid grid-cols-[4.5rem_1fr_auto] gap-5 py-6"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.25 + i * 0.06, ease: EASE }}
                    >
                      <div className="bg-noir/[0.04] relative aspect-square">
                        <Image
                          src={l.bottleImage}
                          alt=""
                          fill
                          sizes="72px"
                          className="object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/fragrances/${l.slug}`}
                          onClick={cart.closeBag}
                          className="font-display text-2xl leading-none"
                        >
                          {l.name}
                        </Link>
                        <p className="text-smoke mt-1 text-sm">Eau de parfum · {l.sizeMl} ml</p>
                        <div className="mt-4 flex items-center gap-4">
                          <div className="border-noir/20 flex items-center border">
                            <button
                              type="button"
                              aria-label={`Remove one ${l.name} ${l.sizeMl} ml`}
                              onClick={() => cart.setQty(l.sku, l.qty - 1)}
                              className="grid size-8 place-items-center"
                            >
                              −
                            </button>
                            <span
                              className="w-6 text-center text-sm tabular-nums"
                              aria-live="polite"
                            >
                              {l.qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Add one ${l.name} ${l.sizeMl} ml`}
                              onClick={() => cart.setQty(l.sku, l.qty + 1)}
                              disabled={l.qty >= 10}
                              className="grid size-8 place-items-center disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => cart.remove(l.sku)}
                            className="text-smoke text-xs underline-offset-4 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <p className="text-sm tabular-nums">
                        {formatPrice(l.priceCents * l.qty, l.currency)}
                      </p>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            {cart.lines.length > 0 && (
              <footer className="border-noir/15 border-t px-8 pt-6 pb-8">
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow">Subtotal</span>
                  <span className="font-display text-3xl tabular-nums">
                    {formatPrice(cart.subtotalCents, currency)}
                  </span>
                </div>
                <p className="text-smoke mt-2 text-xs">
                  Shipping and taxes are calculated at checkout.
                </p>
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={checkout.state === "loading"}
                  data-cursor="Checkout"
                  className="eyebrow bg-noir text-bone mt-6 w-full py-5 transition-opacity disabled:opacity-60"
                >
                  {checkout.state === "loading" ? "One moment" : "Checkout"}
                </button>
                <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm">
                  {checkout.state === "message" ? checkout.text : ""}
                </p>
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
