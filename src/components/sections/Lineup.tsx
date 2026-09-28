"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState, type CSSProperties } from "react";
import { useCart } from "@/components/cart/cart-store";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { stageState } from "@/components/stage/stage-state";
import type { Fragrance } from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";

/** Editorial stagger (desktop), in svh: an asymmetric line-up rather than a row of cards */
const OFFSETS = [0, 5, 1, 7, 2, 6];

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The first thing the site shows: all six bottles, lined up. Each opens its product page or goes
 * straight into the bag. Hovering one lets a little of its world into the room (the stage washes
 * the background towards its colour). Scrolling hands Reva forward into the first world (see the
 * experience timeline), and the others dissolve until their own chapters.
 */
export function Lineup({ fragrances }: { fragrances: Fragrance[] }) {
  return (
    <div
      data-lineup
      className="px-gutter text-bone static:relative static:inset-auto static:pt-32 static:pb-24 absolute inset-0 flex flex-col pt-24 pb-5 md:pt-28 md:pb-7"
    >
      <header data-lineup-text className="flex items-end justify-between gap-6">
        <h1 className="font-display text-[clamp(2.1rem,4.4vw,4.75rem)] leading-[0.95]">
          Six worlds. <br className="md:hidden" />
          <span className="display-italic">Choose yours.</span>
        </h1>
        <Link
          href="/find"
          data-cursor="Begin"
          className="eyebrow shrink-0 border-b border-current/50 pb-1 transition-colors hover:border-current"
        >
          Find your world
        </Link>
      </header>

      <ul className="static:mt-16 my-auto grid grid-cols-3 gap-x-3 gap-y-7 md:grid-cols-6 md:gap-x-6">
        {fragrances.map((f, i) => (
          <li
            key={f.slug}
            data-lineup-item
            className="md:mt-(--off)"
            style={{ "--off": `${OFFSETS[i % OFFSETS.length]}svh` } as CSSProperties}
          >
            <LineupItem fragrance={f} index={i} />
          </li>
        ))}
      </ul>

      <div
        data-lineup-text
        aria-hidden
        className="static:hidden mt-5 flex flex-col items-center gap-2 md:mt-7"
      >
        <span className="eyebrow text-bone-dim text-[0.6rem]">Scroll</span>
        <span className="bg-bone/30 block h-7 w-px" />
      </div>
    </div>
  );
}

function LineupItem({ fragrance: f, index }: { fragrance: Fragrance; index: number }) {
  const { add } = useCart();
  const [active, setActive] = useState(false);
  const on = () => {
    stageState.collectionHover = index;
    setActive(true);
  };
  const off = () => {
    if (stageState.collectionHover === index) stageState.collectionHover = -1;
    setActive(false);
  };
  const v = f.variants[0];

  return (
    // The load arrival (CSS, .lineup-in) lives on this inner wrapper; the scroll hand-off (GSAP)
    // moves the <li>, so the two never fight over opacity
    <div data-lineup-in style={{ "--i": index } as CSSProperties}>
      <Link
        href={`/fragrances/${f.slug}`}
        data-cursor="Discover"
        onPointerEnter={on}
        onPointerLeave={off}
        onFocus={on}
        onBlur={off}
        className="block outline-offset-8"
      >
        <StageAnchor
          kind="lineup"
          index={index}
          className="relative mx-auto w-[68%] md:w-[80%]"
          style={{ aspectRatio: bottleAspect(f.slug) }}
        >
          <div data-stage-fallback={f.slug} className="absolute inset-0">
            <motion.div
              className="absolute inset-0"
              animate={{ y: active ? -10 : 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <BottleImage fragrance={f} fit="trim" preload sizes="(min-width: 768px) 11vw, 20vw" />
            </motion.div>
          </div>
        </StageAnchor>
        <h2 className="font-display mt-4 text-center text-[clamp(1.3rem,2.2vw,2.3rem)] leading-none md:mt-6">
          {f.name}
        </h2>
      </Link>
      {v && (
        <div className="mt-2 flex items-baseline justify-center gap-3 md:mt-3">
          <span className="text-bone-dim text-xs tabular-nums md:text-sm">
            {formatPrice(v.priceCents, v.currency)}
          </span>
          <button
            type="button"
            data-cursor="Add"
            aria-label={`Add ${f.name} to bag`}
            onClick={() =>
              add({
                sku: v.sku,
                slug: f.slug,
                name: f.name,
                sizeMl: v.sizeMl,
                priceCents: v.priceCents,
                currency: v.currency,
                bottleImage: f.bottleImage,
              })
            }
            className="eyebrow border-b border-current/40 pb-0.5 transition-colors hover:border-current"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
