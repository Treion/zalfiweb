"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/brand/Logo";
import { useCart } from "@/components/cart/cart-store";

/**
 * Fixed editorial navigation. Uses mix-blend-difference so it stays legible over every
 * fragrance world. On the home page the wordmark stays hidden while the intro logo holds the
 * stage; the experience timeline fades it in (data-nav-logo).
 */
export function Nav() {
  const { count, openBag } = useCart();
  const home = usePathname() === "/";
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[70] text-white mix-blend-difference">
      <nav
        aria-label="Primary"
        className="px-gutter flex items-center justify-between py-5 md:py-7"
      >
        <Link
          href="/"
          aria-label="ZALFI, home"
          data-nav-logo
          className={`pointer-events-auto block ${home ? "static:opacity-100 opacity-0" : ""}`}
        >
          <Logo variant="wordmark" title={null} className="h-4 w-auto md:h-5" />
        </Link>
        <ul className="pointer-events-auto flex items-center gap-6 md:gap-10">
          <li className="hidden sm:block">
            <Link href="/#collection" className="eyebrow">
              Fragrances
            </Link>
          </li>
          <li className="hidden sm:block">
            <Link href="/find" className="eyebrow">
              Find yours
            </Link>
          </li>
          <li className="hidden sm:block">
            <Link href="/#story" className="eyebrow">
              The House
            </Link>
          </li>
          <li>
            <button type="button" onClick={openBag} className="eyebrow flex items-center gap-2">
              Bag
              <span className="relative inline-block min-w-4 overflow-hidden text-center tabular-nums">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={count}
                    className="inline-block"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "-100%" }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {count}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="sr-only">items</span>
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}
