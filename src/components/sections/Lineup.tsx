"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent } from "react";
import { useCart } from "@/components/cart/cart-store";
import { useLenis } from "@/components/motion/SmoothScroll";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import { lineupOpen } from "@/components/stage/choreography";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { stageState } from "@/components/stage/stage-state";
import { setNavSection } from "@/components/ui/nav-section";
import type { Fragrance } from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";
import { enterWorld, leaveWorld, resetRoom } from "./room";
import { countWord } from "@/lib/words";

/** Editorial stagger (desktop), in svh: an asymmetric line-up rather than a row of cards */
const OFFSETS = [0, 5, 1, 7, 2, 6];

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * All six bottles, lined up: they rise into place as the landing logo leaves. Each opens its product
 * page or goes straight into the bag. Hovering one fills the room with its world, and the words
 * take that world's ink (see room.ts). Scrolling on hands Reva forward into the first world (see
 * the experience timeline), and the others dissolve until their own chapters.
 */
export function Lineup({ fragrances }: { fragrances: Fragrance[] }) {
  const lenis = useLenis();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => resetRoom, []);

  // In the static layout the line-up is an ordinary section: the nav outlines "Fragrances" while
  // most of it is on screen. (In the motion layout the experience timeline decides.)
  useEffect(() => {
    const el = root.current;
    const html = document.documentElement;
    const isStatic = () =>
      html.classList.contains("static-experience") ||
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el) return;
    // Checked on each change: the stage may decide on the static layout after this mounts
    const io = new IntersectionObserver(
      ([e]) => {
        if (isStatic()) setNavSection(e!.intersectionRatio >= 0.35 ? "fragrances" : null);
      },
      { threshold: [0, 0.35, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setNavSection(null);
    };
  }, []);

  // Tabbing into the line-up from the landing brings it into view first
  function onFocus(e: FocusEvent<HTMLDivElement>) {
    if (lineupOpen(stageState.s, stageState.k) > 0.5 || !lenis) return;
    const target = document.getElementById("collection");
    if (target && e.target instanceof HTMLElement) lenis.scrollTo(target, { duration: 1.2 });
  }

  return (
    <div
      ref={root}
      data-lineup
      onFocus={onFocus}
      className="room-ink px-gutter static:relative static:inset-auto static:pt-32 static:pb-24 absolute inset-0 flex flex-col pt-24 pb-5 text-(--room-ink) md:pt-28 md:pb-7"
    >
      <header data-lineup-text data-reveal className="flex items-end justify-between gap-6">
        <h2 className="font-display text-[clamp(2.1rem,4.4vw,4.75rem)] leading-[0.95]">
          {`${countWord(fragrances.length, true)} worlds. `}
          <br className="md:hidden" />
          <span className="display-italic">Choose yours.</span>
        </h2>
        <Link
          href="/find"
          data-cursor="Begin"
          className="eyebrow shrink-0 border-b border-current/50 pb-1 transition-colors hover:border-current"
        >
          Find your world
        </Link>
      </header>

      <ul
        className="static:mt-16 my-auto grid grid-cols-3 gap-x-3 gap-y-7 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))] md:gap-x-6"
        style={{ "--cols": fragrances.length } as CSSProperties}
      >
        {fragrances.map((f, i) => (
          <li
            key={f.slug}
            data-lineup-item
            data-reveal
            className="md:mt-(--off)"
            style={{ "--off": `${OFFSETS[i % OFFSETS.length]}svh` } as CSSProperties}
          >
            <LineupItem fragrance={f} index={i} />
          </li>
        ))}
      </ul>

      <div
        data-lineup-text
        data-reveal
        aria-hidden
        className="static:hidden mt-5 flex flex-col items-center gap-2 md:mt-7"
      >
        <span className="eyebrow text-[0.6rem] opacity-70">Scroll</span>
        <span className="block h-7 w-px bg-current opacity-30" />
      </div>
    </div>
  );
}

function LineupItem({ fragrance: f, index }: { fragrance: Fragrance; index: number }) {
  const { add } = useCart();
  const [active, setActive] = useState(false);
  const on = () => {
    enterWorld(index, f.palette.ink);
    setActive(true);
  };
  const off = () => {
    leaveWorld(index);
    setActive(false);
  };
  const v = f.variants[0];

  return (
    // In the static layout this inner wrapper rises into view (CSS); in the motion layout the
    // scroll timeline moves the <li>, so the two never fight over opacity
    <div data-lineup-in>
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
          style={{ aspectRatio: bottleAspect(f) }}
        >
          {/* The trimmed photo's transparent margins overflow the slot: only the slot takes the
              pointer, so the room fills only when the bottle itself is hovered */}
          <div data-stage-fallback={f.slug} className="pointer-events-none absolute inset-0">
            <motion.div
              className="absolute inset-0"
              animate={{ y: active ? -10 : 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <BottleImage fragrance={f} fit="trim" sizes="(min-width: 768px) 11vw, 20vw" />
            </motion.div>
          </div>
        </StageAnchor>
        <h3 className="font-display mt-4 text-center text-[clamp(1.3rem,2.2vw,2.3rem)] leading-none md:mt-6">
          {f.name}
        </h3>
      </Link>
      {v && (
        <div className="mt-2 flex items-baseline justify-center gap-3 md:mt-3">
          <span className="text-xs tabular-nums opacity-75 md:text-sm">
            {formatPrice(v.pricePoisha)}
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
                pricePoisha: v.pricePoisha,
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
