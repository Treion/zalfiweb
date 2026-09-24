"use client";

import Link from "next/link";
import clsx from "clsx";
import { motion } from "motion/react";
import { useState } from "react";
import { BottleImage, bottleAspect } from "@/components/media/BottleImage";
import { StageAnchor } from "@/components/stage/StageAnchor";
import { stageState } from "@/components/stage/stage-state";
import { NOTE_LAYERS, notesByLayer, type Fragrance } from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";

/** Editorial stagger (desktop), in svh: an asymmetric line-up rather than a grid of cards */
const OFFSETS = [0, 7, 2, 10, 4, 8];

const EASE = [0.22, 1, 0.36, 1] as const;

export function Collection({ fragrances }: { fragrances: Fragrance[] }) {
  return (
    <section
      id="collection"
      aria-labelledby="collection-title"
      className="world-surface px-gutter text-bone relative scroll-mt-10 pt-32 pb-28 [--world-bg:var(--noir)] md:pt-44 md:pb-40"
    >
      <StageAnchor kind="collection-section" className="pointer-events-none absolute inset-0" />
      <header className="grid grid-cols-12 gap-x-4 gap-y-8">
        <p className="eyebrow text-bone-dim col-span-12 md:col-span-3">The Collection</p>
        <h2
          id="collection-title"
          className="font-display col-span-12 text-[clamp(2.75rem,7vw,8rem)] leading-[0.92] md:col-span-6"
        >
          Six worlds.
          <br />
          <span className="display-italic">Choose yours.</span>
        </h2>
        <p className="text-bone-dim col-span-12 max-w-xs self-end text-sm leading-relaxed md:col-span-3">
          The same smoked glass, six different lights. Hover to lift a bottle and read its notes.
        </p>
      </header>

      <ul className="mt-20 grid grid-cols-2 gap-x-5 gap-y-16 md:mt-28 md:grid-cols-6 md:gap-x-6">
        {fragrances.map((f, i) => (
          <li
            key={f.slug}
            className={clsx("md:mt-(--off)", i % 2 === 1 && "max-md:mt-14")}
            style={{ "--off": `${OFFSETS[i % OFFSETS.length]}svh` } as React.CSSProperties}
          >
            <CollectionItem fragrance={f} index={i} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CollectionItem({ fragrance: f, index }: { fragrance: Fragrance; index: number }) {
  const [active, setActive] = useState(false);
  const on = () => {
    stageState.collectionHover = index;
    setActive(true);
  };
  const off = () => {
    if (stageState.collectionHover === index) stageState.collectionHover = -1;
    setActive(false);
  };
  const from = f.variants[0];

  return (
    <Link
      href={`/fragrances/${f.slug}`}
      data-cursor="Discover"
      onPointerEnter={on}
      onPointerLeave={off}
      onFocus={on}
      onBlur={off}
      className="group block outline-offset-8"
    >
      <StageAnchor
        kind="collection"
        index={index}
        className="relative mx-auto w-[82%]"
        style={{ aspectRatio: bottleAspect(f.slug) }}
      >
        <div data-stage-fallback={f.slug} className="absolute inset-0">
          <motion.div
            className="absolute inset-0"
            animate={{ y: active ? -10 : 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <BottleImage fragrance={f} fit="trim" sizes="(min-width: 768px) 12vw, 38vw" />
          </motion.div>
        </div>
      </StageAnchor>

      <div className="mt-7">
        <p className="eyebrow text-bone-dim tabular-nums">{String(index + 1).padStart(2, "0")}</p>
        <h3 className="font-display mt-2 text-[clamp(1.9rem,2.6vw,2.6rem)] leading-none">
          {f.name}
        </h3>
        <p className="text-bone-dim mt-2 text-xs">{f.mood}</p>
        <motion.dl
          className="mt-5 hidden grid-cols-[3.2rem_1fr] gap-y-1 text-[0.72rem] leading-snug md:grid"
          initial={false}
          animate={{ opacity: active ? 1 : 0, y: active ? 0 : 8 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {NOTE_LAYERS.map((layer) => (
            <div key={layer} className="contents">
              <dt className="eyebrow text-bone-dim pt-px text-[0.55rem] capitalize">{layer}</dt>
              <dd>
                {notesByLayer(f, layer)
                  .map((n) => n.label)
                  .join(", ")}
              </dd>
            </div>
          ))}
        </motion.dl>
        {from && (
          <p className="eyebrow text-bone-dim mt-4">
            From {formatPrice(from.priceCents, from.currency)}
          </p>
        )}
      </div>
    </Link>
  );
}
