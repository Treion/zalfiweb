"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/components/cart/cart-store";
import { useLenis } from "@/components/motion/SmoothScroll";
import { formatPrice } from "@/lib/money";
import { sizeLabel } from "@/lib/size";
import { POPULAR, popularSearches, searchEntries, type SearchEntry } from "@/lib/shop-search";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The header search: a dark sheet over the page, with the box focused. Results appear as you type
 * (fragrances and sets with one-tap Add, then pages). Enter opens the first result; Esc closes.
 * Only opacity changes. Focus stays inside while it's open, and the page behind doesn't scroll.
 */
export function SearchPanel({
  open,
  index,
  onClose,
  restoreFocus,
}: {
  open: boolean;
  index: SearchEntry[];
  onClose: () => void;
  restoreFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lenis = useLenis();
  const router = useRouter();
  const { add } = useCart();
  const uid = useId();
  const results = useMemo(() => searchEntries(index, query), [index, query]);
  const popular = useMemo(() => popularSearches(index, POPULAR), [index]);
  const products = results.filter((r) => r.kind !== "page");
  const pages = results.filter((r) => r.kind === "page");

  // Scroll lock, focus, Esc and the focus trap (as the bag does)
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const t = setTimeout(() => input.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const focusables = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const button = restoreFocus.current;
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      lenis?.start();
      button?.focus({ preventScroll: true });
    };
  }, [open, onClose, lenis, restoreFocus]);

  function buy(e: SearchEntry) {
    if (!e.buy) return;
    // Search steps aside for the bag, which opens with the new line
    onClose();
    add({
      sku: e.buy.sku,
      slug: e.buy.slug,
      name: e.name,
      ...(e.kind === "set" ? { kind: "set" as const, pieces: e.buy.pieces } : {}),
      sizeMl: e.buy.sizeMl,
      pricePoisha: e.buy.pricePoisha,
      bottleImage: e.buy.image,
    });
  }

  return (
    <AnimatePresence onExitComplete={() => setQuery("")}>
      {open && (
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          data-lenis-prevent
          className="bg-noir text-bone fixed inset-0 z-[75] overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="px-gutter mx-auto max-w-5xl pt-8 pb-24 md:pt-14">
            <div className="flex items-baseline justify-between gap-6">
              <label htmlFor={`${uid}-q`} className="eyebrow text-bone-dim">
                Search
              </label>
              <button
                type="button"
                onClick={onClose}
                className="eyebrow border-bone/30 hover:border-bone border-b pb-0.5"
              >
                Close
              </button>
            </div>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                const first = results[0];
                if (!first) return;
                onClose();
                router.push(first.href);
              }}
            >
              <input
                ref={input}
                id={`${uid}-q`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, note or mood"
                autoComplete="off"
                spellCheck={false}
                aria-controls={`${uid}-results`}
                className="font-display placeholder:text-bone/25 border-bone/25 focus:border-bone mt-4 block w-full border-b bg-transparent pb-4 text-[clamp(2.25rem,6vw,4.5rem)] leading-tight italic outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </form>

            <div id={`${uid}-results`} aria-live="polite" className="mt-10">
              {!query.trim() ? (
                <div className="grid gap-10 md:grid-cols-2">
                  {popular.length > 0 && (
                    <div>
                      <p className="eyebrow text-bone-dim">Popular</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {popular.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setQuery(p);
                              input.current?.focus();
                            }}
                            className="border-bone/25 hover:border-bone border px-4 py-2 text-sm transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="eyebrow text-bone-dim">Go to</p>
                    <ul className="mt-4 space-y-2">
                      {[
                        ["/fragrances", "Shop every fragrance"],
                        ["/discovery", "Discovery sets"],
                        ["/find", "Find your world"],
                        ["/track", "Track your order"],
                      ].map(([href, label]) => (
                        <li key={href}>
                          <Link
                            href={href!}
                            onClick={onClose}
                            className="font-display text-2xl transition-opacity hover:opacity-70"
                          >
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <p className="text-bone-dim max-w-md leading-relaxed">
                  {`Nothing for “${query.trim()}”. Try a note, like oud or rose, or a moment, like evening.`}{" "}
                  <Link
                    href="/fragrances"
                    onClick={onClose}
                    className="text-bone border-bone/40 border-b"
                  >
                    See every fragrance
                  </Link>
                </p>
              ) : (
                <>
                  {products.length > 0 && (
                    <ul className="divide-bone/10 border-bone/15 divide-y border-y">
                      {products.map((r) => (
                        <li key={r.href} className="flex items-center gap-4 py-4 md:gap-6">
                          <Link
                            href={r.href}
                            onClick={onClose}
                            className="group flex min-w-0 flex-1 items-center gap-4 md:gap-6"
                          >
                            {r.buy && (
                              <span className="relative block size-16 shrink-0 md:size-20">
                                <Image
                                  src={r.buy.image}
                                  alt=""
                                  fill
                                  sizes="80px"
                                  quality={90}
                                  className="object-contain"
                                />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="font-display block text-3xl leading-none transition-opacity group-hover:opacity-70">
                                {r.name}
                              </span>
                              <span className="text-bone-dim mt-1.5 block truncate text-sm">
                                {r.line}
                              </span>
                            </span>
                          </Link>
                          {r.buy && (
                            <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                              <span className="text-sm tabular-nums">
                                {formatPrice(r.buy.pricePoisha)}
                                <span className="text-bone-dim hidden md:inline">
                                  {` · ${sizeLabel(r.buy.sizeMl, r.buy.pieces)}`}
                                </span>
                              </span>
                              <button
                                type="button"
                                disabled={r.buy.soldOut}
                                onClick={() => buy(r)}
                                aria-label={
                                  r.buy.soldOut ? `${r.name}: sold out` : `Add ${r.name} to bag`
                                }
                                className="eyebrow border-bone/40 hover:border-bone border-b pb-0.5 transition-colors disabled:opacity-40"
                              >
                                {r.buy.soldOut ? "Sold out" : "Add"}
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {pages.length > 0 && (
                    <div className="mt-10">
                      <p className="eyebrow text-bone-dim">Pages</p>
                      <ul className="mt-4 space-y-3">
                        {pages.map((r) => (
                          <li key={r.href}>
                            <Link href={r.href} onClick={onClose} className="group block">
                              <span className="font-display text-2xl transition-opacity group-hover:opacity-70">
                                {r.name}
                              </span>
                              <span className="text-bone-dim ml-3 text-sm">{r.line}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
