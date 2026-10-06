"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "@/components/motion/SmoothScroll";
import { formatPrice } from "@/lib/money";
import type { CheckoutResponse } from "@/app/api/checkout/route";
import { whatsappUrl } from "@/lib/contact";
import { paymentMarks, toFreeDelivery, type ShopTerms } from "@/lib/terms";
import { lineHref, useCart } from "./cart-store";
import { countWord } from "@/lib/words";
import { sizeLabel } from "@/lib/size";

const EASE = [0.22, 1, 0.36, 1] as const;

export function CartDrawer({
  worldCount = 6,
  discovery = false,
  terms,
}: {
  worldCount?: number;
  /** Whether discovery sets are on sale (the empty bag points to them) */
  discovery?: boolean;
  /** Delivery and payment terms from Settings (free delivery, fees, how to pay) */
  terms?: ShopTerms;
}) {
  const cart = useCart();
  const { open, closeBag } = cart;
  const lenis = useLenis();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  // Closed with the keyboard (Esc), the cart button gets its focus ring back; closed with the
  // mouse, focus still returns there but quietly, with no ring
  const closedByKey = useRef(false);
  const [checkout, setCheckout] = useState<
    { state: "idle" } | { state: "loading" } | { state: "message"; text: string }
  >({ state: "idle" });

  // Scroll lock, focus management, Esc and focus trap
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    closedByKey.current = false;
    lenis?.stop();
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const t = setTimeout(
      () => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(),
      50,
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closedByKey.current = true;
        closeBag();
      }
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
      const el = restoreFocus.current;
      if (el) {
        const quiet = !closedByKey.current;
        if (quiet) {
          // Browsers that ignore focusVisible: the attribute hides the ring until focus moves on
          el.setAttribute("data-quiet-focus", "");
          el.addEventListener("blur", () => el.removeAttribute("data-quiet-focus"), { once: true });
        }
        el.focus({ focusVisible: !quiet } as FocusOptions);
      }
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
        closeBag();
        router.push(data.url);
        return;
      }
      setCheckout({ state: "message", text: data.message });
    } catch {
      setCheckout({ state: "message", text: "We couldn't reach checkout. Try again in a moment." });
    }
  }

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
                    {`${countWord(worldCount, true)} worlds are waiting. Start with the one you can smell from here.`}
                  </p>
                  <Link
                    href="/fragrances"
                    onClick={cart.closeBag}
                    className="eyebrow border-noir self-start border-b pb-1"
                  >
                    See every fragrance
                  </Link>
                  {discovery && (
                    <p className="text-smoke text-sm">
                      Not sure where to start?{" "}
                      <Link
                        href="/discovery"
                        onClick={cart.closeBag}
                        className="text-noir border-noir/40 border-b"
                      >
                        Discovery sets
                      </Link>
                    </p>
                  )}
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
                          href={lineHref(l)}
                          onClick={cart.closeBag}
                          className="font-display text-2xl leading-none"
                        >
                          {l.name}
                        </Link>
                        <p className="text-smoke mt-1 text-sm">
                          {l.kind === "set" ? "Discovery set" : "Eau de parfum"} ·{" "}
                          {sizeLabel(l.sizeMl, l.pieces)}
                        </p>
                        <div className="mt-4 flex items-center gap-4">
                          <div className="border-noir/20 flex items-center border">
                            <button
                              type="button"
                              aria-label={`Remove one ${l.name} ${sizeLabel(l.sizeMl, l.pieces)}`}
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
                              aria-label={`Add one ${l.name} ${sizeLabel(l.sizeMl, l.pieces)}`}
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
                      <p className="text-sm tabular-nums">{formatPrice(l.pricePoisha * l.qty)}</p>
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
                    {formatPrice(cart.subtotalPoisha)}
                  </span>
                </div>
                {terms && <FreeDelivery subtotal={cart.subtotalPoisha} freeFrom={terms.freeFrom} />}
                <p className="text-smoke mt-2 text-xs">
                  Delivery is added at checkout, from your address.{" "}
                  {paymentMarks(terms ?? { online: false, cod: false, wallets: [] }).includes(
                    "Cash on delivery",
                  ) && "Cash on delivery available. "}
                  <a
                    href={whatsappUrl("Hi ZALFI, a question about my order")}
                    target="_blank"
                    rel="noreferrer"
                    className="text-noir border-noir/40 border-b"
                  >
                    WhatsApp us
                  </a>
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

/**
 * How far the bag is from free delivery: a still hairline whose fill changes only when the bag
 * does (a transform, never a width), and the words to say it.
 */
function FreeDelivery({ subtotal, freeFrom }: { subtotal: number; freeFrom: number | null }) {
  const left = toFreeDelivery(subtotal, freeFrom);
  if (left === null || freeFrom === null || freeFrom <= 0) return null;
  const done = Math.min(1, subtotal / freeFrom);
  return (
    <div className="mt-4">
      <p className="text-sm" aria-live="polite">
        {left === 0
          ? "Free delivery on this order."
          : `${formatPrice(left)} away from free delivery.`}
      </p>
      <div aria-hidden className="bg-noir/15 mt-2 h-px w-full overflow-hidden">
        <div
          className="bg-noir h-px w-full origin-left transition-transform duration-700 ease-(--ease-cinema)"
          style={{ transform: `scaleX(${done})` }}
        />
      </div>
    </div>
  );
}
