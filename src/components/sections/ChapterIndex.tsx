"use client";

import { AnimatePresence, motion } from "motion/react";
import { worldVars, type Fragrance } from "@/lib/fragrance";

const SILK = [0.65, 0, 0.35, 1] as const;

/**
 * The six chapters as a slim index on the right edge (desktop). The active chapter's tick is
 * drawn out and its name shows; the others reveal their names on hover or focus. It uses
 * mix-blend-difference, like the nav, so it reads on every world. The experience's master
 * timeline fades it in with the first chapter and out before the collection.
 */
export function ChapterIndex({
  fragrances,
  active,
  onJump,
}: {
  fragrances: Pick<Fragrance, "slug" | "name">[];
  active: number;
  onJump: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Chapters"
      data-chapter-index
      data-reveal="layer"
      className="static:hidden right-gutter pointer-events-none fixed top-1/2 z-[60] hidden -translate-y-1/2 text-white mix-blend-difference md:block"
    >
      <ol className="flex flex-col items-end gap-2.5">
        {fragrances.map((f, i) => (
          <li key={f.slug}>
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-current={active === i ? "step" : undefined}
              className="group pointer-events-auto flex items-center gap-3 py-1 outline-offset-4"
            >
              <span className="eyebrow opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 group-aria-[current=step]:opacity-100">
                {f.name}
              </span>
              <span className="eyebrow text-[0.6rem] tabular-nums opacity-60 transition-opacity duration-500 group-hover:opacity-100 group-aria-[current=step]:opacity-100">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                aria-hidden
                className="block h-px w-8 origin-right scale-x-[0.35] bg-current transition-transform duration-700 ease-(--ease-cinema) group-hover:scale-x-75 group-aria-[current=step]:scale-x-100"
              />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * A wash of the destination world's colour. A jump fades it in, moves the scroll behind it, and
 * fades it out on the new chapter, so the visitor never sees the worlds in between rush past.
 */
export function WorldVeil({ fragrance }: { fragrance: Pick<Fragrance, "palette"> | null }) {
  return (
    <AnimatePresence>
      {fragrance && (
        <motion.div
          key="veil"
          aria-hidden
          className="bg-world-bg pointer-events-none fixed inset-0 z-[55]"
          style={worldVars(fragrance)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.45, ease: SILK } }}
          exit={{ opacity: 0, transition: { duration: 0.9, ease: SILK } }}
        />
      )}
    </AnimatePresence>
  );
}
