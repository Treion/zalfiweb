"use client";

import Link from "next/link";
import clsx from "clsx";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { EASE as GSAP_EASE, type gsap } from "@/components/motion/gsap";
import { SplitWords } from "@/components/motion/SplitWords";
import { useCart } from "@/components/cart/cart-store";
import { BottleImage } from "@/components/media/BottleImage";
import { NoteImage } from "@/components/media/NoteImage";
import { EXP, chapterStart } from "@/components/stage/config";
import {
  NOTE_LAYERS,
  notesByLayer,
  worldVars,
  type Fragrance,
  type FragranceNote,
  type NoteLayer,
} from "@/lib/fragrance";
import { formatPrice } from "@/lib/money";
import { NOTE_SLOTS } from "./note-slots";

type Props = {
  fragrance: Fragrance;
  index: number;
  count: number;
  noteAvail: Record<string, boolean>;
  /** Only chapters near the viewport mount their note images (preloads the next chapter) */
  mounted: boolean;
};

const LAYER_LABEL: Record<NoteLayer, string> = { top: "Top", heart: "Heart", base: "Base" };

/**
 * One fragrance chapter. Data in, world out: every chapter is this component, so there are no
 * duplicated sections. Two renderings of the same data:
 *  - the motion layout: layered over the WebGL stage, choreographed by buildChapterTimeline
 *  - the static spread: shown by CSS for reduced motion or when WebGL is unavailable
 */
export function FragranceChapter(props: Props) {
  return (
    <>
      <MotionChapter {...props} />
      <StaticSpread {...props} />
    </>
  );
}

function useAddToBag(f: Fragrance) {
  const { add } = useCart();
  const v = f.variants[0];
  return () =>
    v &&
    add({
      sku: v.sku,
      slug: f.slug,
      name: f.name,
      sizeMl: v.sizeMl,
      priceCents: v.priceCents,
      currency: v.currency,
      bottleImage: f.bottleImage,
    });
}

function MotionChapter({ fragrance: f, index, count, noteAvail, mounted }: Props) {
  const addToBag = useAddToBag(f);
  const from = f.variants[0];
  const num = String(index + 1).padStart(2, "0");
  return (
    <article
      data-chapter
      data-reveal="layer"
      aria-labelledby={`ch-${f.slug}`}
      className="text-world-ink static:hidden pointer-events-none absolute inset-0"
      style={worldVars(f)}
    >
      {/* Eyebrow */}
      <div
        data-a="text"
        className="left-gutter absolute top-[13svh] overflow-hidden md:top-[15svh]"
      >
        <p data-a="eyebrow" data-reveal className="eyebrow">
          <span className="tabular-nums">
            {num} / {String(count).padStart(2, "0")}
          </span>
          <span className="mx-3 inline-block h-px w-8 bg-current align-middle opacity-50" />
          {f.mood}
        </p>
      </div>

      {/* Name: the stage sets it huge behind the bottle; this DOM copy is the accessible heading
          and the visible fallback until the stage has painted */}
      <div
        data-a="text"
        className="absolute top-[calc(43%-0.7svh)] left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap md:top-[calc(48%-1.2svh)]"
      >
        <h2
          id={`ch-${f.slug}`}
          data-a="name"
          className="chapter-name font-display text-[27vw] leading-none md:text-[min(20vw,34svh)]"
        >
          <SplitWords text={f.name} />
        </h2>
      </div>

      {/* Floating notes */}
      <div className="absolute inset-0">
        {NOTE_LAYERS.map((layer) => (
          <div key={layer} data-layer={layer}>
            {notesByLayer(f, layer).map((n, i) => (
              <FloatingNote
                key={n.slug}
                note={n}
                i={i}
                layer={layer}
                available={noteAvail[n.image]}
                mounted={mounted}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Bottom left: tagline, story, pyramid */}
      <div
        data-a="text"
        className="right-gutter left-gutter absolute bottom-[17svh] md:right-auto md:bottom-[8svh] md:w-[min(30vw,27rem)]"
      >
        <p
          data-a="tagline"
          className="display-italic text-[clamp(1.45rem,2.3vw,2.5rem)] leading-[1.12]"
        >
          <SplitWords text={f.tagline} />
        </p>
        <p
          data-a="story"
          data-reveal
          className="mt-5 hidden max-w-[24rem] text-sm leading-relaxed opacity-80 md:block"
        >
          {f.story}
        </p>
      </div>

      {/* Bottom right: price + CTAs */}
      <div
        data-a="text"
        className="left-gutter md:right-gutter absolute bottom-[6svh] md:bottom-[8svh] md:left-auto md:text-right"
      >
        <div data-a="cta" data-reveal className="pointer-events-auto">
          {from && (
            <p className="eyebrow mb-4 hidden opacity-70 md:block">
              {from.sizeMl} ml · {formatPrice(from.priceCents, from.currency)}
            </p>
          )}
          <div className="flex items-center gap-5 md:justify-end">
            <Link
              href={`/fragrances/${f.slug}`}
              data-cursor="Discover"
              className="eyebrow border-b border-current pb-1"
            >
              Discover {f.name}
            </Link>
            <button
              type="button"
              onClick={addToBag}
              data-cursor="Add"
              className="eyebrow bg-world-ink text-world-bg px-5 py-3.5 transition-opacity hover:opacity-85"
            >
              Add to bag
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FloatingNote({
  note,
  i,
  layer,
  available,
  mounted,
}: {
  note: FragranceNote;
  i: number;
  layer: NoteLayer;
  available: boolean;
  mounted: boolean;
}) {
  const d = NOTE_SLOTS.desktop[layer][i];
  const m = NOTE_SLOTS.mobile[layer][i];
  if (!d) return null;
  const style = {
    "--dx": `${d.x}vw`,
    "--dy": `${d.y}svh`,
    "--ds": `${d.size}vw`,
    "--mx": `${(m ?? d).x}vw`,
    "--my": `${(m ?? d).y}svh`,
    "--ms": `${(m ?? d).size}vw`,
  } as CSSProperties;
  return (
    <div
      data-note-scatter
      data-dir={d.x < 0 ? -1 : 1}
      className={clsx(
        "absolute top-[calc(43%+var(--my))] left-[calc(50%+var(--mx))] w-(--ms) -translate-x-1/2 -translate-y-1/2",
        "md:top-[calc(48%+var(--dy))] md:left-[calc(50%+var(--dx))] md:w-(--ds)",
        !m && "max-md:hidden",
      )}
      style={style}
    >
      <div data-depth={d.depth}>
        <div data-note-anim data-reveal>
          <div data-pointer-depth={d.depth} className={clsx(d.far && "blur-[2.5px] md:blur-[3px]")}>
            <motion.figure
              tabIndex={d.far ? -1 : 0}
              className="group pointer-events-auto relative outline-none"
              whileHover="lift"
              whileFocus="lift"
              initial="rest"
              animate="rest"
            >
              <motion.div
                variants={{ rest: { y: 0, scale: 1 }, lift: { y: -12, scale: 1.05 } }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                {mounted ? (
                  <NoteImage
                    note={note}
                    available={available}
                    frameLabel={false}
                    sizes="(min-width: 768px) 12vw, 25vw"
                    className={clsx(!available && "text-world-ink")}
                  />
                ) : (
                  <div className="aspect-square w-full" />
                )}
              </motion.div>
              <figcaption className="mt-2 text-center md:mt-3">
                <span className="eyebrow block text-[0.58rem] opacity-60">
                  {LAYER_LABEL[layer]}
                </span>
                <motion.span
                  variants={{ rest: { opacity: 0.85, y: 0 }, lift: { opacity: 1, y: -4 } }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="display-italic block text-[0.95rem] leading-tight md:text-[1.15rem]"
                >
                  {note.label}
                </motion.span>
              </figcaption>
            </motion.figure>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaticSpread({ fragrance: f, index, count, noteAvail }: Props) {
  const addToBag = useAddToBag(f);
  const from = f.variants[0];
  return (
    <section
      aria-labelledby={`st-${f.slug}`}
      className="bg-world-bg px-gutter text-world-ink static:block hidden min-h-svh py-28"
      style={worldVars(f)}
    >
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <div className="col-span-12 md:col-span-5">
          <p className="eyebrow opacity-70">
            {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")} · {f.mood}
          </p>
          <h2 id={`st-${f.slug}`} className="font-display text-display mt-6">
            {f.name}
          </h2>
          <p className="display-italic mt-5 text-3xl leading-snug">{f.tagline}</p>
          <p className="mt-6 max-w-md opacity-80">{f.story}</p>
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Link href={`/fragrances/${f.slug}`} className="eyebrow border-b border-current pb-1">
              Discover {f.name}
            </Link>
            <button
              type="button"
              onClick={addToBag}
              className="eyebrow bg-world-ink text-world-bg px-5 py-3.5"
            >
              Add to bag{from ? ` · ${formatPrice(from.priceCents, from.currency)}` : ""}
            </button>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 md:col-start-7">
          <BottleImage fragrance={f} sizes="(min-width: 768px) 45vw, 90vw" />
        </div>
        <div className="col-span-12 grid gap-10 md:grid-cols-3">
          {NOTE_LAYERS.map((layer) => (
            <div key={layer}>
              <h3 className="eyebrow mb-4 opacity-70">{LAYER_LABEL[layer]}</h3>
              <ul className="grid grid-cols-3 gap-3">
                {notesByLayer(f, layer).map((n) => (
                  <li key={n.slug}>
                    <NoteImage note={n} available={noteAvail[n.image]} sizes="15vw" />
                    <p className="display-italic mt-2 text-sm leading-tight">{n.label}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Scroll choreography for one chapter, appended to the experience's master timeline.
 * Positions are in vh units from config.ts, the same numbers the WebGL stage uses.
 * ----------------------------------------------------------------------------------------------*/
export function buildChapterTimeline(
  tl: gsap.core.Timeline,
  el: HTMLElement,
  i: number,
  k: number,
) {
  const q = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));
  const at = (v: number) => chapterStart(i, k) + v * k;
  const len = (seg: readonly [number, number]) => (seg[1] - seg[0]) * k;
  const C = EXP.ch;

  // Visibility window (autoAlpha keeps hidden chapters out of the tab order)
  tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 8 * k }, at(C.eyebrow[0] - 8));
  tl.to(el, { autoAlpha: 0, duration: 6 * k }, at(C.exit[1] - 30));

  tl.fromTo(
    q('[data-a="eyebrow"]'),
    { yPercent: 110, opacity: 1 },
    { yPercent: 0, duration: len(C.eyebrow), ease: GSAP_EASE.cinema },
    at(C.eyebrow[0]),
  );
  tl.fromTo(
    q('[data-a="name"] [data-w]'),
    { yPercent: 105, opacity: 1 },
    { yPercent: 0, duration: len(C.masthead), ease: GSAP_EASE.cinema },
    at(C.masthead[0]),
  );
  tl.fromTo(
    q('[data-a="tagline"] [data-w]'),
    { yPercent: 110, opacity: 1 },
    { yPercent: 0, duration: 30 * k, stagger: 2.5 * k, ease: GSAP_EASE.cinema },
    at(C.tagline[0]),
  );
  tl.fromTo(
    q('[data-a="story"]'),
    { opacity: 0, y: 18 },
    { opacity: 0.8, y: 0, duration: 30 * k },
    at(C.tagline[0] + 25),
  );

  // Notes arrive in three layers. As each new layer arrives, the previous one recedes and drifts
  // upward: top notes evaporate first, exactly as they do on skin.
  NOTE_LAYERS.forEach((layer, li) => {
    const seg = C[layer];
    const notes = q(`[data-layer="${layer}"] [data-note-anim]`);
    tl.fromTo(
      notes,
      { opacity: 0, scale: 0.55, yPercent: 45 },
      {
        opacity: 1,
        scale: 1,
        yPercent: 0,
        duration: len(seg),
        stagger: 7 * k,
        ease: GSAP_EASE.enter,
      },
      at(seg[0]),
    );
    const next = NOTE_LAYERS[li + 1];
    if (next) {
      const ns = C[next];
      tl.to(
        notes,
        { opacity: 0.4, scale: 0.8, yPercent: -35, duration: len(ns), ease: GSAP_EASE.silk },
        at(ns[0]),
      );
    }
  });

  tl.fromTo(
    q('[data-a="cta"]'),
    { opacity: 0, y: 26 },
    { opacity: 1, y: 0, duration: len(C.cta), ease: GSAP_EASE.enter },
    at(C.cta[0]),
  );

  // Outro: type lifts away, notes scatter outward and dissolve
  tl.to(
    q('[data-a="text"]'),
    { opacity: 0, y: -24, duration: len(C.textOut), ease: GSAP_EASE.exit },
    at(C.textOut[0]),
  );
  tl.to(
    q("[data-note-scatter]"),
    {
      x: (_: number, t: HTMLElement) => Number(t.dataset.dir) * window.innerWidth * 0.14,
      opacity: 0,
      duration: len(C.textOut),
      ease: GSAP_EASE.exit,
    },
    at(C.textOut[0]),
  );

  // Continuous depth parallax across the chapter: near notes travel further than far ones
  tl.fromTo(
    q("[data-depth]"),
    { y: (_: number, t: HTMLElement) => Number(t.dataset.depth) * 70 },
    {
      y: (_: number, t: HTMLElement) => Number(t.dataset.depth) * -70,
      duration: (EXP.chapter + 60) * k,
      ease: "none",
    },
    at(-20),
  );
}
